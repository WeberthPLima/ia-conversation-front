'use client';

import classNames from 'classnames';
import NextImage from 'next/image';
import { useRouter } from 'next/router';
import {
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { usePoolingAsync } from '~/hooks/pooling';
import { useIsTouchDevice } from '~/hooks/touch';

import { clientApi } from '~/config/api/client';

import { ALLOWED_ENVIRONMENTS, FFT_SIZE, SAMPLE_RATE } from '~/lib/chat/const';
import styles from '~/lib/chat/styles.module.css';
import { AllowedEnvironmentsType, ExperienceType } from '~/lib/chat/types';
import {
  animateIdle,
  base64ToArrayBuffer,
  convertMP4ToPCMBase64,
  convertWebMToPCMBase64,
  playAndVisualizeMicrophoneAudio,
  visualizeAudio,
} from '~/lib/chat/utils';
import { WavStreamPlayer } from '~/lib/wavtools';

import stylesAplication from './style.module.css';

export default function StartAplication({
  aplicationName,
}: {
  aplicationName: string;
}) {
  const [windowSize, setWindowSize] = useState<{
    width: number;
    height: number;
  }>({ height: 0, width: 0 });
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [microphoneSelectorCollapsed, setMicrophoneSelectorCollapsed] =
    useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingIdleAnimation, setIsPlayingIdleAnimation] = useState(false);
  const [isExperienceActive, setIsExperienceActive] = useState(false);
  const [_hasClicked, setHasClicked] = useState(false);
  const [_audioTranscript, setAudioTranscript] = useState<string>('');
  const [hasEndedExperience, setHasEndedExperience] = useState(false);
  const [isStartingExperience, setIsStartingExperience] = useState(false);
  const [isRecordingMicrophone, setIsRecordingMicrophone] = useState(false);
  const [currentEnvironment, setCurrentEnvironment] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const languageRef = useRef<HTMLSelectElement>(null);
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: SAMPLE_RATE }),
  );
  const environmentRef = useRef<number | null>(null);
  const chatTranscriptRef = useRef<object[] | null>(null);
  const audioTranscriptDoneRef = useRef<boolean>(false);
  const webSocketRef = useRef<WebSocket | null>(null);
  const currentExperienceIdRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagePatternRef = useRef<HTMLImageElement | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const animationTimeRef = useRef<number>(0);
  const idleAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const previousValuesRef = useRef<number[]>(
    new Array(FFT_SIZE / 2 + 1).fill(127),
  );

  const isTouch = useIsTouchDevice();
  const { startPooling } = usePoolingAsync();
  const router = useRouter();

  const cancelCurrentAnimationFrame = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const playIdleAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imagePatternRef.current;

    setIsPlayingIdleAnimation(true);

    if (canvas && image) {
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
    }
  }, [cancelCurrentAnimationFrame, isTouch]);

  const stopIdleAnimation = useCallback(() => {
    setIsPlayingIdleAnimation(false);

    if (idleAnimationTimerRef.current) {
      clearTimeout(idleAnimationTimerRef.current);
      idleAnimationTimerRef.current = null;
    }
  }, []);

  const restartIdleAnimation = useCallback(() => {
    stopIdleAnimation();
    idleAnimationTimerRef.current = setTimeout(() => playIdleAnimation(), 3000);
  }, [playIdleAnimation, stopIdleAnimation]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const stopMicrophoneCapture = useCallback(
    (cancelAnimationFrame: boolean = true) => {
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      }
      stopRecording();
      if (cancelAnimationFrame) {
        cancelCurrentAnimationFrame();
      }
    },
    [cancelCurrentAnimationFrame, stopRecording],
  );
  const startRecording = useCallback(() => {
    if (microphoneStreamRef.current) {
      setIsRecordingMicrophone(true);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' // Preferred for most browsers
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4' // Fallback for Safari
          : null;

      if (!mimeType) {
        console.error('No supported MIME type found for MediaRecorder.');
        return;
      }

      const mediaRecorder = new MediaRecorder(microphoneStreamRef.current, {
        mimeType,
      });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = async event => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });

        try {
          // Convert the recorded audio to PCM Base64 format
          const pcmBase64 =
            mimeType === 'audio/mp4'
              ? await convertMP4ToPCMBase64(blob) // Convert MP4 audio
              : await convertWebMToPCMBase64(blob); // Convert WebM audio
          if (pcmBase64) {
            webSocketRef.current?.send(
              JSON.stringify({
                type: 'chat.audioInput',
                data: pcmBase64,
              }),
            );
          }
          setIsRecordingMicrophone(false);
        } catch (error) {
          console.error('Error converting audio to PCM:', error);
        }
      };

      mediaRecorder.start(100);
    }
  }, []);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioRefEnd = useRef<HTMLAudioElement>(null);
  const captureMicrophone = useCallback(async () => {
    setAudioTranscript('');
    const canvas = canvasRef.current;
    const image = imagePatternRef.current;

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMic } },
      });
      microphoneStreamRef.current = audioStream;
      startRecording();

      if (canvas && image) {
        cancelCurrentAnimationFrame();
        playAndVisualizeMicrophoneAudio(
          canvas,
          audioStream,
          image,
          previousValuesRef.current,
          animationFrameRef,
          animationTimeRef,
          isTouch,
        );
      }
    } catch (error) {
      console.log('Error accessing microphone', error);
    }
  }, [cancelCurrentAnimationFrame, isTouch, selectedMic, startRecording]);

  // const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
  //   if (event.key === ' ') {
  //     event.preventDefault();
  //     if (
  //       isExperienceActive &&
  //       !isSpacePressed &&
  //       !isPlayingAudio &&
  //       !!selectedMic &&
  //       !!currentExperienceIdRef.current
  //     ) {
  //       setErrorMessage(null);
  //       setIsSpacePressed(true);
  //       captureMicrophone();
  //     } else if (!isExperienceActive && !isStartingExperience) {
  //       onStartExperience(true);
  //     }
  //   }
  // };

  const [constrollRecord, setControllRecord] = useState(false);
  const [controllTime, setControllTime] = useState(true);

  useEffect(() => {
    if (constrollRecord) {
      setTimeout(() => {
        setControllTime(false);
      }, 2000);
    }
  }, [constrollRecord]);

  const handleKeyPress: KeyboardEventHandler<HTMLDivElement> = event => {
    if (constrollRecord && !controllTime) {
      closeRecord();
      return false;
    }
    if (event.key === ' ') {
      event.preventDefault();
      if (
        isExperienceActive &&
        !isSpacePressed &&
        !isPlayingAudio &&
        !!selectedMic
      ) {
        if (audioRef.current) {
          audioRef.current.play();
        }
        setErrorMessage(null);
        setIsSpacePressed(true);
        setControllTime(true);
        setControllRecord(true);
        captureMicrophone();
      } else if (!isExperienceActive && !isStartingExperience) {
        onStartExperience(true);
      }
    }
  };

  const closeRecord = useCallback(() => {
    setTimeout(() => {
      setControllRecord(false);
      setControllTime(false);
      setIsSpacePressed(false);
      stopMicrophoneCapture(true);
    }, 800);
    if (audioRefEnd.current) {
      audioRefEnd.current.play();
    }
  }, []);

  // const handleKeyUp: KeyboardEventHandler<HTMLDivElement> = event => {
  //   if (event.key === ' ') {
  //     setIsSpacePressed(false);
  //     stopMicrophoneCapture(false);
  //   }
  // };

  const preventSpacePropagation = (event: React.KeyboardEvent) => {
    if (event.key === ' ') {
      event.stopPropagation();
    }
  };

  const saveConversation = useCallback((chat: any) => {
    clientApi.post(
      '/save',
      {
        id: currentExperienceIdRef.current,
        chat,
        collection: `${aplicationName}-experiences`,
      },
      {
        headers: {
          'X-Experience-ID': environmentRef.current,
        },
      },
    );
  }, []);

  const handleAudioDelta = useCallback((audioDelta: string) => {
    try {
      const arrayBuffer = base64ToArrayBuffer(audioDelta);

      const wavStreamPlayer = wavStreamPlayerRef.current;
      wavStreamPlayer.add16BitPCM(arrayBuffer);
      setIsPlayingAudio(true);
    } catch (error) {
      console.log('Error decoding audio delta:', error);
    }
  }, []);

  const setupSocketConnection = useCallback(
    async (id: string, name: string) => {
      const wavStreamPlayer = wavStreamPlayerRef.current;
      await wavStreamPlayer.connect();
      webSocketRef.current = new WebSocket('/');

      webSocketRef.current.addEventListener('open', () => {
        webSocketRef.current?.send(
          JSON.stringify({
            type: 'chat.start',
            data: {
              name,
              id,
              language: 'ptbr',
              environment: environmentRef.current,
              page: aplicationName,
            },
          }),
        );
      });

      webSocketRef.current.addEventListener('message', async event => {
        const parsedMessage = JSON.parse(event.data);
        const messageType = parsedMessage?.type;
        if (
          messageType === 'chat.started' ||
          messageType === 'chat.response.incoming'
        ) {
          setIsExperienceActive(true);

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

        if (messageType === 'chat.audio.delta') {
          handleAudioDelta(parsedMessage.data);
        }

        if (messageType === 'chat.audio_transcript.delta') {
          setAudioTranscript(t => {
            if (audioTranscriptDoneRef.current) {
              audioTranscriptDoneRef.current = false;
              return parsedMessage.data;
            }
            return t + parsedMessage.data;
          });
        }

        if (messageType === 'chat.audio_transcript.done') {
          setAudioTranscript(t => t + parsedMessage.data);
          audioTranscriptDoneRef.current = true;
        }

        if (messageType === 'chat.ended') {
          endExperience();
        }

        if (messageType === 'chat.current') {
          saveConversation(parsedMessage.data);
        }

        if (messageType === 'chat.error') {
          setErrorMessage(
            'Erro na conexão de internet. Por favor, tente novamente.',
          );
          setIsPlayingAudio(false);
        }
      });
    },
    [cancelCurrentAnimationFrame, handleAudioDelta, isTouch],
  );

  const _getExperienceList = useCallback(async () => {
    const experienceData = await startPooling<ExperienceType>(
      // eslint-disable-next-line @typescript-eslint/no-shadow
      async (onSuccess, _, onContinue) => {
        try {
          const { data } = await clientApi.get<{ data: ExperienceType[] }>(
            '/list',
            {
              headers: {
                'X-Experience-ID': environmentRef.current,
              },
            },
          );

          const experience = data.data.find(exp => !exp.hasStarted);

          if (experience) {
            return onSuccess(experience);
          }
        } catch (error) {
          console.log('Error fetching experience:', error);
        }

        onContinue();
      },
      5000,
      86400000,
    );

    if (experienceData) {
      currentExperienceIdRef.current = experienceData.id;
      try {
        await clientApi.post(
          '/start',
          {
            id: experienceData.id,
            collection: `${aplicationName}-experiences`,
          },
          {
            headers: {
              'X-Experience-ID': environmentRef.current,
            },
          },
        );

        setupSocketConnection(experienceData.id, experienceData.data.earn);
      } catch (error) {
        console.log('Error starting experience:', error);
      }
    }
  }, [setupSocketConnection, startPooling]);

  const onStartExperience = useCallback(
    async (emptyData: boolean = false) => {
      setIsStartingExperience(true);
      const id = router.query.id as string;
      const name = router.query.name as string;

      if ((!id || !name) && !emptyData) {
        return;
      }

      if (emptyData) {
        const { data } = await clientApi.post(
          '/prepare',
          {
            collection: `${aplicationName}-experiences`,
          },
          {
            headers: {
              'X-Experience-ID': environmentRef.current,
            },
          },
        );
        currentExperienceIdRef.current = data.id;
      } else {
        currentExperienceIdRef.current = id;
      }

      try {
        clientApi.post(
          '/start',
          {
            id: currentExperienceIdRef.current,
            collection: `${aplicationName}-experiences`,
          },
          {
            headers: {
              'X-Experience-ID': environmentRef.current,
            },
          },
        );

        setupSocketConnection(currentExperienceIdRef.current ?? id, name);
      } catch (error) {
        console.log('Error starting experience:', error);
      }

      setIsStartingExperience(false);
    },
    [router.query, setupSocketConnection],
  );

  const onToggleMicrophone = useCallback(() => {
    if (isRecordingMicrophone) {
      stopMicrophoneCapture();
    } else {
      setIsRecordingMicrophone(true);
      captureMicrophone();
    }
  }, [captureMicrophone, isRecordingMicrophone, stopMicrophoneCapture]);

  const endExperience = useCallback(async () => {
    try {
      await clientApi.post(
        '/end',
        {
          id: currentExperienceIdRef.current,
          chat: chatTranscriptRef.current,
        },
        {
          headers: {
            'X-Experience-ID': environmentRef.current,
          },
        },
      );
    } catch (error) {
      console.log('Error ending experience:', error);
    }

    webSocketRef.current?.close();
    setAudioTranscript('');
    audioTranscriptDoneRef.current = false;
    restartIdleAnimation();
    setTimeout(() => {
      setHasEndedExperience(false);
      setIsExperienceActive(false);
      if (
        environmentRef.current &&
        ALLOWED_ENVIRONMENTS[environmentRef.current] === 'p'
      ) {
        setTimeout(
          () => window.location.replace('https://agenteseimporta.com.br'),
          1000,
        );
      }
    }, 750);
  }, [restartIdleAnimation]);

  useEffect(() => {
    if (!isPlayingAudio && hasEndedExperience) {
      endExperience();
    }
  }, [endExperience, hasEndedExperience, isPlayingAudio]);

  useEffect(() => {
    async function fetchMicrophones() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const micDevices = devices.filter(
          device => device.kind === 'audioinput',
        );
        setMicrophones(micDevices);
        if (micDevices.length > 0) {
          setSelectedMic(micDevices[0].deviceId);
        }
      } catch (error) {
        console.log('Error fetching microphones:', error);
      }
    }
    fetchMicrophones();
  }, []);

  useEffect(() => {
    const environment = router.query.env as AllowedEnvironmentsType;
    if (ALLOWED_ENVIRONMENTS.includes(environment)) {
      environmentRef.current = ALLOWED_ENVIRONMENTS.indexOf(environment);
      setCurrentEnvironment(environmentRef.current);
    }
  }, [router.query.env]);

  useLayoutEffect(() => {
    const handleResize = () => {
      setWindowSize({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    };

    setWindowSize({
      height: window.innerHeight,
      width: window.innerWidth,
    });

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // useEffect(() => {
  //   if (!hasClicked) return;
  //   if (
  //     environmentRef.current === null ||
  //     ALLOWED_ENVIRONMENTS[environmentRef.current] === 'p'
  //   )
  //     return;

  //   if (!isPlayingAudio && !isSpacePressed) {
  //     if (!isExperienceActive) {
  //       getExperienceList();
  //     }
  //   }
  // }, [
  //   getExperienceList,
  //   hasClicked,
  //   isExperienceActive,
  //   isPlayingAudio,
  //   isSpacePressed,
  // ]);

  useLayoutEffect(() => {
    if (!imagePatternRef.current) {
      const patternImage = new Image();
      patternImage.src = '/transparent-background.png';
      patternImage.style.opacity = '0.5';

      imagePatternRef.current = patternImage;
    }
  }, []);

  useLayoutEffect(() => {
    if (!isSpacePressed && !isPlayingAudio && !isExperienceActive) {
      restartIdleAnimation();
    } else {
      stopIdleAnimation();
    }
  }, [
    isExperienceActive,
    isPlayingAudio,
    isSpacePressed,
    restartIdleAnimation,
    stopIdleAnimation,
  ]);

  useLayoutEffect(() => {
    if (imagePatternRef.current) {
      const image = imagePatternRef.current;

      image.onload = () => {
        stopIdleAnimation();
        playIdleAnimation();
      };
    }
  }, [playIdleAnimation, stopIdleAnimation]);

  useEffect(() => {
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
    setInterval(
      () => {
        clientApi
          .get('/ping')
          .then(res => console.log('ping', res.data))
          .catch(err => console.log('ping error', err));
      },
      1000 * 60 * 10,
    );
  }, []);

  return (
    <div
      className={styles.Container}
      tabIndex={0}
      onKeyUp={handleKeyPress}
      onClick={() => setHasClicked(true)}
      onTouchMove={e => e.preventDefault()}>
      {/* {!!audioTranscript && (
        <div className={styles.Transcript}>
          <span key={audioTranscript} className={styles.TranscriptChunk}>
            {audioTranscript}
          </span>
        </div>
      )} */}
      {constrollRecord && (
        <div className={stylesAplication['recindicator']}>
          <div className={stylesAplication['record']}></div>
        </div>
      )}
      <audio ref={audioRef} src="../mp3/bip1.wav" />
      <audio ref={audioRefEnd} src="../mp3/bip2.wav" />
      {isExperienceActive &&
        !isPlayingAudio &&
        !hasEndedExperience &&
        currentEnvironment &&
        ALLOWED_ENVIRONMENTS[currentEnvironment] === 'p' && (
          <div className={styles.SpeakInstructionsContainer}>
            {isTouch ? (
              <button
                onClick={onToggleMicrophone}
                disabled={isPlayingAudio || hasEndedExperience}>
                {isRecordingMicrophone ? 'Parar de falar' : 'Falar'}
              </button>
            ) : (
              <span>
                {isSpacePressed
                  ? 'Solte a barra de espaço para parar de falar'
                  : 'Segure a barra de espaço para falar'}
              </span>
            )}
          </div>
        )}
      <div
        className={classNames(styles.CubeContainer, {
          [styles.CubeContainerHidden]: !isPlayingIdleAnimation,
        })}>
        <div className={styles.Cube}>
          <div className={classNames(styles.Face, styles.FaceTop)}>
            <NextImage
              priority
              width={900}
              height={600}
              src="/wecare.png"
              alt="We all care"
            />
          </div>
          <div className={classNames(styles.Face, styles.FaceFront)}>
            <NextImage
              priority
              width={900}
              height={600}
              src="/wecarebr.png"
              alt="A gente se importa"
            />
          </div>
          <div className={classNames(styles.Face, styles.FaceBottom)}>
            <NextImage
              priority
              width={900}
              height={600}
              src="/wecare.png"
              alt="We all care"
            />
          </div>
          <div className={classNames(styles.Face, styles.FaceBack)}>
            <NextImage
              priority
              width={900}
              height={600}
              src="/wecarebr.png"
              alt="A gente se importa"
            />
          </div>
        </div>
        <NextImage
          className={styles.Logo}
          priority
          alt="Banco do Brasil"
          src="/logo.png"
          width={96}
          height={96}
        />
        {errorMessage && (
          <span className={styles.ErrorMessage}>{errorMessage}</span>
        )}
        {!!currentEnvironment &&
          ALLOWED_ENVIRONMENTS[currentEnvironment] === 'p' && (
            <>
              <div className={styles.SelectWrapper}>
                <select
                  ref={languageRef}
                  defaultValue="ptbr"
                  required
                  disabled={isStartingExperience}>
                  <option value="" hidden disabled>
                    Selecione o Idioma
                  </option>
                  <option value="ptbr">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                </select>
              </div>
              <button
                className={styles.StartButton}
                onClick={() => onStartExperience()}
                disabled={isStartingExperience}>
                Iniciar Experiência
              </button>
            </>
          )}
      </div>
      <div
        className={classNames(styles.MicrophoneSelect, {
          [styles.MicrophoneSelectCollapsed]: microphoneSelectorCollapsed,
        })}
        onKeyDownCapture={preventSpacePropagation}>
        <select
          id="mic-select"
          onChange={e => setSelectedMic(e.target.value)}
          value={selectedMic}>
          {microphones.map(mic => (
            <option key={mic.deviceId} value={mic.deviceId}>
              {mic.label || `Microphone ${mic.deviceId}`}
            </option>
          ))}
        </select>
        <button onClick={() => setMicrophoneSelectorCollapsed(c => !c)}>
          {microphoneSelectorCollapsed ? '>' : '<'}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className={styles.Canvas}
        width={isTouch ? 750 : windowSize.width}
        height={isTouch ? 1312 : windowSize.height}
      />
    </div>
  );
}
