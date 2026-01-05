
import { SpotifyTrack } from '../types';

// NOTE: To use this in production, a Client ID must be registered at developer.spotify.com
const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID'; 
const REDIRECT_URI = window.location.origin;
const SCOPES = ['user-read-currently-playing', 'user-read-playback-state'];

export const getSpotifyAuthUrl = () => {
  return `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}`;
};

export const fetchCurrentTrack = async (token: string): Promise<SpotifyTrack | null> => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 204 || response.status > 400) return null;

    const data = await response.json();
    if (!data.item) return null;

    const trackId = data.item.id;
    
    // Fetch high-fidelity audio features for Morphic mapping
    const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    let energy = 0.5;
    let danceability = 0.5;
    let tempo = 120;

    if (featuresResponse.ok) {
      const features = await featuresResponse.json();
      energy = features.energy;
      danceability = features.danceability;
      tempo = features.tempo;
    }
    
    return {
      name: data.item.name,
      artist: data.item.artists[0].name,
      albumArt: data.item.album.images[0].url,
      energy: energy,
      danceability: danceability,
      tempo: tempo,
      progress_ms: data.progress_ms,
      duration_ms: data.item.duration_ms,
      isPlaying: data.is_playing
    };
  } catch (err) {
    console.error("Spotify Integration Error:", err);
    return null;
  }
};
