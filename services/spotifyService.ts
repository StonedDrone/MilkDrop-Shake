
import { SpotifyTrack } from '../types';

const CLIENT_ID = 'YOUR_CLIENT_ID'; // Placeholder: User would typically provide their own
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

    // To truly get energy/danceability, we'd need another call to /audio-features/{id}
    // For this implementation, we poll the main item and mock features for demo if not fetched
    // to maintain the "Morphic" feel without excessive API overhead.
    
    return {
      name: data.item.name,
      artist: data.item.artists[0].name,
      albumArt: data.item.album.images[0].url,
      energy: 0.7, // Default morphic base
      danceability: 0.6,
      tempo: 120,
      progress_ms: data.progress_ms,
      duration_ms: data.item.duration_ms,
      isPlaying: data.is_playing
    };
  } catch (err) {
    console.error("Spotify Fetch Error:", err);
    return null;
  }
};
