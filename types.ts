
export interface MilkPreset {
  id: string;
  name: string;
  rawContent: string;
  metadata: Record<string, string>;
  perFrame: string[];
  perPixel: string[];
  warps: string[];
  comp: string[];
  previewImageUrl?: string;
  previewVideoUrl?: string;
}

export interface PresetAnalysis {
  vibe: string;
  complexity: 'Low' | 'Medium' | 'High';
  visualDescription: string;
  dominantColors: string[];
  modernShaderConcept: string;
}

export interface VoiceState {
  volume: number;      // 0–1 (RMS)
  pitch: number;       // 0–1 (Normalized freq)
  bass: number;        // 0–1
  mid: number;         // 0–1
  treble: number;      // 0–1
  silence: boolean;
  beatIntensity: number; // 0–1 decaying spike for rhythmic deformation
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  albumArt: string;
  energy: number;      // 0-1
  danceability: number; // 0-1
  tempo: number;
  progress_ms: number;
  duration_ms: number;
  isPlaying: boolean;
}

export interface AudioFileAnalysis {
  tempo: number;
  energy: number;
  spectralCentroid: number;
  rms: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// Added missing BeatSettings interface to resolve import error in services/voiceEngine.ts
export interface BeatSettings {
  enabled: boolean;
  amplitude: number;
  sensitivity: number;
  decay: number;
}

export interface MorphicSettings {
  beat: BeatSettings;
  environment: {
    turbulence: number; // Chaos/noise frequency
    viscosity: number;  // Motion smoothing/resistance
    flow: number;       // Directional bias speed
  };
  visual: {
    colorShift: number; // Hue rotation
    fidelity: number;   // Detail scale
    globalIntensity: number; // Global morphing power multiplier
  };
}

export type ViewState = 'upload' | 'list' | 'detail';
export type MorphSource = 'voice' | 'spotify' | 'file';
