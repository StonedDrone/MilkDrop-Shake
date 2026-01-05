
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MilkPreset, ViewState, PresetAnalysis, VoiceState, BeatSettings, MorphSource, SpotifyTrack } from './types';
import { parseMilkFile } from './services/milkParser';
import { analyzePreset, generateModernShader, imagineVisual, generateVideoPreview } from './services/geminiService';
import { startMicrophone, startAudioElement, stopAudioEngine, getAudioState } from './services/voiceEngine';
import { getSpotifyAuthUrl, fetchCurrentTrack } from './services/spotifyService';
import ShaderPreview from './components/ShaderPreview';

const MORPHIC_DEMO_SHADER = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // 1. SPATIAL PRESSURE (uVolume)
    float spatialPressure = 1.0 + uVolume * 0.8;
    uv *= spatialPressure;
    
    // 2. BEAT RHYTHM (uBeat)
    uv *= (1.0 - uBeat * 0.05);
    
    // 3. TOPOLOGICAL DISTORTION (uBass)
    float dist = length(uv);
    float bassWarp = sin(dist * 6.0 - uTime * 0.5) * uBass * 0.15;
    uv += (uv / (dist + 0.001)) * bassWarp;
    
    // 4. ANGULAR TORQUE (uPitch)
    float angle = atan(uv.y, uv.x);
    angle += uPitch * 6.28 * sin(uTime * 0.2);
    uv = vec2(cos(angle), sin(angle)) * length(uv);
    
    // 5. SURFACE TENSION (uMid)
    uv.x += sin(uv.y * 12.0 + uTime) * uMid * 0.05;
    uv.y += cos(uv.x * 12.0 + uTime) * uMid * 0.05;
    
    // 6. FRACTAL EXCITATION (uTreble)
    float field = 0.0;
    float layers = 4.0 + floor(uTreble * 3.0);
    for(float i=1.0; i<8.0; i++) {
        if(i > layers) break;
        float strength = 0.08 / abs(sin(uTime * 0.1 + uv.x * i * 1.5 + uTreble * 2.0) * 1.5 + uv.y * i);
        field += strength;
    }
    
    vec3 baseCol = vec3(0.05, 0.1, 0.2);
    vec3 energyCol = vec3(uBass * 0.5, uMid * 0.8, uTreble + 0.4);
    vec3 finalCol = mix(baseCol, energyCol, field * 0.5);
    
    finalCol *= smoothstep(1.5, 0.0, dist);
    fragColor = vec4(finalCol, 1.0);
}
`;

const Header: React.FC<{ activeSource: MorphSource, onSourceChange: (s: MorphSource) => void }> = ({ activeSource, onSourceChange }) => (
  <header className="py-6 px-6 border-b border-white/10 flex justify-between items-center bg-black/50 sticky top-0 z-50 backdrop-blur-md">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center font-bold text-black text-xl shadow-[0_0_15px_rgba(34,211,238,0.4)]">M</div>
      <h1 className="text-2xl font-bold tracking-tight">MilkDrop <span className="gradient-text">Morph</span></h1>
    </div>
    <div className="flex items-center gap-6">
      <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
          {[
            { id: 'voice', label: 'MIC', color: 'bg-cyan-500' },
            { id: 'file', label: 'FILE', color: 'bg-orange-500' },
            { id: 'spotify', label: 'SPOTIFY', color: 'bg-[#1DB954]' }
          ].map(s => (
            <button 
              key={s.id}
              onClick={() => onSourceChange(s.id as MorphSource)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${activeSource === s.id ? `${s.color} text-black shadow-lg shadow-white/10` : 'text-white/40 hover:text-white/60'}`}
            >
              {s.label}
            </button>
          ))}
      </div>
      <div className="text-sm text-white/50 uppercase tracking-widest hidden lg:block">Archive & Transform</div>
    </div>
  </header>
);

