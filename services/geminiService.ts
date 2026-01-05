
import { GoogleGenAI, Type } from "@google/genai";
import { MilkPreset, PresetAnalysis } from "../types";

// Removed global initialization to ensure fresh instances per call as per guidelines

export const analyzePreset = async (preset: MilkPreset): Promise<PresetAnalysis> => {
  // Always initialize right before use to ensure latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const codeSnippet = `
    Per Frame: ${preset.perFrame.slice(0, 10).join('\n')}
    Per Pixel: ${preset.perPixel.slice(0, 10).join('\n')}
    Warp: ${preset.warps.slice(0, 5).join('\n')}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this legacy MilkDrop (.milk) visualization code and describe its visual behavior. 
    Code snippet: ${codeSnippet}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vibe: { type: Type.STRING },
          complexity: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          visualDescription: { type: Type.STRING },
          dominantColors: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }
          },
          modernShaderConcept: { type: Type.STRING }
        },
        required: ["vibe", "complexity", "visualDescription", "dominantColors", "modernShaderConcept"]
      }
    }
  });

  // Use .text property directly, not as a method
  return JSON.parse(response.text || '{}');
};

export const generateModernShader = async (preset: MilkPreset): Promise<string> => {
    // Always initialize right before use
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Convert this legacy MilkDrop (.milk) preset into a modern GLSL fragment shader.
        
        STRICT MORPHIC CONSTRAINTS:
        Your goal is to treat voice/audio input as a CONTINUOUS FORCE FIELD that shapes geometry.
        
        AVAILABLE UNIFORMS:
        - uniform float uVolume;    // Global spatial pressure / UV scale.
        - uniform float uPitch;     // Rotational torque / symmetry bending.
        - uniform float uBass;      // Gravitational depth / heavy topological warping.
        - uniform float uMid;       // Surface tension / fluid flow distortion.
        - uniform float uTreble;    // Fractal excitation / edge refinement.
        - uniform float uBeat;      // Secondary rhythmic "pulse" deformation.
        - uniform float uTime;      // Chronological progression.
        - uniform vec2 uResolution;
        
        ENVIRONMENTAL UNIFORMS (Force Field Properties):
        - uniform float uTurbulence; // Noise scale / chaotic ripples.
        - uniform float uViscosity;  // Fluidity / tail length of motion.
        - uniform float uFlow;       // Continuous directional drift speed.
        - uniform float uColorShift; // Base color palette rotation.
        - uniform float uFidelity;  // Detail / complexity multiplier.

        MANDATORY RULES:
        1. NO FLASHES: Never map audio to direct brightness spikes.
        2. NO OPACITY SPIKES: Transitions must be geometric, not alpha-based.
        3. GEOMETRIC PRIORITY: Audio features MUST displace UV coordinates or modulate distance fields.
        4. TOPOLOGICAL LOCK: If uTime freezes (silence), the form must remain in its unique distorted state.
        5. ENVIRONMENTAL HARMONY: Use uTurbulence to add fine-grained wind-like or water-like surface noise.
        6. FIDELITY INTEGRATION: Use uFidelity to modulate loop iterations or fractal detail depth.
        7. PRESERVE PERSONALITY: The original MilkDrop preset's mathematical soul (spirals, mirrors, etc.) must be the foundation.
        
        MilkDrop Logic to translate:
        ${preset.rawContent.slice(0, 3500)}`,
    });
    // Use .text property directly
    return response.text || '// Failed to generate shader code.';
};

export const imagineVisual = async (analysis: PresetAnalysis): Promise<string> => {
  // Always initialize right before use
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `An abstract generative art piece inspired by these characteristics: 
          Vibe: ${analysis.vibe}. 
          Colors: ${analysis.dominantColors.join(', ')}. 
          Description: ${analysis.visualDescription}. 
          Style: High-end VJ loop aesthetic, glowing neon, mathematical geometry, digital art.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  // Iterate through parts to find the image part
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateVideoPreview = async (analysis: PresetAnalysis): Promise<string> => {
  // Guidelines: For Veo models, mandatory check for API key selection
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
    }
  }

  // Always initialize right before use to ensure latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `An abstract, morphing generative visualization. ${analysis.visualDescription}. Dominant colors: ${analysis.dominantColors.join(', ')}. Motion: Fluid, rhythmic, psychedelic.`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed");
    
    // Append API key when fetching from the download link as per guidelines
    return `${downloadLink}&key=${process.env.API_KEY}`;
  } catch (error: any) {
    // Guidelines: Reset key selection state if "Requested entity was not found."
    if (error.message?.includes("Requested entity was not found.") && typeof window !== 'undefined' && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
    }
    throw error;
  }
};
