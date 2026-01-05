
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MilkPreset, ViewState, PresetAnalysis, VoiceState, MorphicSettings, MorphSource, SpotifyTrack } from './types';
import { parseMilkFile } from './services/milkParser';
import { analyzePreset, generateModernShader, imagineVisual, generateVideoPreview } from './services/geminiService';
import { startMicrophone, startAudioElement, stopAudioEngine, getAudioState } from './services/voiceEngine';
import { getSpotifyAuthUrl, fetchCurrentTrack } from './services/spotifyService';
import ShaderPreview from './components/ShaderPreview';

const MORPHIC_DEMO_SHADER = `
// Sophisticated Demo: Morphic Entity with Environmental Interactions
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // 1. ENVIRONMENTAL FLOW (uFlow)
    uv += vec2(sin(uTime * uFlow), cos(uTime * uFlow * 0.5)) * 0.1;

    // 2. SPATIAL PRESSURE (uVolume)
    float spatialPressure = 1.0 + uVolume * 0.8;
    uv *= spatialPressure;
    
    // 3. TURBULENCE (uTurbulence)
    float noise = sin(uv.x * 20.0 * uTurbulence + uTime) * sin(uv.y * 20.0 * uTurbulence + uTime) * 0.05;
    uv += noise;

    // 4. BEAT RHYTHM (uBeat)
    uv *= (1.0 - uBeat * 0.08);
    
    // 5. TOPOLOGICAL DISTORTION (uBass)
    float dist = length(uv);
    float bassWarp = sin(dist * (6.0 + uTurbulence * 10.0) - uTime * 0.5) * uBass * 0.15;
    uv += (uv / (dist + 0.001)) * bassWarp;
    
    // 6. ANGULAR TORQUE (uPitch)
    float angle = atan(uv.y, uv.x);
    angle += uPitch * 6.28 * sin(uTime * 0.2);
    uv = vec2(cos(angle), sin(angle)) * length(uv);
    
    // 7. SURFACE TENSION (uMid)
    uv.x += sin(uv.y * 12.0 + uTime) * uMid * 0.05;
    uv.y += cos(uv.x * 12.0 + uTime) * uMid * 0.05;
    
    // 8. FRACTAL EXCITATION (uTreble)
    float field = 0.0;
    float layers = (3.0 + floor(uTreble * 4.0)) * uFidelity;
    for(float i=1.0; i<16.0; i++) {
        if(i > layers) break;
        float strength = 0.08 / abs(sin(uTime * 0.1 + uv.x * i * 1.5 + uTreble * 2.0) * 1.5 + uv.y * i);
        field += strength;
    }
    
    // Color composition with uColorShift
    vec3 baseCol = vec3(0.05, 0.1, 0.2);
    float hue = uColorShift * 6.28 + dist;
    vec3 energyCol = 0.5 + 0.5 * cos(hue + vec3(0, 2, 4) + field);
    
    vec3 finalCol = mix(baseCol, energyCol, field * 0.6);
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
      <div className="flex bg-white/5 p-1 rounded-full border border-white/10 shadow-inner">
          {[
            { id: 'voice', label: 'MIC', color: 'bg-cyan-500' },
            { id: 'file', label: 'FILE', color: 'bg-orange-500' },
            { id: 'spotify', label: 'SPOTIFY', color: 'bg-[#1DB954]' }
          ].map(s => (
            <button 
              key={s.id}
              onClick={() => onSourceChange(s.id as MorphSource)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${activeSource === s.id ? `${s.color} text-black shadow-lg shadow-white/5` : 'text-white/40 hover:text-white/60'}`}
            >
              {s.label}
            </button>
          ))}
      </div>
      <div className="text-sm text-white/50 uppercase tracking-widest hidden lg:block font-medium">Evolution Suite</div>
    </div>
  </header>
);

