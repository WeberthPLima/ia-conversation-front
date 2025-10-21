import { MutableRefObject } from 'react';

import { COLORS, FFT_SIZE, PARTICLE_COLORS, SAMPLE_RATE } from './const';

import { WavStreamPlayer } from '../wavtools';

type Particle = {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speedX: number;
  speedY: number;
  directionX: number;
  directionY: number;
  color: string;
};

const getParticleColor = () => PARTICLE_COLORS[Math.floor(Math.random() * 3)];

function createParticles(
  numParticles: number,
  radius: number,
  speedMultiplier: number = 1,
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < numParticles; i++) {
    // Random angle and distance to position particles within the circle
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;

    particles.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: Math.random() * 9 + 5, // Random size between 1 and 5
      opacity: Math.random() * 0.5 + 0.5, // Opacity between 0.5 and 1
      speedX: (Math.random() - speedMultiplier) * 1, // Small random horizontal movement
      speedY: (Math.random() - speedMultiplier) * 1, // Small random vertical movement
      directionX: Math.random() > 0.5 ? 1 : -1,
      directionY: Math.random() > 0.5 ? 1 : -1,
      color: getParticleColor(),
    });
  }
  return particles;
}

function updateParticles(
  particles: Particle[],
  radius: number,
  speedMultiplier: number = 1,
  shouldEscape: boolean = false,
  opacity?: number,
) {
  particles.forEach(particle => {
    // Move particle randomly
    // TODO: Randomize the direction of the movement
    particle.x += particle.speedX * speedMultiplier * particle.directionX;
    particle.y += particle.speedY * speedMultiplier * particle.directionY;
    if (typeof opacity === 'number') {
      particle.opacity = opacity;
    }

    // Check if the particle is outside the circle and reset if necessary
    const distanceFromCenter = Math.sqrt(particle.x ** 2 + particle.y ** 2);
    if (
      distanceFromCenter > radius ||
      (shouldEscape && distanceFromCenter > radius * 2)
    ) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      particle.x = Math.cos(angle) * distance;
      particle.y = Math.sin(angle) * distance;
    }
  });
}

// Draw particles within the inner circle
function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  centerX: number,
  centerY: number,
) {
  particles.forEach(particle => {
    ctx.save();
    ctx.globalAlpha = particle.opacity;
    ctx.beginPath();
    ctx.arc(
      centerX + particle.x,
      centerY + particle.y,
      particle.size,
      0,
      Math.PI * 2,
    );
    ctx.closePath();
    ctx.fillStyle = particle.color;
    ctx.fill();
    ctx.restore();
  });
}

function scaleToRange(
  num: number,
  minInput: number,
  maxInput: number,
  minOutput: number = 0.8,
  maxOutput: number = 1.3,
) {
  num = Math.max(Math.min(num, maxInput), minInput);

  const scaledValue =
    minOutput +
    ((num - minInput) / (maxInput - minInput)) * (maxOutput - minOutput);

  return scaledValue;
}

function drawInnerCircleWithParticles(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  angle: number,
  particlesToUpdate: Particle[],
  scale: number = 1,
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.scale(scale, scale);

  // Draw particles floating inside the circle
  drawParticles(ctx, particlesToUpdate, 0, 0);

  ctx.restore();
}

const particlesLayer = createParticles(750, 300, 0.1);
let previousIdleTime = -1;
let timeIdleStopped = -1;
let timeIdleStarted = -1;
let previousCircleScale = 1;

