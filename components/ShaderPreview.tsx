
import React, { useEffect, useRef } from 'react';
import { VoiceState } from '../types';

interface ShaderPreviewProps {
  shaderCode: string;
  voiceState: VoiceState;
  isActive: boolean;
  beatAmplitude: number;
}

const ShaderPreview: React.FC<ShaderPreviewProps> = ({ shaderCode, voiceState, isActive, beatAmplitude }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current || !isActive) return;

    const gl = canvasRef.current.getContext('webgl', { antialias: true });
    if (!gl) return;

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vsSource = `
      attribute vec4 position;
      void main() {
        gl_Position = position;
      }
    `;

    const fsSource = `
      precision highp float;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform float uVolume;
      uniform float uPitch;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uBeat;

      #define iTime uTime
      #define iResolution vec3(uResolution, 1.0)
      
      ${shaderCode.includes('void mainImage') ? shaderCode : `
        void mainImage(out vec4 fragColor, in vec2 fragCoord) {
            vec2 uv = fragCoord/iResolution.xy;
            fragColor = vec4(uv.x, uv.y, 0.5 + 0.5*sin(iTime), 1.0);
        }
      `}

      void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uLoc = {
      time: gl.getUniformLocation(program, 'uTime'),
      res: gl.getUniformLocation(program, 'uResolution'),
      vol: gl.getUniformLocation(program, 'uVolume'),
      pit: gl.getUniformLocation(program, 'uPitch'),
      bas: gl.getUniformLocation(program, 'uBass'),
      mid: gl.getUniformLocation(program, 'uMid'),
      tre: gl.getUniformLocation(program, 'uTreble'),
      beat: gl.getUniformLocation(program, 'uBeat'),
    };

    let lastTime = performance.now();
    const render = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // TOPOLOGICAL LOCK: Suspend time progression during silence
      if (!voiceState.silence) {
        timeRef.current += dt; 
      }

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uLoc.time, timeRef.current);
      gl.uniform2f(uLoc.res, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(uLoc.vol, voiceState.volume);
      gl.uniform1f(uLoc.pit, voiceState.pitch);
      gl.uniform1f(uLoc.bas, voiceState.bass);
      gl.uniform1f(uLoc.mid, voiceState.mid);
      gl.uniform1f(uLoc.tre, voiceState.treble);
      gl.uniform1f(uLoc.beat, voiceState.beatIntensity * beatAmplitude);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.clientWidth;
        canvasRef.current.height = canvasRef.current.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', handleResize);
      gl.deleteProgram(program);
    };
  }, [shaderCode, isActive, voiceState, beatAmplitude]);

  return <canvas ref={canvasRef} className="w-full h-full rounded-3xl" />;
};

export default ShaderPreview;
