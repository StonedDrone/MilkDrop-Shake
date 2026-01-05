
import { VoiceState, BeatSettings } from '../types';

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
let stream: MediaStream | null = null;

const state: VoiceState = {
  volume: 0,
  pitch: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  silence: true,
  beatIntensity: 0,
};

// Morphic inertia constants for the Force Field
const SMOOTH_ACCUM = 0.04; 
const SMOOTH_DECAY = 0.02; 

let lastBassEnergy = 0;
let beatTimer = 0;

const ensureContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }
};

export const startMicrophone = async (): Promise<void> => {
  ensureContext();
  if (sourceNode) sourceNode.disconnect();
  
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  sourceNode = audioContext!.createMediaStreamSource(stream);
  sourceNode.connect(analyser!);
};

export const startAudioElement = (element: HTMLAudioElement): void => {
  ensureContext();
  if (sourceNode) sourceNode.disconnect();
  
  sourceNode = audioContext!.createMediaElementSource(element);
  sourceNode.connect(analyser!);
  sourceNode.connect(audioContext!.destination);
};

export const stopAudioEngine = (): void => {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  // Keep context alive for subsequent source switching
};

const applyMorphicSmoothing = (current: number, target: number): number => {
  const factor = target > current ? SMOOTH_ACCUM : SMOOTH_DECAY;
  return current + (target - current) * factor;
};

export const getAudioState = (beatSettings: BeatSettings): VoiceState => {
  if (!analyser || !dataArray) return { ...state, silence: true };

  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  let bass = 0;
  let mid = 0;
  let treble = 0;
  let peakFreq = 0;
  let peakVal = 0;

  const len = dataArray.length;
  const bEnd = Math.floor(len * 0.1);
  const mEnd = Math.floor(len * 0.4);

  for (let i = 0; i < len; i++) {
    const val = dataArray[i] / 255;
    sum += val;
    if (val > peakVal) {
      peakVal = val;
      peakFreq = i;
    }
    if (i < bEnd) bass += val;
    else if (i < mEnd) mid += val;
    else treble += val;
  }

  const rawVol = sum / len;
  // Morphic Principle: Lower threshold for "Topology Lock"
  const isSilent = rawVol < 0.005; 
  const rawBass = bass / bEnd;

  if (beatSettings.enabled) {
    const energyDiff = rawBass - lastBassEnergy;
    if (energyDiff > (0.4 / beatSettings.sensitivity) && performance.now() - beatTimer > 200) {
      state.beatIntensity = 1.0;
      beatTimer = performance.now();
    }
    state.beatIntensity *= beatSettings.decay;
  } else {
    state.beatIntensity = 0;
  }
  lastBassEnergy = rawBass;

  state.volume = applyMorphicSmoothing(state.volume, rawVol);
  state.bass = applyMorphicSmoothing(state.bass, rawBass);
  state.mid = applyMorphicSmoothing(state.mid, mid / (mEnd - bEnd));
  state.treble = applyMorphicSmoothing(state.treble, treble / (len - mEnd));
  state.pitch = applyMorphicSmoothing(state.pitch, peakFreq / len);
  state.silence = isSilent;

  return { ...state };
};