export const drawVisualiser = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bufferLength: number,
  dataArray: Uint8Array,
  previousValues: number[],
  patternImage: HTMLImageElement,
  particles: Particle[],
  time: number = 0,
  idleTime: number = 0,
  isMobile: boolean = false,
) => {
  if (idleTime === 0 && previousIdleTime > 0) {
    timeIdleStopped = time;
  }

  if (idleTime === 0 && previousIdleTime === 0) {
    timeIdleStarted = time;
  }

  previousIdleTime = idleTime;

  let particlesAlpha: number | undefined = undefined;

  if (timeIdleStopped > 0 && time - timeIdleStopped < 70) {
    particlesAlpha = (time - timeIdleStopped) / 70;
  } else if (timeIdleStarted > 0 && time - timeIdleStarted < 50) {
    particlesAlpha = 1 - (time - timeIdleStarted) / 50;
  } else {
    timeIdleStopped = -1;
    timeIdleStarted = -1;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const barHeight = 1000;
  const restingDistance = isMobile ? 330 : 430;
  const maxDistance = isMobile ? 400 : 475;

  const smoothDataArray = [];
  for (let i = 0; i < bufferLength; i++) {
    const value = dataArray[i];
    smoothDataArray.push(value);

    const nextValue = dataArray[(i + 1) % bufferLength];
    for (let j = 1; j <= (isMobile ? 3 : 11); j++) {
      const interpolatedValue =
        value + ((nextValue - value) * j) / (isMobile ? 2 : 12);
      smoothDataArray.push(interpolatedValue);
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (idleTime === 0 || (timeIdleStarted > 0 && time - timeIdleStarted < 50)) {
    const maxVolumeValue = Math.max(...smoothDataArray);
    const minVolumeValue = Math.min(...smoothDataArray);
    const averageVolumeValue =
      smoothDataArray.reduce((acc, value) => acc + value, 0) /
      smoothDataArray.length;
    const circleScale = scaleToRange(
      averageVolumeValue,
      minVolumeValue,
      maxVolumeValue,
    );
    const angle1 = ((time / 2) * 0.601) % 360;
    drawInnerCircleWithParticles(
      ctx,
      centerX,
      centerY,
      angle1,
      particles,
      previousCircleScale * 0.9 + circleScale * 0.1,
    );
    previousCircleScale = circleScale;
    updateParticles(particles, 200, 0.5, idleTime === 0, particlesAlpha);
  }

  for (let i = 0; i < smoothDataArray.length; i++) {
    const angleStart = (i / 17) * Math.PI * 2 + 0.02;
    const angleEnd = ((i + 1) / 17) * Math.PI * 2 - 0.02;

    // Calculate wave offset for idle animation
    const waveAmplitude = 15; // How high/low each bar moves
    const waveSpeed = 0.02; // Speed of the wave effect
    const waveOffset = Math.sin(idleTime * waveSpeed + i * 0.5) * waveAmplitude;

    const currentValue = smoothDataArray[i];
    const smoothedValue = previousValues[i] * 0.8 + currentValue * 0.2;
    previousValues[i] = smoothedValue;

    // Apply the waveOffset to restingDistance to create the up-down effect
    const dynamicDistance =
      restingDistance +
      (smoothedValue / 127) * (maxDistance - restingDistance) +
      waveOffset;

    const radiusInner = dynamicDistance;
    const radiusOuter = radiusInner + barHeight;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(
      centerX + Math.cos(angleStart) * radiusInner,
      centerY + Math.sin(angleStart) * radiusInner,
    );
    ctx.arc(centerX, centerY, radiusOuter, angleStart, angleEnd);
    ctx.lineTo(
      centerX + Math.cos(angleEnd) * radiusInner,
      centerY + Math.sin(angleEnd) * radiusInner,
    );
    ctx.arc(centerX, centerY, radiusInner, angleEnd, angleStart, true);
    ctx.closePath();

    ctx.fillStyle = COLORS[i];
    ctx.fill();
    ctx.restore();

    // Overlay the pattern with transparency
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(
      centerX + Math.cos(angleStart) * radiusInner,
      centerY + Math.sin(angleStart) * radiusInner,
    );
    ctx.arc(centerX, centerY, radiusOuter, angleStart, angleEnd);
    ctx.lineTo(
      centerX + Math.cos(angleEnd) * radiusInner,
      centerY + Math.sin(angleEnd) * radiusInner,
    );
    ctx.arc(centerX, centerY, radiusInner, angleEnd, angleStart, true);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      patternImage,
      0,
      0,
      patternImage.width,
      patternImage.height,
      centerX - radiusOuter,
      centerY - radiusOuter,
      radiusOuter * 2,
      radiusOuter * 2,
    );

    ctx.restore();
  }
};

export const drawMicrophoneVisualiser = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bufferLength: number,
  dataArray: Uint8Array,
  previousValues: number[],
  patternImage: HTMLImageElement,
  particles: Particle[],
  time: number = 0, // Pass time as a parameter to control idle animation
  isMobile: boolean = false,
) => {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const barHeight = 1000;
  const restingDistance = isMobile ? 250 : 430;
  const maxDistance = 510;

  const smoothDataArray = [];
  for (let i = 0; i < bufferLength; i++) {
    const value = dataArray[i];
    smoothDataArray.push(value);

    const nextValue = dataArray[(i + 1) % bufferLength];
    for (let j = 1; j <= 11; j++) {
      const interpolatedValue = value + ((nextValue - value) * j) / 12;
      smoothDataArray.push(interpolatedValue);
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const averageVolumeValue =
    smoothDataArray.reduce((acc, value) => acc + value, 0) /
    smoothDataArray.length;

  drawInnerCircleWithParticles(
    ctx,
    centerX,
    centerY,
    ((time / 5) * 0.601) % 360,
    particles,
    scaleToRange(averageVolumeValue - 127, 0, 127, 0.95, 1.2),
  );
  updateParticles(
    particles,
    200,
    scaleToRange(averageVolumeValue - 127, 0, 127, 1, 5),
    true,
  );

  for (let i = 0; i < smoothDataArray.length; i++) {
    const angleStart = (i / 17) * Math.PI * 2 + 0.02;
    const angleEnd = ((i + 1) / 17) * Math.PI * 2 - 0.02;

    const currentValue = smoothDataArray[i];
    const smoothedValue = previousValues[i] * 0.8 + currentValue * 0.2;
    previousValues[i] = smoothedValue;

    // Apply the waveOffset to restingDistance to create the up-down effect
    const dynamicDistance =
      restingDistance + (smoothedValue / 127) * (maxDistance - restingDistance);

    const radiusInner = dynamicDistance;
    const radiusOuter = radiusInner + barHeight;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(
      centerX + Math.cos(angleStart) * radiusInner,
      centerY + Math.sin(angleStart) * radiusInner,
    );
    ctx.arc(centerX, centerY, radiusOuter, angleStart, angleEnd);
    ctx.lineTo(
      centerX + Math.cos(angleEnd) * radiusInner,
      centerY + Math.sin(angleEnd) * radiusInner,
    );
    ctx.arc(centerX, centerY, radiusInner, angleEnd, angleStart, true);
    ctx.closePath();

    ctx.fillStyle = COLORS[i];
    ctx.fill();
    ctx.restore();

    // Overlay the pattern with transparency
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(
      centerX + Math.cos(angleStart) * radiusInner,
      centerY + Math.sin(angleStart) * radiusInner,
    );
    ctx.arc(centerX, centerY, radiusOuter, angleStart, angleEnd);
    ctx.lineTo(
      centerX + Math.cos(angleEnd) * radiusInner,
      centerY + Math.sin(angleEnd) * radiusInner,
    );
    ctx.arc(centerX, centerY, radiusInner, angleEnd, angleStart, true);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      patternImage,
      0,
      0,
      patternImage.width,
      patternImage.height,
      centerX - radiusOuter,
      centerY - radiusOuter,
      radiusOuter * 2,
      radiusOuter * 2,
    );

    ctx.restore();
  }
};

let lastFrameTimeIdle = 0;
const fps = 30;

export function animateIdle(
  canvasObject: HTMLCanvasElement,
  patternImage: HTMLImageElement,
  previousValues: number[],
  animationFrameRef: MutableRefObject<number | null>,
  timeRef: MutableRefObject<number>,
  idleTime: number = 0,
  isMobile: boolean = false,
) {
  const ctx = canvasObject.getContext('2d');
  if (!ctx) return;

  const bufferLength = FFT_SIZE / 2;

  const dataArray = new Uint8Array(bufferLength);

  drawVisualiser(
    canvasObject,
    ctx,
    bufferLength,
    dataArray,
    previousValues,
    patternImage,
    particlesLayer,
    timeRef.current,
    idleTime,
    isMobile,
  );

  function throttledAnimate(time: number) {
    if (time - lastFrameTimeIdle < 1000 / fps) {
      animationFrameRef.current = requestAnimationFrame(throttledAnimate);
      return;
    }
    lastFrameTimeIdle = time;
    timeRef.current += 1;
    animateIdle(
      canvasObject,
      patternImage,
      previousValues,
      animationFrameRef,
      timeRef,
      idleTime + 1,
      isMobile,
    );
  }
  animationFrameRef.current = requestAnimationFrame(throttledAnimate);
}

let lastFrameTimeAnimate = 0;

// Modify your animate function to include a time parameter
export function animate(
  canvasObject: HTMLCanvasElement,
  analyser: AnalyserNode,
  bufferLength: number,
  dataArray: Uint8Array,
  previousValues: number[],
  patternImage: HTMLImageElement,
  animationFrameRef: MutableRefObject<number | null>,
  timeRef: MutableRefObject<number>,
  isMobile: boolean,
) {
  const ctx = canvasObject.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasObject.width, canvasObject.height);
  analyser.getByteFrequencyData(dataArray);
  drawVisualiser(
    canvasObject,
    ctx,
    bufferLength,
    dataArray,
    previousValues,
    patternImage,
    particlesLayer,
    timeRef.current,
    0,
    isMobile,
  );

  function throttledAnimate(time: number) {
    if (time - lastFrameTimeAnimate < 1000 / fps) {
      animationFrameRef.current = requestAnimationFrame(throttledAnimate);
      return;
    }
    lastFrameTimeAnimate = time;
    timeRef.current += 1;
    animate(
      canvasObject,
      analyser,
      bufferLength,
      dataArray,
      previousValues,
      patternImage,
      animationFrameRef,
      timeRef,
      isMobile,
    );
  }
  animationFrameRef.current = requestAnimationFrame(throttledAnimate);
}

let lastFrameTimeMicrophone = 0;

function animateMicrophone(
  canvasObject: HTMLCanvasElement,
  analyser: AnalyserNode,
  bufferLength: number,
  dataArray: Uint8Array,
  previousValues: number[],
  patternImage: HTMLImageElement,
  animationFrameRef: MutableRefObject<number | null>,
  timeRef: MutableRefObject<number>,
  isMobile: boolean,
) {
  const ctx = canvasObject.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasObject.width, canvasObject.height);
  analyser.getByteTimeDomainData(dataArray);

  drawMicrophoneVisualiser(
    canvasObject,
    ctx,
    bufferLength,
    dataArray,
    previousValues,
    patternImage,
    particlesLayer,
    timeRef.current,
    isMobile,
  );

  function throttledAnimate(time: number) {
    if (time - lastFrameTimeMicrophone < 1000 / fps) {
      animationFrameRef.current = requestAnimationFrame(throttledAnimate);
      return;
    }
    lastFrameTimeMicrophone = time;
    timeRef.current += 5;
    animateMicrophone(
      canvasObject,
      analyser,
      bufferLength,
      dataArray,
      previousValues,
      patternImage,
      animationFrameRef,
      timeRef,
      isMobile,
    );
  }
  animationFrameRef.current = requestAnimationFrame(throttledAnimate);
}

