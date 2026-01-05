
import { AudioFileAnalysis } from '../types';

/**
 * Analyzes an audio file to extract morphic parameters.
 * Uses an onset detection approach for tempo estimation and RMS for energy.
 */
export const analyzeAudioFile = async (file: File): Promise<AudioFileAnalysis> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  
  // 1. Estimate Energy (RMS)
  let sumSquares = 0;
  for (let i = 0; i < channelData.length; i++) {
    sumSquares += channelData[i] * channelData[i];
  }
  const rms = Math.sqrt(sumSquares / channelData.length);
  const energy = Math.min(1.0, rms * 5.0); // Scaled for normalization

  // 2. Simple Tempo Estimation (BPM)
  // We look for peaks in the amplitude envelope
  const bufferSize = 1024;
  const peaks: number[] = [];
  const threshold = rms * 1.5;
  
  for (let i = 0; i < channelData.length; i += bufferSize) {
    let max = 0;
    for (let j = 0; j < bufferSize && (i + j) < channelData.length; j++) {
      const val = Math.abs(channelData[i + j]);
      if (val > max) max = val;
    }
    if (max > threshold) {
      peaks.push(i / sampleRate);
    }
  }

  // Calculate average interval between peaks
  let tempo = 120;
  if (peaks.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const diff = peaks[i] - peaks[i - 1];
      if (diff > 0.3 && diff < 1.5) { // Filter realistic beat intervals (40-200 BPM)
        intervals.push(diff);
      }
    }
    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      tempo = 60 / avgInterval;
      // Clamp to reasonable ranges
      while (tempo < 70) tempo *= 2;
      while (tempo > 180) tempo /= 2;
    }
  }

  // 3. Spectral Profile (Simplified)
  // Higher value if signal has more high-freq change
  let spectralZeroCrossings = 0;
  for (let i = 1; i < channelData.length; i++) {
    if ((channelData[i] > 0 && channelData[i-1] <= 0) || (channelData[i] < 0 && channelData[i-1] >= 0)) {
      spectralZeroCrossings++;
    }
  }
  const spectralCentroid = spectralZeroCrossings / channelData.length;

  await audioContext.close();

  return {
    tempo,
    energy,
    rms,
    spectralCentroid: Math.min(1.0, spectralCentroid * 10.0)
  };
};
