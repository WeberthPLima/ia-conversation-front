/// <reference types="vite/client" />
import { KeyboardEventHandler, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
// @ts-ignore
import styles from '../lib/chat/styles.module.css';
import { animateIdle, base64ToArrayBuffer, convertMP4ToPCMBase64, convertWebMToPCMBase64, playAndVisualizeMicrophoneAudio, visualizeAudio } from '../lib/chat/utils';
import { FFT_SIZE, SAMPLE_RATE } from '../lib/chat/const';
import startImg from '../assets/start.png';
import stylesAplication from '../components/style.module.css';
import { WavStreamPlayer } from '../lib/wavtools';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Campanha() {
  const { campanha } = useParams();
  const [prompt, setPrompt] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [IsExpericence, setIsExpericence] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagePatternRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTimeRef = useRef<number>(0);
  const previousValuesRef = useRef<number[]>(
    new Array(FFT_SIZE / 2 + 1).fill(127)
  );
  const [constrollRecord, setControllRecord] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioRefEnd = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastRateLimitRef = useRef<number | null>(null);
  const audioOutputBase64Ref = useRef<string>('');
  const audioTranscriptDoneRef = useRef<boolean>(false);

  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');

  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const isTouch = typeof window !== 'undefined' && (
    'ontouchstart' in window || (navigator as any)?.maxTouchPoints > 0
  );

  useEffect(() => {
    async function fetchPrompt() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_URL}/prompt/${encodeURIComponent(campanha ?? '')}`);
        if (res.status === 404) {
          setPrompt({});
          setError('Conteúdo da campanha não encontrado (404).');
          return;
        }
        if (!res.ok) {
          let body = '';
          try { body = await res.text(); } catch { }
          setPrompt({});
          setError(`Falha ao buscar o prompt (${res.status}): ${res.statusText}${body ? ` — ${body}` : ''}`);
          return;
        }
        const data = await res.json();
        setPrompt({
          prompt: data?.prompt ?? '',
          temperature: data?.temperature ?? null,
          turn_detection: null,
          type: data?.type ?? '',
          voice: data?.voice ?? '',
        });
      } catch (err: any) {
        setError(err.message || 'Falha ao buscar o prompt');
      } finally {
        setLoading(false);
      }
    }

    fetchPrompt();
  }, [campanha]);

  const cancelCurrentAnimationFrame = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const playIdleAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imagePatternRef.current;
    if (!canvas || !image) return;
    cancelCurrentAnimationFrame();
    animateIdle(
      canvas,
      image,
      previousValuesRef.current,
      animationFrameRef,
      animationTimeRef,
      0,
      isTouch,
    );
  }, [cancelCurrentAnimationFrame, isTouch]);

  useEffect(() => {
    const onResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      if (canvasRef.current && imagePatternRef.current) {
        playIdleAnimation();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [playIdleAnimation]);

  useLayoutEffect(() => {
    if (!imagePatternRef.current) {
      const patternImage = new Image();
      patternImage.src = '/transparent-background.png';
      imagePatternRef.current = patternImage;
      patternImage.onload = () => {
        playIdleAnimation();
      };
    }
    if (canvasRef.current && imagePatternRef.current) {
      playIdleAnimation();
    }
    return () => {
      cancelCurrentAnimationFrame();
    };
  }, [cancelCurrentAnimationFrame, playIdleAnimation]);

  useEffect(() => {
    async function fetchMicrophones() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicrophones(mics);
        if (mics.length > 0) setSelectedMic(mics[0].deviceId);
      } catch (err) {
        console.log('Erro ao buscar microfones:', err);
      }
    }
    fetchMicrophones();
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Cleanup: fecha socket ao desmontar
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        console.log('Fechando socket ao desmontar...');
        socketRef.current.emit('openia:close', { campanha });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [campanha]);

  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: SAMPLE_RATE }),
  );

  const handleKeyPress: KeyboardEventHandler<HTMLDivElement> = async event => {
    event.preventDefault();
    if (constrollRecord) {
      stopRecording();
      return false;
    }
    if (event.key === ' ' || event.code === 'Space') {
      if (IsExpericence) {
        startMicrofone()
      } else {
        setIsExpericence(true);
        initiationAplication()
      }
    }
  };

  const [audioTranscript, setAudioTranscript] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const ensureMicrophoneStream = useCallback(async () => {
    try {
      if (
        microphoneStreamRef.current &&
        microphoneStreamRef.current.getAudioTracks().every(t => t.readyState !== 'live')
      ) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      microphoneStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.log('Erro ao iniciar microfone:', err);
      return null;
    }
  }, [selectedMic]);
  async function startMicrofone() {
    setControllRecord(true);
    if (!microphoneStreamRef.current ||
      microphoneStreamRef.current.getAudioTracks().length === 0 ||
      microphoneStreamRef.current.getAudioTracks().every(t => t.readyState !== 'live')) {
      await ensureMicrophoneStream();
    }
    if (microphoneStreamRef.current) {
      console.log('Entrou microfone', microphoneStreamRef.current);
      setAudioTranscript('');
      if (audioRef.current) {
        audioRef.current.play();
      }

      const supportedType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find(t => {
        try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
      });

      if (!supportedType) {
        console.error('Nenhum MIME type suportado para MediaRecorder.');
        return;
      }

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(microphoneStreamRef.current, { mimeType: supportedType });
      } catch (e) {
        console.warn('Falha ao criar MediaRecorder com mimeType, tentando sem opções:', e);
        mediaRecorder = new MediaRecorder(microphoneStreamRef.current);
      }

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = async event => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };



      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mediaRecorder.mimeType || supportedType });
        try {
          const pcmBase64 =
            mediaRecorder.mimeType.includes('mp4')
              ? await convertMP4ToPCMBase64(blob)
              : await convertWebMToPCMBase64(blob);

          if (pcmBase64) {
            enviarResposta(pcmBase64);
          } else {
            console.error('Erro convertendo audio para PCM: PCM vazio');
          }
        } catch (error) {
          console.error('Erro convertendo audio para PCM:', error);
        } finally {
          // Stop tracks after finishing
          microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
        }
      };

      try {
        mediaRecorder.start(100);
        if (canvasRef.current && imagePatternRef.current) {
          cancelCurrentAnimationFrame();
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedMic } },
          });
          microphoneStreamRef.current = audioStream;
          playAndVisualizeMicrophoneAudio(
            canvasRef.current,
            audioStream,
            imagePatternRef.current,
            previousValuesRef.current,
            animationFrameRef,
            animationTimeRef,
            isTouch,
          );
        }

      } catch (e) {
        console.warn('Falha ao iniciar MediaRecorder com timeslice, tentando start() sem timeslice:', e);
        mediaRecorder.start();
      }
    } else {
      console.log('Nenhum stream de microfone disponível.');
    }
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if (audioRefEnd.current) {
        audioRefEnd.current.play();
      }
      setControllRecord(false);
    }
  }, []);

  function enviarResposta(texto: string) {
    const socket = socketRef.current;
    if (!socket) {
      console.warn('Socket não conectado');
      return;
    }
    console.log({ instructions: texto })
    socket.emit('openia:chat.audioInput', {
      campanha,
      frame: {
        type: 'response.create',
        response: { instructions: texto },
      },
    });
  }

  function fechar() {
    const socket = socketRef.current;
    if (!socket) return;
    console.log('Fechando conexão da campanha:', campanha);
    socket.emit('openia:close', { campanha });
    socket.disconnect();
    socketRef.current = null;
  }

  const handleAudioDelta = useCallback((audioDelta: string) => {
    try {
      const arrayBuffer = base64ToArrayBuffer(audioDelta);
      console.log(audioDelta, arrayBuffer)
      const wavStreamPlayer = wavStreamPlayerRef.current;
      wavStreamPlayer.add16BitPCM(arrayBuffer);
      setIsPlayingAudio(true);
    } catch (error) {
      console.log('Error decoding audio delta:', error);
    }
  }, []);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  useEffect(() => {
    console.log('isAudioStillPlaying', wavStreamPlayerRef.current.stream);
    function isAudioStillPlaying() {
      if (!wavStreamPlayerRef.current.stream) {
        setIsPlayingAudio(false);
      } else {
        requestAnimationFrame(isAudioStillPlaying);
      }
    }

    if (isPlayingAudio) {
      isAudioStillPlaying();
    }
  }, [isPlayingAudio]);

  useEffect(() => {
    if (socketRef.current) {
      console.log('Fechando conexão anterior antes de abrir nova para campanha:', campanha);
      socketRef.current.emit('openia:close', { campanha });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    const backendUrl = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3002';

    const socket = io(backendUrl, {
      transports: ['websocket'],
      forceNew: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 300000,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    // Registrar todos os event listeners aqui
    socket.on('connect', () => {
      console.log('Socket conectado:', socket.id, 'para campanha:', campanha);
      console.log('Transporte usado:', socket.io.engine.transport.name);
      // Não emitir eventos aqui - será feito em initiationAplication
    });

    // Acks
    socket.on('openia:open:ack', (d) => console.log('ack open', d));
    socket.on('openia:send:ack', (d) => console.log('ack send', d));
    socket.on('openia:close:ack', (d) => console.log('ack close', d));

    // Eventos
    socket.on('openia:event', (d) => {
      const eventType = d?.payload?.type;
      if (eventType === 'response.audio.delta') {
        console.log(eventType, d);
        handleAudioDelta(d?.payload?.delta || '');
      }
    });

    socket.on('openia:error', (d) => console.error('error', d));

    socket.on('disconnect', (reason) => {
      console.log('Socket desconectado:', reason, 'campanha:', campanha);
      socketRef.current = null;
    });

    socket.on('connect_error', (error) => {
      console.error('Erro de conexão Socket.IO:', error);
      console.error('Detalhes do erro:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });

      if (error.message.includes('websocket') || error.message.includes('Transport')) {
        console.log('Tentando reconectar apenas com polling...');
        (socket as any).io.opts.transports = ['polling'];
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconectado após', attemptNumber, 'tentativas');
    });

    socket.on('reconnect_error', (error) => {
      console.error('Erro na reconexão:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('Falha na reconexão após todas as tentativas');
      socketRef.current = null;
    });
  }, [campanha]);

  async function initiationAplication() {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.connect();
    if (canvasRef.current && imagePatternRef.current) {
      cancelCurrentAnimationFrame();
      visualizeAudio(
        canvasRef.current,
        wavStreamPlayer,
        imagePatternRef.current,
        previousValuesRef.current,
        animationFrameRef,
        animationTimeRef,
        isTouch,
      );
    }

    const socket = socketRef.current;
    if (!socket) {
      console.warn('Socket não conectado');
      return;
    }

    // Aguardar conexão se necessário
    if (!socket.connected) {
      console.log('Aguardando conexão do socket...');
      await new Promise<void>((resolve) => {
        socket.once('connect', () => resolve());
      });
    }

    // Emitir eventos agora que o socket está conectado
    socket.emit('openia:open', { campanha });

    const sessionUpdateFrame = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: prompt.prompt || '',
        voice: prompt.voice,
        turn_detection: null,
        temperature: prompt.temperature ?? 0.8,
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
      },
    };

    socket.emit('openia:send', { campanha, frame: sessionUpdateFrame });
    console.log('Session update enviado via openia:send para campanha:', campanha);

    if (prompt.prompt) {
      socket.emit('openia:send', {
        campanha,
        frame: {
          type: 'response.create',
          response: { instructions: prompt.prompt },
        },
      });
      console.log('Prompt inicial enviado via openia:send para campanha:', campanha);
    } else {
      console.log('Prompt vazio, não enviado.');
    }
  }

  return (
    <div className="campanha-page" ref={containerRef} tabIndex={0} onKeyDown={handleKeyPress}>
      <audio ref={audioRef} src="../mp3/bip1.wav" />
      <audio ref={audioRefEnd} src="../mp3/bip2.wav" />
      {constrollRecord && (
        <div className={stylesAplication['recindicator']}>
          <div className={stylesAplication['record']}></div>
        </div>
      )}
      <div className={styles.Container}>
        <div className={styles.MicrophoneSelect}>
          <select
            id="mic-select"
            onChange={e => setSelectedMic(e.target.value)}
            value={selectedMic}
          >
            {microphones.map(mic => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || `Microfone ${mic.deviceId}`}
              </option>
            ))}
          </select>
        </div>
        <canvas
          ref={canvasRef}
          className={styles.Canvas}
          width={isTouch ? 750 : windowSize.width}
          height={isTouch ? 1312 : windowSize.height}
        />
        <div
          className={`${stylesAplication.Center} ${!IsExpericence ? stylesAplication.LogoVisible : stylesAplication.LogoHidden}`}
          style={{ pointerEvents: 'none' }}
        >
          {!error ?
            <img
              src={startImg}
              alt="A gente se importa"
              style={{ maxWidth: '75vw', maxHeight: '60vh' }}
            />
            :
            <span
              style={{ width: '100vw', display: 'block', maxHeight: '60vh' }}
              className={styles.ErrorMessage}>Erro: {error}</span>
          }
        </div>
        {loading && !error && (
          <span className={styles.Transcript}>Carregando conteúdo da campanha...</span>
        )}
      </div>
    </div>
  );
}