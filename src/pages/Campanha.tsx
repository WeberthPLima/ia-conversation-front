/// <reference types="vite/client" />
import { KeyboardEventHandler, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
// @ts-ignore
import styles from '../lib/chat/styles.module.css';
import { animateIdle, convertMP4ToPCMBase64, convertWebMToPCMBase64, playAndVisualizeMicrophoneAudio, visualizeAudio } from '../lib/chat/utils';
import { FFT_SIZE, SAMPLE_RATE } from '../lib/chat/const';
import startImg from '../assets/start.png';
import stylesAplication from '../components/style.module.css';
import { WavStreamPlayer } from '../lib/wavtools';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Campanha() {
  const { campanha } = useParams();
  const [prompt, setPrompt] = useState<string>('');
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
  const [controllTime, setControllTime] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioRefEnd = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);

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
        if (!res.ok) {
          throw new Error(`Erro ${res.status}: ${res.statusText}`);
        }
        let texto = '';
        try {
          const data = await res.json();
          texto = data?.prompt ?? '';
        } catch {
          texto = await res.text();
        }
        setPrompt(texto);
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

  const closeRecord = useCallback(() => {
    setTimeout(() => {
      setControllRecord(false);
      setControllTime(false);
      // setIsSpacePressed(false);
      // stopMicrophoneCapture(true);
    }, 800);
    if (audioRefEnd.current) {
      audioRefEnd.current.play();
    }
  }, []);

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
            console.log(pcmBase64);
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
          <img
            src={startImg}
            alt="A gente se importa"
            style={{ maxWidth: '75vw', maxHeight: '60vh' }}
          />
        </div>
        {error && <span className={styles.ErrorMessage}>Erro: {error}</span>}
        {loading && !error && (
          <span className={styles.Transcript}>Carregando conteúdo da campanha...</span>
        )}
      </div>
    </div>
  );
}