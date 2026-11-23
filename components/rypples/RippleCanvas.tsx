"use client";
/**
 * The ripple (docs/02-design-system.md §9): a small WebGL height-field simulation.
 * Two ping-pong textures hold (height, previous height); damping 0.985 per step.
 * Float render targets when available, then half-float, then an RGBA8 packed encoding.
 * Lime at 12% over transparent, so it never obscures text. The parent mounts it only while
 * animating and unmounts it after ~1.6s; it never runs on page load.
 */
import { useEffect, useRef } from "react";

const DAMPING = 0.985;
const CELL_PX = 4; // simulation cell size in CSS pixels
const CROSS_SECONDS = 1.2; // time for the front to cross the panel diagonal
const SPEED = 0.7; // cells per step (stable below 1/sqrt2)

type Mode = "float" | "half" | "byte";

const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const COMMON = (mode: Mode) => `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
${
  mode === "byte"
    ? `float unp(vec2 c){ return ((c.x*255.0 + c.y)/255.0)*2.0 - 1.0; }
vec2 cur(vec2 uv){ vec4 t = texture2D(uState, uv); return vec2(unp(t.xy), unp(t.zw)); }
vec2 pk(float v){ float u = clamp(v,-1.0,1.0)*0.5+0.5; float hi = floor(u*255.0)/255.0; return vec2(hi, fract(u*255.0)); }
vec4 enc(float n, float c){ return vec4(pk(n), pk(c)); }`
    : `vec2 cur(vec2 uv){ return texture2D(uState, uv).xy; }
vec4 enc(float n, float c){ return vec4(n, c, 0.0, 1.0); }`
}`;

const STEP = (mode: Mode) => `${COMMON(mode)}
uniform vec2 uTexel; uniform vec2 uSize; uniform vec4 uImpulse;
void main(){
  vec2 c = cur(vUv);
  float s = cur(vUv+vec2(uTexel.x,0.0)).x + cur(vUv-vec2(uTexel.x,0.0)).x + cur(vUv+vec2(0.0,uTexel.y)).x + cur(vUv-vec2(0.0,uTexel.y)).x;
  float n = (s*0.5 - c.y) * ${DAMPING.toFixed(3)};
  vec2 p = (vUv - uImpulse.xy) * uSize;
  n += uImpulse.w * exp(-dot(p,p)/(uImpulse.z*uImpulse.z));
  ${mode === "byte" ? "if (abs(n) < 0.0003) n = 0.0;" : ""}
  gl_FragColor = enc(n, c.x);
}`;

const DRAW = (mode: Mode) => `${COMMON(mode)}
void main(){
  float h = cur(vUv).x;
  float a = 0.12 * clamp(abs(h) * 14.0, 0.0, 1.0);
  gl_FragColor = vec4(vec3(172.0, 207.0, 9.0)/255.0 * a, a);
}`;

type Target = { tex: WebGLTexture; fb: WebGLFramebuffer };

function makeTarget(gl: WebGLRenderingContext, w: number, h: number, type: number, init: ArrayBufferView | null): Target | null {
  const tex = gl.createTexture();
  const fb = gl.createFramebuffer();
  if (!tex || !fb) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, init);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE && gl.getError() === gl.NO_ERROR;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) {
    gl.deleteTexture(tex);
    gl.deleteFramebuffer(fb);
    return null;
  }
  return { tex, fb };
}

function program(gl: WebGLRenderingContext, frag: string): WebGLProgram | null {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const v = sh(gl.VERTEX_SHADER, VERT);
  const f = sh(gl.FRAGMENT_SHADER, frag);
  if (!v || !f) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

/** Cheap capability check so the parent can pick the no-canvas path before mounting. */
export function canRipple(): boolean {
  try {
    const c = document.createElement("canvas");
    const ok = !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    return ok;
  } catch {
    return false;
  }
}

export function RippleCanvas({ origin, onUnsupported }: { origin: { x: number; y: number }; onUnsupported?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext | null;
    if (!gl) {
      onUnsupported?.();
      return;
    }
    const cw = Math.max(1, canvas.clientWidth);
    const ch = Math.max(1, canvas.clientHeight);
    const scale = Math.max(CELL_PX, Math.max(cw, ch) / 256);
    const W = Math.max(8, Math.ceil(cw / scale));
    const H = Math.max(8, Math.ceil(ch / scale));
    canvas.width = W;
    canvas.height = H;

    // choose the best render-target format that actually works
    gl.getExtension("OES_texture_float");
    gl.getExtension("WEBGL_color_buffer_float");
    gl.getExtension("EXT_color_buffer_float");
    const half = gl.getExtension("OES_texture_half_float");
    gl.getExtension("EXT_color_buffer_half_float");
    let mode: Mode = "float";
    let a = makeTarget(gl, W, H, gl.FLOAT, null);
    let b = a && makeTarget(gl, W, H, gl.FLOAT, null);
    if (!a || !b) {
      mode = "half";
      a = half ? makeTarget(gl, W, H, half.HALF_FLOAT_OES, null) : null;
      b = a && half ? makeTarget(gl, W, H, half.HALF_FLOAT_OES, null) : null;
    }
    if (!a || !b) {
      mode = "byte";
      const init = new Uint8Array(W * H * 4);
      for (let i = 0; i < init.length; i += 4) init.set([127, 128, 127, 128], i);
      a = makeTarget(gl, W, H, gl.UNSIGNED_BYTE, init);
      b = makeTarget(gl, W, H, gl.UNSIGNED_BYTE, init);
    }
    const step = program(gl, STEP(mode));
    const draw = program(gl, DRAW(mode));
    if (!a || !b || !step || !draw) {
      onUnsupported?.();
      return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);

    const ox = Math.min(1, Math.max(0, origin.x / cw));
    const oy = 1 - Math.min(1, Math.max(0, origin.y / ch));
    const diagCells = Math.hypot(W, H);
    const stepsPerSecond = diagCells / (SPEED * CROSS_SECONDS);
    let read = a;
    let write = b;
    let impulse = true;

    const runStep = () => {
      gl.useProgram(step);
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
      gl.viewport(0, 0, W, H);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      gl.uniform1i(gl.getUniformLocation(step, "uState"), 0);
      gl.uniform2f(gl.getUniformLocation(step, "uTexel"), 1 / W, 1 / H);
      gl.uniform2f(gl.getUniformLocation(step, "uSize"), W, H);
      gl.uniform4f(gl.getUniformLocation(step, "uImpulse"), ox, oy, 2.5, impulse ? 0.9 : 0);
      impulse = false;
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      [read, write] = [write, read];
    };

    let raf = 0;
    let last = performance.now();
    let acc = 1; // run the impulse step on the first frame
    const frame = (now: number) => {
      acc = Math.min(acc + ((now - last) / 1000) * stepsPerSecond, 24);
      last = now;
      while (acc >= 1) {
        runStep();
        acc -= 1;
      }
      gl.useProgram(draw);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      gl.uniform1i(gl.getUniformLocation(draw, "uState"), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      gl.deleteTexture(a!.tex);
      gl.deleteTexture(b!.tex);
      gl.deleteFramebuffer(a!.fb);
      gl.deleteFramebuffer(b!.fb);
      gl.deleteProgram(step);
      gl.deleteProgram(draw);
      gl.deleteBuffer(buf);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // origin is fixed for the lifetime of one mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} data-ripple="mounted" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