const EmptyState: React.FC<{ onFilesSelected: (files: FileList) => void, onLoadDemo: () => void }> = ({ onFilesSelected, onLoadDemo }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative w-24 h-24 mb-8 rounded-full bg-black flex items-center justify-center border border-white/10">
            <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
        </div>
    </div>
    <h2 className="text-4xl font-extrabold mb-4 tracking-tight">Modernize your legacy visuals</h2>
    <p className="text-white/60 max-w-lg mb-10 text-lg">
      Convert legacy .milk presets into high-fidelity JSON, modern GLSL shaders, or AI-imagined video clips.
    </p>
    <div className="flex flex-wrap gap-4 justify-center">
        <label className="cursor-pointer bg-cyan-500 text-black px-10 py-4 rounded-full font-black hover:bg-cyan-400 transition-all active:scale-95 shadow-lg shadow-cyan-500/20">
          SELECT MILK FILES
          <input 
            type="file" 
            multiple 
            accept=".milk" 
            className="hidden" 
            onChange={(e) => e.target.files && onFilesSelected(e.target.files)} 
          />
        </label>
        <button 
            onClick={onLoadDemo}
            className="px-10 py-4 rounded-full border border-white/20 font-black hover:bg-white/5 transition-all text-sm tracking-widest uppercase"
        >
            Try Morphic Demo
        </button>
    </div>
  </div>
);

