
import { GoogleGenAI, Type } from "@google/genai";
import { MilkPreset, PresetAnalysis } from "../types";

const API_KEY = process.env.API_KEY || '';

export const analyzePreset = async (preset: MilkPreset): Promise<PresetAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
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

  return JSON.parse(response.text);
};

export const generateModernShader = async (preset: MilkPreset): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Convert this legacy MilkDrop (.milk) preset into a modern GLSL fragment shader.
        
        STRICT MORPHIC CONSTRAINTS:
        Your goal is to treat voice input as a CONTINUOUS FORCE FIELD that shapes geometry.
        
        AVAILABLE UNIFORMS:
        - uniform float uVolume; // Role: Global spatial pressure / UV scale.
        - uniform float uPitch;  // Role: Rotational torque / symmetry bending.
        - uniform float uBass;   // Role: Gravitational depth / heavy topological warping.
        - uniform float uMid;    // Role: Surface tension / fluid flow distortion.
        - uniform float uTreble; // Role: Fractal excitation / edge refinement.
        - uniform float uBeat;   // Role: Secondary rhythmic "pulse" deformation. Should be subtle.
        - uniform float uTime;   // Role: Chronological progression.
        - uniform vec2 uResolution;

        MANDATORY RULES:
        1. NO FLASHES: Never map volume, frequency, or beats to gl_FragColor.rgb brightness spikes.
        2. NO OPACITY SPIKES: No sudden alpha changes or strobe effects.
        3. GEOMETRIC PRIORITY: Use uniforms to displace UV coordinates or modulate distance fields.
        4. TOPOLOGICAL LOCK: If uTime is constant, the image must freeze in its current unique distorted form.
        5. MORPHIC CONTINUITY: Every change must be reversible and smooth. No hard resets.
        6. BEAT SECONDARY: uBeat should add a subtle rhythmic layer to the existing voice-morphic deformation.
        7. PRESERVE PERSONALITY: Modulate the original MilkDrop logic, don't replace it with generic visualizers.
        
        MilkDrop Logic to translate:
        ${preset.rawContent.slice(0, 3500)}`,
    });
    return response.text || '// Failed to generate shader code.';
};

export const imagineVisual = async (analysis: PresetAnalysis): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
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

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateVideoPreview = async (analysis: PresetAnalysis): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
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
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  return `${downloadLink}&key=${API_KEY}`;
};