export const visualizeAudio = (
  canvas: HTMLCanvasElement,
  wavStreamPlayer: WavStreamPlayer,
  patternImage: HTMLImageElement,
  previousValues: number[],
  animationFrameRef: MutableRefObject<number | null>,
  animationTimeRef: MutableRefObject<number>,
  isMobile: boolean,
) => {
  const analyser = wavStreamPlayer.analyser;

  if (!analyser) return 0;

  analyser.fftSize = FFT_SIZE;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  animate(
    canvas,
    analyser,
    bufferLength,
    dataArray,
    previousValues,
    patternImage,
    animationFrameRef,
    animationTimeRef,
    isMobile,
  );
};

export const playAndVisualizeMicrophoneAudio = (
  canvas: HTMLCanvasElement,
  stream: MediaStream,
  patternImage: HTMLImageElement,
  previousValues: number[],
  animationFrameRef: MutableRefObject<number | null>,
  animationTimeRef: MutableRefObject<number>,
  isMobile: boolean,
) => {
  const audioContext = new AudioContext();
  const microphone = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  microphone.connect(analyser);

  animateMicrophone(
    canvas,
    analyser,
    bufferLength,
    dataArray,
    previousValues,
    patternImage,
    animationFrameRef,
    animationTimeRef,
    isMobile,
  );
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const applyFade = (buffer: Float32Array) => {
  const fadeDuration = 0.01; // fade duration in seconds
  const fadeSamples = Math.floor(fadeDuration * SAMPLE_RATE);

  // Fade in
  for (let i = 0; i < fadeSamples; i++) {
    buffer[i] *= i / fadeSamples;
  }

  // Fade out
  for (let i = buffer.length - fadeSamples; i < buffer.length; i++) {
    buffer[i] *= (buffer.length - i) / fadeSamples;
  }
};

export const decodePCM16Audio = async (
  audioContext: AudioContext,
  base64Data: string,
): Promise<AudioBuffer> => {
  // Convert base64 to ArrayBuffer
  const arrayBuffer = base64ToArrayBuffer(base64Data);
  const pcm16Array = new Int16Array(arrayBuffer);

  // Convert Int16Array to Float32Array
  const float32Array = new Float32Array(pcm16Array.length);
  for (let i = 0; i < pcm16Array.length; i++) {
    float32Array[i] = pcm16Array[i] / 32768;
  }

  // Apply fade to smooth transitions between chunks
  applyFade(float32Array);

  // Create an AudioBuffer and copy the Float32Array data into it
  const audioBuffer = audioContext.createBuffer(
    1,
    float32Array.length,
    SAMPLE_RATE,
  );
  audioBuffer.getChannelData(0).set(float32Array);

  return audioBuffer;
};

export async function convertWebMToPCMBase64(
  blob: Blob,
): Promise<string | null> {
  const audioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
  const arrayBuffer = await blob.arrayBuffer();

  try {
    // Decode audio data from WebM to AudioBuffer
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Extract PCM data from the AudioBuffer
    const pcmData = audioBuffer.getChannelData(0); // Get data from the first channel

    // Convert PCM Float32Array to Int16Array
    const int16Array = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      int16Array[i] = Math.max(-1, Math.min(1, pcmData[i])) * 32767;
    }

    // Encode Int16Array as a base64 string
    let binary = '';
    for (let i = 0; i < int16Array.length; i++) {
      binary += String.fromCharCode(
        int16Array[i] & 0xff,
        (int16Array[i] >> 8) & 0xff,
      );
    }
    return btoa(binary);
  } catch (error) {
    console.error('Error converting WebM to PCM:', error);
    return null;
  }
}

export async function convertMP4ToPCMBase64(
  blob: Blob,
): Promise<string | null> {
  const audioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });

  try {
    // Read the MP4 blob as an ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();

    // Decode MP4 (AAC) to AudioBuffer
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Extract PCM data from the AudioBuffer
    const pcmData = audioBuffer.getChannelData(0); // Use the first channel (mono)

    // Convert PCM Float32Array to Int16Array
    const int16Array = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      int16Array[i] = Math.max(-1, Math.min(1, pcmData[i])) * 32767; // Normalize to Int16 range
    }

    // Encode Int16Array to Base64
    let binary = '';
    for (let i = 0; i < int16Array.length; i++) {
      binary += String.fromCharCode(
        int16Array[i] & 0xff,
        (int16Array[i] >> 8) & 0xff,
      );
    }
    return btoa(binary);
  } catch (error) {
    console.error('Error converting MP4 to PCM:', error);
    return null;
  }
}