const App: React.FC = () => {
  const [presets, setPresets] = useState<MilkPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, PresetAnalysis>>({});
  const [shaders, setShaders] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingShader, setIsGeneratingShader] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'shader' | 'json'>('info');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'analyzed' | 'shader'>('all');

  const [morphSource, setMorphSource] = useState<MorphSource>('voice');
  const [currentVoiceState, setCurrentVoiceState] = useState<VoiceState>({ volume: 0, pitch: 0, bass: 0, mid: 0, treble: 0, silence: true, beatIntensity: 0 });
  const morphLoopRef = useRef<number>(0);

  // File Source State
  const audioRef = useRef<HTMLAudioElement>(null);
  const [localAudioFile, setLocalAudioFile] = useState<{ name: string, url: string } | null>(null);

  // Spotify State
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);

  // Beat Settings
  const [beatSettings, setBeatSettings] = useState<BeatSettings>({
    enabled: false,
    amplitude: 0.5,
    sensitivity: 1.0,
    decay: 0.94
  });

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const token = new URLSearchParams(hash.substring(1)).get('access_token');
      if (token) {
        setSpotifyToken(token);
        setMorphSource('spotify');
        window.location.hash = '';
      }
    }
  }, []);

  const startMorphing = useCallback(() => {
    cancelAnimationFrame(morphLoopRef.current);
    const loop = () => {
      setCurrentVoiceState(getAudioState(beatSettings));
      morphLoopRef.current = requestAnimationFrame(loop);
    };
    morphLoopRef.current = requestAnimationFrame(loop);
  }, [beatSettings]);

  const handleSourceChange = async (source: MorphSource) => {
    stopAudioEngine();
    setMorphSource(source);

    if (source === 'voice') {
      try {
        await startMicrophone();
        startMorphing();
      } catch (err) {
        alert("Microphone access denied.");
      }
    } else if (source === 'file') {
      if (audioRef.current) {
        startAudioElement(audioRef.current);
        startMorphing();
      }
    } else if (source === 'spotify') {
      startMorphing();
    }
  };

  const handleLocalAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalAudioFile({ name: file.name, url });
      if (morphSource === 'file' && audioRef.current) {
        // Wait for state to catch up
        setTimeout(() => {
            if (audioRef.current) {
                startAudioElement(audioRef.current);
                startMorphing();
            }
        }, 100);
      }
    }
  };

  useEffect(() => {
    if (!spotifyToken || morphSource !== 'spotify') return;
    const poll = async () => {
      const track = await fetchCurrentTrack(spotifyToken);
      if (track) {
        setCurrentTrack(track);
        setCurrentVoiceState({
            volume: track.isPlaying ? track.energy : 0,
            pitch: track.danceability,
            bass: track.energy * 0.8,
            mid: track.energy * 0.6,
            treble: track.danceability * 0.4,
            silence: !track.isPlaying,
            beatIntensity: track.isPlaying ? (Math.sin(track.progress_ms / (60000 / track.tempo) * 3.14159) * 0.5 + 0.5) : 0
        });
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [spotifyToken, morphSource]);

  useEffect(() => {
    return () => {
      stopAudioEngine();
      cancelAnimationFrame(morphLoopRef.current);
    };
  }, []);

  const handleFilesSelected = useCallback((files: FileList) => {
    const readers: Promise<MilkPreset>[] = Array.from(files).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve(parseMilkFile(content, file.name));
        };
        reader.readAsText(file);
      });
    });

    Promise.all(readers).then(results => {
      setPresets(prev => [...prev, ...results]);
      if (results.length > 0 && !selectedPresetId) {
        setSelectedPresetId(results[0].id);
      }
    });
  }, [selectedPresetId]);

  const loadDemo = () => {
      const demoId = 'morphic-demo-id';
      const demo: MilkPreset = {
          id: demoId,
          name: 'Morphic Force Field (Demo)',
          rawContent: '// Hand-crafted morphic shader demo\nper_frame_1=zoom=1.0+uVolume*0.2;\nper_pixel_1=rot=uPitch*0.5;',
          metadata: { vibe: 'Structural Morphic Force' },
          perFrame: ['zoom = 1.0 + uVolume * 0.2', 'rot = uPitch * 0.5'],
          perPixel: [],
          warps: [],
          comp: []
      };
      setPresets(prev => [demo, ...prev]);
      setSelectedPresetId(demoId);
      setShaders(prev => ({ ...prev, [demoId]: MORPHIC_DEMO_SHADER }));
      setAnalysis(prev => ({ ...prev, [demoId]: {
          vibe: 'Morphic Force Field',
          complexity: 'High',
          visualDescription: 'A topological study of spatial pressure, bending geometry based on vocal pitch and intensity.',
          dominantColors: ['#0a2040', '#40e0ff', '#ff0080'],
          modernShaderConcept: 'UV displacement mapping driven by frequency EMA'
      }}));
      setActiveTab('shader');
  };

  const filteredPresets = useMemo(() => {
    return presets.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'analyzed' && !!analysis[p.id]) ||
        (statusFilter === 'shader' && !!shaders[p.id]);
      
      return matchesSearch && matchesStatus;
    });
  }, [presets, searchTerm, statusFilter, analysis, shaders]);

  const selectedPreset = useMemo(() => presets.find(p => p.id === selectedPresetId), [presets, selectedPresetId]);

  const runAnalysis = async (preset: MilkPreset) => {
    setIsAnalyzing(true);
    try {
      const res = await analyzePreset(preset);
      setAnalysis(prev => ({ ...prev, [preset.id]: res }));
    } catch (err) {
      alert("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runShaderGen = async (preset: MilkPreset) => {
    setIsGeneratingShader(true);
    try {
      const res = await generateModernShader(preset);
      setShaders(prev => ({ ...prev, [preset.id]: res }));
      setActiveTab('shader');
    } catch (err) {
      alert("Shader generation failed.");
    } finally {
      setIsGeneratingShader(false);
    }
  };

  const runImageGen = async (preset: MilkPreset) => {
    const currentAnalysis = analysis[preset.id];
    if (!currentAnalysis) return;
    setIsGeneratingImage(true);
    try {
      const url = await imagineVisual(currentAnalysis);
      setPresets(prev => prev.map(p => p.id === preset.id ? { ...p, previewImageUrl: url } : p));
    } catch (err) {
      alert("Image generation failed.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const runVideoGen = async (preset: MilkPreset) => {
    const currentAnalysis = analysis[preset.id];
    if (!currentAnalysis) return;
    setIsGeneratingVideo(true);
    try {
      const url = await generateVideoPreview(currentAnalysis);
      setPresets(prev => prev.map(p => p.id === preset.id ? { ...p, previewVideoUrl: url } : p));
    } catch (err) {
      alert("Video generation failed.");
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const exportAllAsJson = () => {
    const manifest = {
      timestamp: new Date().toISOString(),
      count: presets.length,
      presets: presets.map(p => ({
        ...p,
        analysis: analysis[p.id] || null,
        shader: shaders[p.id] || null
      }))
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(manifest, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `milkdrop_collection_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="min-h-screen pb-20">
      <Header 
        activeSource={morphSource} 
        onSourceChange={handleSourceChange} 
      />
      
      <main className="max-w-[1400px] mx-auto px-6 py-10">
        {presets.length === 0 ? (
          <EmptyState onFilesSelected={handleFilesSelected} onLoadDemo={loadDemo} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sidebar List */}
            <div className="lg:col-span-3 space-y-4 max-h-[calc(100vh-180px)] flex flex-col pr-2">
                
                {/* Source Specific Cards */}
                {morphSource === 'spotify' && (
                  <div className="bg-[#1DB954]/5 border border-[#1DB954]/20 p-4 rounded-2xl mb-2 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-black rounded-lg overflow-hidden shrink-0 border border-white/10">
                            {currentTrack?.albumArt ? <img src={currentTrack.albumArt} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#1DB954]"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-4h2v4zm4 0h-2V8h2v8z"/></svg></div>}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black text-[#1DB954] uppercase tracking-tighter">Spotify Morph</div>
                            <div className="text-xs font-bold text-white truncate">{currentTrack?.name || 'Nothing Playing'}</div>
                            <div className="text-[10px] text-white/40 truncate">{currentTrack?.artist || 'Unknown Artist'}</div>
                        </div>
                    </div>
                    {!spotifyToken ? (
                       <button onClick={() => window.location.href = getSpotifyAuthUrl()} className="mt-4 w-full bg-[#1DB954] text-black py-2 rounded-xl text-[10px] font-black uppercase hover:scale-[1.02] transition-transform">Link Spotify</button>
                    ) : (
                      <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1DB954] transition-all duration-1000" style={{ width: currentTrack ? `${(currentTrack.progress_ms / currentTrack.duration_ms) * 100}%` : '0%' }} />
                      </div>
                    )}
                  </div>
                )}

                {morphSource === 'file' && (
                  <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-2xl mb-2 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-black shadow-lg shadow-orange-500/20">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black text-orange-400 uppercase tracking-tighter">Audio Input Morph</div>
                            <div className="text-xs font-bold text-white truncate">{localAudioFile?.name || 'No file selected'}</div>
                        </div>
                    </div>
                    
                    <audio 
                        ref={audioRef} 
                        src={localAudioFile?.url} 
                        controls 
                        className="w-full h-8 opacity-80" 
                        onPlay={() => morphSource === 'file' && startMorphing()}
                    />
                    
                    <label className="mt-4 block cursor-pointer border-2 border-dashed border-white/10 rounded-xl p-4 text-center hover:bg-white/5 transition-all group">
                        <span className="text-[10px] font-bold text-white/40 group-hover:text-orange-400 transition-colors">DROP OR SELECT AUDIO</span>
                        <input type="file" accept="audio/*" onChange={handleLocalAudioSelect} className="hidden" />
                    </label>
                  </div>
                )}

                <div className="space-y-4 mb-6 px-1">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase tracking-widest text-white/40">Inventory</h3>
                        <div className="flex gap-2">
                            <label className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-1 rounded cursor-pointer hover:bg-cyan-400/20 transition-all uppercase">
                                Add
                                <input type="file" multiple accept=".milk" className="hidden" onChange={(e) => e.target.files && handleFilesSelected(e.target.files)} />
                            </label>
                            <button onClick={exportAllAsJson} className="text-[10px] font-bold text-white/60 border border-white/10 px-2 py-1 rounded hover:bg-white/5 transition-all uppercase">
                                Batch JSON
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Find preset..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-10 py-2.5 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                        />
                        <svg className="w-4 h-4 absolute left-3.5 top-3 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    {filteredPresets.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPresetId(p.id); setActiveTab('info'); }} className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${selectedPresetId === p.id ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-white/5 border-transparent hover:border-white/20'}`}>
                            {selectedPresetId === p.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500"></div>}
                            <div className="font-bold mb-1 truncate text-sm group-hover:text-cyan-400 transition-colors">{p.name}</div>
                            <div className="text-[10px] text-white/30 font-mono flex gap-3">
                                <span>{analysis[p.id] ? "● Analyzed" : `${p.perFrame.length} Frame`}</span>
                                <span>{shaders[p.id] ? "● Shader" : `${p.perPixel.length} Pixel`}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-9 space-y-6">
              {selectedPreset ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
                    <div className="p-8 flex flex-col md:flex-row gap-8 items-center">
                        <div className="w-full md:w-80 h-48 bg-black/50 rounded-3xl overflow-hidden border border-white/10 relative group shrink-0">
                            {shaders[selectedPreset.id] ? (
                                <ShaderPreview 
                                  shaderCode={shaders[selectedPreset.id]} 
                                  voiceState={currentVoiceState} 
                                  isActive={true} 
                                  beatAmplitude={beatSettings.amplitude}
                                />
                            ) : selectedPreset.previewImageUrl ? (
                                <img src={selectedPreset.previewImageUrl} className="w-full h-full object-cover" alt="Imagined" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/20 text-xs gap-3">
                                    <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    <span>No Preview</span>
                                </div>
                            )}
                            
                            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${currentVoiceState.silence ? 'bg-white/10 text-white/40' : 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/40'}`}>
                                    {currentVoiceState.silence ? 'TOPOLOGY LOCKED' : 'FORCE FIELD ACTIVE'}
                                </div>
                                <button 
                                    onClick={() => setBeatSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${beatSettings.enabled ? 'bg-purple-500 text-white shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                                >
                                    BEAT SENSITIVITY {beatSettings.enabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <h2 className="text-4xl font-black mb-4 truncate text-white leading-tight">{selectedPreset.name}</h2>
                            <div className="flex flex-wrap gap-2">
                                <button disabled={isAnalyzing} onClick={() => runAnalysis(selectedPreset)} className="bg-white/5 hover:bg-white/10 text-white px-5 py-2 rounded-full text-xs font-bold transition-all border border-white/10 flex items-center gap-2">
                                    {isAnalyzing && <div className="w-3 h-3 border border-white border-t-transparent animate-spin rounded-full"></div>}
                                    AI ANALYSIS
                                </button>
                                <button disabled={isGeneratingShader} onClick={() => runShaderGen(selectedPreset)} className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-5 py-2 rounded-full text-xs font-bold transition-all border border-cyan-500/20">
                                    TRANSFORM TO SHADER
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex border-t border-white/10 px-8">
                        {['info', 'shader', 'json'].map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-cyan-400' : 'text-white/40 hover:text-white/60'}`}>
                                {tab}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>}
                            </button>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {activeTab === 'info' && (
                        <div className="space-y-6">
                            {(morphSource === 'file' || morphSource === 'voice') && (
                                <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Morphic Control Parameters</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {['amplitude', 'sensitivity', 'decay'].map(setting => (
                                            <div key={setting} className="space-y-3">
                                                <div className="flex justify-between text-[10px] font-bold uppercase text-white/40">
                                                    <span>{setting}</span>
                                                    <span className="text-cyan-400">{(beatSettings as any)[setting].toFixed(2)}</span>
                                                </div>
                                                <input type="range" min={setting === 'decay' ? '0.8' : '0.1'} max={setting === 'sensitivity' ? '3' : '2'} step="0.01" value={(beatSettings as any)[setting]} onChange={(e) => setBeatSettings(prev => ({ ...prev, [setting]: parseFloat(e.target.value) }))} className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {analysis[selectedPreset.id] && (
                                <div className="bg-gradient-to-br from-cyan-900/10 to-transparent border border-cyan-500/10 p-10 rounded-[2.5rem] space-y-8">
                                    <div>
                                        <div className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-2">Visual Narrative</div>
                                        <h3 className="text-3xl font-black text-white leading-tight mb-4">{analysis[selectedPreset.id].vibe}</h3>
                                        <p className="text-lg text-white/60 leading-relaxed font-light italic">"{analysis[selectedPreset.id].visualDescription}"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'shader' && (
                        <div className="bg-black/50 border border-cyan-500/20 p-8 rounded-[2.5rem] relative min-h-[400px]">
                            {shaders[selectedPreset.id] ? (
                                <pre className="mono text-[11px] leading-relaxed text-cyan-100/80 overflow-x-auto"><code>{shaders[selectedPreset.id]}</code></pre>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                                    <p className="text-white/40 max-w-xs">No shader generated. Click "Transform to Shader" to convert the MilkDrop math.</p>
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-[70vh] flex flex-col items-center justify-center bg-white/5 rounded-[2.5rem] border-2 border-dashed border-white/10 p-12 text-center">
                    <h3 className="text-xl font-bold mb-2">No Preset Selected</h3>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