const App: React.FC = () => {
  const [presets, setPresets] = useState<MilkPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, PresetAnalysis>>({});
  const [shaders, setShaders] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingShader, setIsGeneratingShader] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'analyzed' | 'shader'>('all');

  const [morphSource, setMorphSource] = useState<MorphSource>('voice');
  const [currentVoiceState, setCurrentVoiceState] = useState<VoiceState>({ volume: 0, pitch: 0, bass: 0, mid: 0, treble: 0, silence: true, beatIntensity: 0 });
  const morphLoopRef = useRef<number>(0);

  // Unified Morphic Settings
  const [morphicSettings, setMorphicSettings] = useState<MorphicSettings>({
    beat: { enabled: false, amplitude: 0.5, sensitivity: 1.0, decay: 0.94 },
    environment: { turbulence: 0.2, viscosity: 0.5, flow: 0.1 },
    visual: { colorShift: 0.0, fidelity: 1.0, globalIntensity: 1.0 }
  });

  const [settingsTab, setSettingsTab] = useState<'beat' | 'env' | 'vis'>('beat');
  const [activeTab, setActiveTab] = useState<'info' | 'shader' | 'json'>('info');

  const audioRef = useRef<HTMLAudioElement>(null);
  const [localAudioFile, setLocalAudioFile] = useState<{ name: string, url: string } | null>(null);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);

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
      setCurrentVoiceState(getAudioState(morphicSettings.beat));
      morphLoopRef.current = requestAnimationFrame(loop);
    };
    morphLoopRef.current = requestAnimationFrame(loop);
  }, [morphicSettings.beat]);

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
      if (spotifyToken) {
        startMorphing();
      }
    }
  };

  const handleLocalAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalAudioFile({ name: file.name, url });
      if (morphSource === 'file' && audioRef.current) {
        setTimeout(() => {
            if (audioRef.current) {
                startAudioElement(audioRef.current);
                startMorphing();
            }
        }, 100);
      }
    }
  };

  const handleSpotifyConnect = () => {
    window.location.href = getSpotifyAuthUrl();
  };

  useEffect(() => {
    if (!spotifyToken || morphSource !== 'spotify') return;
    const poll = async () => {
      const track = await fetchCurrentTrack(spotifyToken);
      if (track) {
        setCurrentTrack(track);
        // Calculate beat intensity using tempo and current progress
        const beatDuration = 60000 / (track.tempo || 120);
        const beatPhase = (track.progress_ms % beatDuration) / beatDuration;
        const pulse = Math.pow(Math.max(0, 1.0 - Math.abs(beatPhase - 0.5) * 2), 4);

        setCurrentVoiceState({
            volume: track.isPlaying ? track.energy : 0,
            pitch: track.danceability,
            bass: track.energy * 0.9,
            mid: track.energy * 0.6,
            treble: track.danceability * 0.4,
            silence: !track.isPlaying,
            beatIntensity: track.isPlaying ? pulse : 0
        });
      }
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [spotifyToken, morphSource]);

  useEffect(() => {
    return () => {
      stopAudioEngine();
      cancelAnimationFrame(morphLoopRef.current);
    };
  }, []);

  const handleFilesSelected = useCallback((files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (file.name.endsWith('.json')) {
          try {
            const data = JSON.parse(content);
            const presetsToLoad = data.presets ? data.presets : [data];
            
            presetsToLoad.forEach((p: any) => {
              const milkPreset: MilkPreset = {
                id: p.id || crypto.randomUUID(),
                name: p.name || 'Imported Entity',
                rawContent: p.rawContent || '',
                metadata: p.metadata || {},
                perFrame: p.perFrame || [],
                perPixel: p.perPixel || [],
                warps: p.warps || [],
                comp: p.comp || [],
                previewImageUrl: p.previewImageUrl,
                previewVideoUrl: p.previewVideoUrl
              };
              
              setPresets(prev => {
                if (prev.find(existing => existing.id === milkPreset.id)) return prev;
                return [...prev, milkPreset];
              });
              
              if (p.analysis) {
                setAnalysis(prev => ({ ...prev, [milkPreset.id]: p.analysis }));
              }
              if (p.shader) {
                setShaders(prev => ({ ...prev, [milkPreset.id]: p.shader }));
              }
            });
            
            if (presetsToLoad.length > 0) {
              setSelectedPresetId(presetsToLoad[0].id);
            }
          } catch (err) {
            console.error("Failed to parse JSON package", err);
            alert("Failed to load JSON package. Invalid format.");
          }
        } else {
          const milkPreset = parseMilkFile(content, file.name);
          setPresets(prev => [...prev, milkPreset]);
          if (!selectedPresetId) setSelectedPresetId(milkPreset.id);
        }
      };
      reader.readAsText(file);
    });
  }, [selectedPresetId]);

  const loadDemo = () => {
      const demoId = 'morphic-demo-id';
      const demo: MilkPreset = {
          id: demoId,
          name: 'Morphic Entity Demo',
          rawContent: '// Hand-crafted morphic entity logic\nper_frame_1=zoom=1.0+uVolume*0.2;\nper_pixel_1=rot=uPitch*0.5;',
          metadata: { vibe: 'Deep Topological Force Field' },
          perFrame: ['zoom = 1.0 + uVolume * 0.2', 'rot = uPitch * 0.5'],
          perPixel: [], warps: [], comp: []
      };
      setPresets(prev => [demo, ...prev]);
      setSelectedPresetId(demoId);
      setShaders(prev => ({ ...prev, [demoId]: MORPHIC_DEMO_SHADER }));
      setAnalysis(prev => ({ ...prev, [demoId]: {
          vibe: 'Topological Morphic Force',
          complexity: 'High',
          visualDescription: 'A study in geometric deformation. Sound acts as a direct continuous force field on a fluid topology.',
          dominantColors: ['#00ffcc', '#ff0088', '#2200ff'],
          modernShaderConcept: 'Force field UV displacement mapping'
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

  const exportPreset = (preset: MilkPreset) => {
    const packageData = {
      ...preset,
      analysis: analysis[preset.id] || null,
      shader: shaders[preset.id] || null,
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(packageData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `morphic_${preset.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
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
    downloadAnchorNode.setAttribute("download", `morphic_collection_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const updateBeat = (key: keyof MorphicSettings['beat'], val: any) => 
    setMorphicSettings(p => ({ ...p, beat: { ...p.beat, [key]: val } }));
  const updateEnv = (key: keyof MorphicSettings['environment'], val: any) => 
    setMorphicSettings(p => ({ ...p, environment: { ...p.environment, [key]: val } }));
  const updateVis = (key: keyof MorphicSettings['visual'], val: any) => 
    setMorphicSettings(p => ({ ...p, visual: { ...p.visual, [key]: val } }));

  return (
    <div className="min-h-screen pb-20 selection:bg-cyan-500/30">
      <Header activeSource={morphSource} onSourceChange={handleSourceChange} />
      
      <main className="max-w-[1400px] mx-auto px-6 py-10">
        {presets.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative w-24 h-24 mb-8 rounded-full bg-black flex items-center justify-center border border-white/10 shadow-2xl">
                      <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  </div>
              </div>
              <h2 className="text-4xl font-black mb-4 tracking-tight text-white">Awaken Legacy Visuals</h2>
              <p className="text-white/40 max-w-lg mb-10 text-lg font-light leading-relaxed">
                  Transform legacy .milk presets into high-fidelity morphic entities using AI-driven GLSL reconstruction.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                  <label className="cursor-pointer bg-white text-black px-10 py-4 rounded-full font-black hover:bg-cyan-400 transition-all active:scale-95 shadow-xl shadow-white/5">
                    SELECT MILK FILES
                    <input type="file" multiple accept=".milk,.json" className="hidden" onChange={(e) => e.target.files && handleFilesSelected(e.target.files)} />
                  </label>
                  <button onClick={loadDemo} className="px-10 py-4 rounded-full border border-white/20 font-black hover:bg-white/5 transition-all text-sm tracking-widest uppercase">
                      Try Morphic Demo
                  </button>
              </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sidebar Inventory */}
            <div className="lg:col-span-3 space-y-4 max-h-[calc(100vh-180px)] flex flex-col pr-2">
                {/* Active Morph Card */}
                <div className="glass p-5 rounded-3xl mb-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-20">
                        {morphSource === 'spotify' ? <svg className="w-8 h-8 text-[#1DB954]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-4h2v4zm4 0h-2V8h2v8z"/></svg> : morphSource === 'file' ? <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg> : <svg className="w-8 h-8 text-cyan-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Live Morph Source</div>
                    {morphSource === 'spotify' ? (
                        spotifyToken ? (
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/50 border border-white/10">
                                    {currentTrack?.albumArt ? <img src={currentTrack.albumArt} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#1DB954]"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-4h2v4zm4 0h-2V8h2v8z"/></svg></div>}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-bold truncate">{currentTrack?.name || 'Nothing playing'}</div>
                                    <div className="text-[10px] text-white/40 truncate uppercase font-bold tracking-tighter">{currentTrack?.artist || 'Waiting for sync'}</div>
                                </div>
                            </div>
                        ) : (
                            <button onClick={handleSpotifyConnect} className="w-full py-2 bg-[#1DB954] text-black text-[10px] font-black rounded-xl uppercase tracking-widest hover:brightness-110 transition-all">
                                Connect Spotify
                            </button>
                        )
                    ) : morphSource === 'file' ? (
                        <div className="space-y-4">
                            <div className="text-sm font-bold truncate pr-6">{localAudioFile?.name || 'No file selected'}</div>
                            <audio ref={audioRef} src={localAudioFile?.url} controls className="w-full h-8 brightness-75 contrast-125" onPlay={() => startMorphing()} />
                            <label className="block cursor-pointer border border-white/10 rounded-xl p-3 text-center hover:bg-white/5 transition-all text-[10px] font-bold uppercase text-white/40">
                                Select Audio
                                <input type="file" accept="audio/*" onChange={handleLocalAudioSelect} className="hidden" />
                            </label>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${currentVoiceState.silence ? 'bg-white/10' : 'bg-cyan-500 animate-pulse shadow-[0_0_10px_#22d3ee]'}`}></div>
                            <div className="text-sm font-bold uppercase tracking-tight text-white/60">
                                {currentVoiceState.silence ? 'Topology Locked' : 'Force Field Active'}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Inventory</h3>
                    <div className="flex gap-2">
                        <label className="text-[10px] font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-1 rounded cursor-pointer hover:bg-cyan-400/20 transition-all">ADD</label>
                        <button onClick={exportAllAsJson} className="text-[10px] font-black text-white/30 border border-white/5 px-2 py-1 rounded hover:bg-white/5 uppercase">Batch</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {filteredPresets.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPresetId(p.id); setActiveTab('info'); }} className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 relative group ${selectedPresetId === p.id ? 'bg-cyan-500/10 border-cyan-500/50 shadow-xl' : 'bg-white/5 border-transparent hover:border-white/20'}`}>
                            {selectedPresetId === p.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500"></div>}
                            <div className="font-bold mb-1 truncate text-sm group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{p.name}</div>
                            <div className="text-[9px] text-white/20 font-mono flex gap-3 uppercase font-bold tracking-widest">
                                <span className={analysis[p.id] ? "text-cyan-400/50" : ""}>{analysis[p.id] ? "Parsed" : "Raw"}</span>
                                <span className={shaders[p.id] ? "text-purple-400/50" : ""}>{shaders[p.id] ? "Entity" : "Static"}</span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="pt-4 px-1">
                    <label className="w-full cursor-pointer flex items-center justify-center gap-2 border border-white/10 rounded-xl py-3 text-[10px] font-black uppercase text-white/40 hover:bg-white/5 transition-all">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Load Package
                        <input type="file" multiple accept=".json" className="hidden" onChange={(e) => e.target.files && handleFilesSelected(e.target.files)} />
                    </label>
                </div>
            </div>

            {/* Main Stage */}
            <div className="lg:col-span-9 space-y-6">
              {selectedPreset ? (
                <div className="space-y-6 animate-in fade-in duration-700">
                  <div className="glass rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-8 flex flex-col xl:flex-row gap-10 items-center">
                        <div className="w-full xl:w-[480px] aspect-video bg-black/90 rounded-[2rem] overflow-hidden border border-white/10 relative shadow-inner group">
                            {shaders[selectedPreset.id] ? (
                                <ShaderPreview 
                                  shaderCode={shaders[selectedPreset.id]} 
                                  voiceState={currentVoiceState} 
                                  isActive={true} 
                                  settings={morphicSettings}
                                />
                            ) : selectedPreset.previewImageUrl ? (
                                <img src={selectedPreset.previewImageUrl} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" alt="Entity Preview" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/10 text-xs gap-4 font-black tracking-widest uppercase">
                                    <svg className="w-16 h-16 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                    <span>Dimensional Static</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-6">
                            <div>
                                <div className="text-[10px] font-black bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full uppercase tracking-widest w-fit mb-4 border border-cyan-500/20">Morphic Reconstructor</div>
                                <h2 className="text-5xl font-black mb-4 truncate text-white leading-none tracking-tighter uppercase">{selectedPreset.name}</h2>
                                <p className="text-white/40 font-light italic text-lg leading-relaxed line-clamp-2">
                                    {analysis[selectedPreset.id]?.visualDescription || "Awaiting AI interpretation of underlying mathematical structures..."}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 pt-4">
                                <button disabled={isAnalyzing} onClick={() => runAnalysis(selectedPreset)} className="bg-white/5 hover:bg-white text-white hover:text-black px-8 py-3 rounded-full text-xs font-black transition-all border border-white/10 flex items-center gap-3 tracking-widest uppercase shadow-lg shadow-white/5">
                                    {isAnalyzing ? <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full"></div> : "Analyze Structure"}
                                </button>
                                <button disabled={isGeneratingShader} onClick={() => runShaderGen(selectedPreset)} className="bg-cyan-500 hover:bg-cyan-400 text-black px-8 py-3 rounded-full text-xs font-black transition-all shadow-xl shadow-cyan-500/20 tracking-widest uppercase">
                                    {isGeneratingShader ? "Synthesizing..." : "Evolve Entity"}
                                </button>
                                <button onClick={() => exportPreset(selectedPreset)} className="bg-white/5 hover:bg-white/10 text-white/60 px-8 py-3 rounded-full text-xs font-black transition-all border border-white/10 tracking-widest uppercase">
                                    Export Entity
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex border-t border-white/5 px-8 bg-black/20">
                        {['info', 'shader', 'json'].map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-cyan-400' : 'text-white/20 hover:text-white/40'}`}>
                                {tab}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_-5px_15px_rgba(34,211,238,0.5)]"></div>}
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* Morphic Control Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-8 space-y-6">
                        {activeTab === 'info' && (
                            <div className="glass p-10 rounded-[2.5rem] space-y-10 animate-in slide-in-from-bottom-4 duration-700">
                                <div className="flex border-b border-white/5">
                                    {[
                                        { id: 'beat', label: 'Rhythmic Pulse', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                                        { id: 'env', label: 'Environmental Field', icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z' },
                                        { id: 'vis', label: 'Visual Palette', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' }
                                    ].map(t => (
                                        <button key={t.id} onClick={() => setSettingsTab(t.id as any)} className={`px-8 py-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${settingsTab === t.id ? 'border-cyan-500 text-white' : 'border-transparent text-white/20 hover:text-white/40'}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={t.icon}></path></svg>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                                    {settingsTab === 'beat' && (
                                        <>
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest"><span>Amplitude</span><span className="text-cyan-400">{morphicSettings.beat.amplitude.toFixed(2)}</span></div>
                                                <input type="range" min="0" max="2" step="0.01" value={morphicSettings.beat.amplitude} onChange={(e) => updateBeat('amplitude', parseFloat(e.target.value))} className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                                <p className="text-[10px] text-white/20 font-bold leading-tight">Strength of rhythmic spatial warping on bass hits.</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest"><span>Decay</span><span className="text-cyan-400">{morphicSettings.beat.decay.toFixed(2)}</span></div>
                                                <input type="range" min="0.8" max="0.99" step="0.01" value={morphicSettings.beat.decay} onChange={(e) => updateBeat('decay', parseFloat(e.target.value))} className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                                <p className="text-[10px] text-white/20 font-bold leading-tight">How long the rhythmic impression lingers in the field topology.</p>
                                            </div>
                                        </>
                                    )}
                                    {settingsTab === 'env' && (
                                        <>
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest"><span>Turbulence</span><span className="text-orange-400">{morphicSettings.environment.turbulence.toFixed(2)}</span></div>
                                                <input type="range" min="0" max="1" step="0.01" value={morphicSettings.environment.turbulence} onChange={(e) => updateEnv('turbulence', parseFloat(e.target.value))} className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                                <p className="text-[10px] text-white/20 font-bold leading-tight">Frequency of chaotic ripples throughout the force field.</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest"><span>Viscosity</span><span className="text-orange-400">{morphicSettings.environment.viscosity.toFixed(2)}</span></div>
                                                <input type="range" min="0" max="1" step="0.01" value={morphicSettings.environment.viscosity} onChange={(e) => updateEnv('viscosity', parseFloat(e.target.value))} className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                                <p className="text-[10px] text-white/20 font-bold leading-tight">Resistance of the field. Higher values result in slower, heavier morphs.</p>
                                            </div>
                                        </>
                                    )}
                                    {settingsTab === 'vis' && (
                                        <div className="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-8">
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest"><span>Global Intensity</span><span className="text-cyan-400">{morphicSettings.visual.globalIntensity.toFixed(2)}</span></div>
                                                <input type="range" min="0" max="2" step="0.01" value={morphicSettings.visual.globalIntensity} onChange={(e) => updateVis('globalIntensity', parseFloat(e.target.value))} className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                                <p className="text-[10px] text-white/20 font-bold leading-tight">Master multiplier for all audio-reactive morphing effects.</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest"><span>Spectral Shift</span><span className="text-purple-400">{morphicSettings.visual.colorShift.toFixed(2)}</span></div>
                                                <input type="range" min="0" max="1" step="0.01" value={morphicSettings.visual.colorShift} onChange={(e) => updateVis('colorShift', parseFloat(e.target.value))} className="w-full accent-purple-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                                <p className="text-[10px] text-white/20 font-bold leading-tight">Rotates the base hue of the energy field composition.</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest"><span>Visual Fidelity</span><span className="text-pink-400">{morphicSettings.visual.fidelity.toFixed(2)}</span></div>
                                                <input type="range" min="0.1" max="2" step="0.05" value={morphicSettings.visual.fidelity} onChange={(e) => updateVis('fidelity', parseFloat(e.target.value))} className="w-full accent-pink-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                                <p className="text-[10px] text-white/20 font-bold leading-tight">Geometric resolution and detail complexity of the morphic layers.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'shader' && (
                            <div className="glass p-8 rounded-[2.5rem] relative min-h-[500px] overflow-hidden">
                                {shaders[selectedPreset.id] ? (
                                    <pre className="mono text-[11px] leading-relaxed text-cyan-100/60 overflow-x-auto h-[440px] custom-scrollbar bg-black/30 p-6 rounded-2xl"><code>{shaders[selectedPreset.id]}</code></pre>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10">
                                        <p className="text-white/20 max-w-xs font-light tracking-wide italic">"Evolve the Entity to materialize the underlying GLSL structure."</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-4 space-y-6">
                        <div className="glass p-8 rounded-[2.5rem] space-y-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Field Integrity</h4>
                            <div className="flex justify-between items-end h-16 gap-1">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="flex-1 bg-gradient-to-t from-cyan-500/20 to-cyan-500/80 rounded-t-sm transition-all duration-75" style={{ height: `${currentVoiceState.silence ? 5 : (10 + Math.random() * currentVoiceState.volume * 90)}%` }}></div>
                                ))}
                            </div>
                            <div className="space-y-4 pt-4">
                                <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase"><span>Volume Pressure</span><span>{(currentVoiceState.volume * 100).toFixed(0)}%</span></div>
                                <div className="w-full h-1 bg-white/5 rounded-full"><div className="h-full bg-cyan-500 transition-all duration-100" style={{ width: `${currentVoiceState.volume * 100}%` }}></div></div>
                                <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase"><span>Pitch Torque</span><span>{(currentVoiceState.pitch * 100).toFixed(0)}%</span></div>
                                <div className="w-full h-1 bg-white/5 rounded-full"><div className="h-full bg-purple-500 transition-all duration-100" style={{ width: `${currentVoiceState.pitch * 100}%` }}></div></div>
                            </div>
                        </div>
                        <div className="glass p-8 rounded-[2.5rem] bg-gradient-to-br from-cyan-900/10 to-transparent">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-6">Presets Statistics</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between text-xs font-bold text-white/60"><span>Frame Logic</span><span>{selectedPreset.perFrame.length} ops</span></div>
                                <div className="flex justify-between text-xs font-bold text-white/60"><span>Pixel Logic</span><span>{selectedPreset.perPixel.length} ops</span></div>
                                <div className="flex justify-between text-xs font-bold text-white/60"><span>Warp Matrix</span><span>{selectedPreset.warps.length} layers</span></div>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[70vh] flex flex-col items-center justify-center glass rounded-[3rem] border-2 border-dashed border-white/5 p-12 text-center">
                    <div className="w-24 h-24 mb-6 rounded-full bg-white/5 flex items-center justify-center opacity-20">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-widest opacity-30">Selection Required</h3>
                    <p className="text-white/20 max-w-xs mx-auto text-sm mt-4 font-light italic">"Select a legacy preset from the inventory to initiate the evolution sequence."</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      
      <style>{`
        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 12px;
            width: 12px;
            border-radius: 50%;
            background: currentColor;
            cursor: pointer;
            box-shadow: 0 0 15px currentColor;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
