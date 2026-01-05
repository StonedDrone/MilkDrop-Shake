
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

export interface BeatSettings {
  enabled: boolean;
  amplitude: number;    // Multiplier for uBeat
  sensitivity: number;  // Threshold for detection
  decay: number;        // Rate at which uBeat returns to 0
}

export type ViewState = 'upload' | 'list' | 'detail';
export type MorphSource = 'voice' | 'spotify' | 'file';
