/// <reference types="vite/client" />
import { KeyboardEventHandler, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
// @ts-ignore
import styles from '../lib/chat/styles.module.css';
import { animateIdle } from '../lib/chat/utils';
import { FFT_SIZE } from '../lib/chat/const';
import startImg from '../assets/start.png';
import stylesAplication from '../components/style.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Campanha() {
  const { campanha } = useParams();
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
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

  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const isTouch = typeof window !== 'undefined' && (
    'ontouchstart' in window || (navigator as any)?.maxTouchPoints > 0
  );

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

  useEffect(() => {
    // focus to ensure keyboard events fire on the container
    containerRef.current?.focus();
  }, []);

  const handleKeyPress: KeyboardEventHandler<HTMLDivElement> = event => {
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      if (audioRef.current) {
        audioRef.current.play();
      }
    }
  };

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
        <canvas
          ref={canvasRef}
          className={styles.Canvas}
          width={isTouch ? 750 : windowSize.width}
          height={isTouch ? 1312 : windowSize.height}
        />
        <div
          className={stylesAplication.Center}
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