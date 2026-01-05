
import { GoogleGenAI, Type } from "@google/genai";
import { MilkPreset, PresetAnalysis, ChatMessage } from "../types";

const checkApiKeySelection = async () => {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
    }
  }
};

export const analyzePreset = async (preset: MilkPreset): Promise<PresetAnalysis> => {
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

  return JSON.parse(response.text || '{}');
};

export const generateModernShader = async (preset: MilkPreset): Promise<string> => {
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
    return response.text || '// Failed to generate shader code.';
};

export const chatWithGemini = async (messages: ChatMessage[]): Promise<string> => {
  await checkApiKeySelection();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    parts: [{ text: m.text }]
  }));
  
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: "You are the Morphic Assistant, an expert in procedural graphics, GLSL, and MilkDrop preset evolution. You help users understand mathematical art and how sound influences topology. Keep your tone sophisticated and helpful.",
    }
  });

  const lastMessage = messages[messages.length - 1].text;
  const response = await chat.sendMessage({ message: lastMessage });
  return response.text || "I am unable to respond at the moment.";
};

export const analyzeVideo = async (videoBase64: string, mimeType: string): Promise<string> => {
  await checkApiKeySelection();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: videoBase64, mimeType } },
        { text: "Analyze this video. What are the key visual elements, rhythmic patterns, and overall aesthetic themes? Provide a concise summary that could help in generating a procedural shader inspired by this video." }
      ]
    }
  });
  return response.text || "Analysis failed.";
};

export const animateImageWithVeo = async (imageBase64: string, mimeType: string, prompt: string, isPortrait: boolean): Promise<string> => {
  await checkApiKeySelection();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || 'A cinematic fluid animation of this image, morphing and flowing elegantly.',
      image: {
        imageBytes: imageBase64,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: isPortrait ? '9:16' : '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed");
    return `${downloadLink}&key=${process.env.API_KEY}`;
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.") && typeof window !== 'undefined' && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
    }
    throw error;
  }
};

export const imagineVisual = async (analysis: PresetAnalysis): Promise<string> => {
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

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateVideoPreview = async (analysis: PresetAnalysis): Promise<string> => {
  await checkApiKeySelection();
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
    return `${downloadLink}&key=${process.env.API_KEY}`;
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.") && typeof window !== 'undefined' && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
    }
    throw error;
  }
};
