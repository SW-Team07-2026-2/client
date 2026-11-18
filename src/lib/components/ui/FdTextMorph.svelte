<script lang="ts">
	import { onMount, tick } from 'svelte';

	export type TextMorphMode = 'liquid' | 'blur';
	export type TextMorphAlign = 'left' | 'center' | 'right';
	export type TextMorphStaggerFrom = 'start' | 'end' | 'center' | 'edges' | 'random';
	export type TextMorphTrigger = 'auto' | 'hover' | 'click' | 'manual';

	export interface Props {
		/** 순서대로 모핑할 단어 또는 짧은 문구 목록 */
		words?: string[];
		/** 글자가 변하는 방식: liquid는 이전 글자가 얇아져 사라지고 새 글자가 자라나며, blur는 포커스가 흐려졌다 선명해집니다. 공통 글자는 두 모드 모두 새 위치로 미끄러지듯 이동합니다. */
		morph?: TextMorphMode;
		/** 텍스트 색상 (기본값 currentColor는 주변 텍스트 색상 상속) */
		color?: string;
		/** 모핑 도중 글자가 거쳐가는 색상 */
		morphColor?: string;
		/** morphColor 색상이 섞이는 강도 (0 ~ 1) */
		tint?: number;
		/** 가장 긴 단어 폭 안에서 짧은 단어가 정렬되는 위치 */
		align?: TextMorphAlign;
		/** 폰트 패밀리 (미지정 시 주변 텍스트 상속) */
		fontFamily?: string;
		/** 폰트 크기 px (미지정 시 상속) */
		fontSize?: number;
		/** 폰트 굵기 (미지정 시 상속) */
		fontWeight?: number | string;
		/** 자간 em 단위 (미지정 시 상속) */
		letterSpacing?: number;
		/** auto 모드에서 다음 모핑까지의 간격 (초) */
		interval?: number;
		/** 첫 글자부터 마지막 글자까지 모핑이 진행되는 전체 시간 (초) */
		duration?: number;
		/** 단어 전체에 변화가 물결치듯 퍼지는 정도 (0: 동시에, 최대 0.9) */
		stagger?: number;
		/** 물결(Stagger)이 시작되는 위치 */
		staggerFrom?: TextMorphStaggerFrom;
		/** 변하는 글자가 다음 단어의 위치 쪽으로 이동(드리프트)하는 정도 (0 ~ 1) */
		travel?: number;
		/** 글자들이 서로 스쳐 지나갈 때 융합되는 거리 (em 단위) */
		goo?: number;
		/** 모핑 중간에 글자가 일시적으로 불어나는 추가 두께 (em 단위) */
		swell?: number;
		/** 모핑 중 글자가 둥글어지는 정도 (blur 모드에서는 블러 강도, 0 ~ 1) */
		softness?: number;
		/** 사라지는 글자가 커지고 나타나는 글자가 자리잡는 스케일 변화량 */
		scale?: number;
		/** 트리거 방식 ('manual' 또는 기본 상태에서 ref의 next/goTo로 직접 제어 가능) */
		trigger?: TextMorphTrigger;
		/** 마지막 단어 이후 다시 첫 단어로 순환할지 여부 */
		loop?: boolean;
		/** 처음 나타날 때 첫 단어가 무(0)에서 자라나는 인트로 효과 여부 */
		intro?: boolean;
		/** 화면(뷰포트)에 들어올 때까지 시작을 대기할지 여부 */
		startOnView?: boolean;
		/** 마우스를 올렸을 때 자동 타이머 일시정지 여부 */
		pauseOnHover?: boolean;
		/** 타이머 모핑 일시정지 여부 */
		paused?: boolean;
		/** 렌더링 스케일 품질 (0.5 ~ 1) */
		quality?: number;
		/** 초기 표시할 단어 인덱스 (기본값 0) */
		initialIndex?: number;
		/** 각 모핑이 완료될 때 호출되는 콜백 */
		onChange?: (word: string, index: number) => void;
		/** 래퍼 추가 클래스 */
		class?: string;
		/** React 호환용 className 별칭 */
		className?: string;
		/** 래퍼 인라인 스타일 문자열 */
		style?: string;
	}

	let {
		words = ['Imagine', 'Create', 'Launch'],
		morph = 'liquid',
		color = 'currentColor',
		morphColor = '#8B5CF6',
		tint = 0.3,
		align = 'center',
		fontFamily = undefined,
		fontSize = undefined,
		fontWeight = undefined,
		letterSpacing = undefined,
		interval = 2.6,
		duration = 1.1,
		stagger = 0.25,
		staggerFrom = 'start',
		travel = 0.5,
		goo = 0.1,
		swell = 0.02,
		softness = 0.8,
		scale = 0.04,
		trigger = 'manual',
		loop = true,
		intro = false,
		startOnView = true,
		pauseOnHover = false,
		paused = false,
		quality = 1,
		initialIndex = 0,
		onChange = undefined,
		class: klass = '',
		className = '',
		style = ''
	}: Props = $props();

	let cleanWords = $derived(
		(Array.isArray(words) ? words : []).filter((w) => typeof w === 'string' && w.trim().length > 0)
	);

	let spanEl: HTMLSpanElement | undefined = $state();

	interface Controller {
		sync: () => void;
		next: () => void;
		goTo: (idx: number) => void;
		destroy: () => void;
	}

	let ctrlRef: Controller | null = null;

	const VERT_SHADER = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

	const buildLoopBlock = (tag: string, rowOffset: number, innerBody: string) => `
  for (int i = 0; i < 64; i++) {
    if (i >= uCount${tag}) break;
    vec4 r = uRect${tag}[i];
    vec2 q = (p - r.xy) / r.zw;
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) continue;
    vec4 m = texelFetch(uGlyphs, ivec2(i, ${rowOffset}), 0);
    vec4 g = texelFetch(uGlyphs, ivec2(i, ${rowOffset + 1}), 0);
    vec2 f = textureLod(uAtlas${tag}, m.xy + q * m.zw, 0.0).rg;
    ${innerBody}
  }
`;

	const buildLiquidBody = (tag: string) => `
    float v = mix(f.r, f.g, g.y) * g.x + g.z;
    d${tag} = min(d${tag}, v);
    float k = exp(-max(v, 0.0) / uBand);
    w${tag} += k;
    a${tag} += k * g.w;
`;

	const BLUR_BODY = `
    float v = f.r * g.x;
    float e = 0.7 * uPixel + g.y;
    float c = (1.0 - smoothstep(-e, e, v)) * g.z;
    keep *= 1.0 - c;
    wsum += c;
    asum += c * g.w;
`;

	const FRAG_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uAtlasA;
uniform sampler2D uAtlasB;
uniform sampler2D uGlyphs;
uniform vec4 uRectA[64];
uniform vec4 uRectB[64];
uniform int uCountA;
uniform int uCountB;
uniform int uMode;
uniform float uCap;
uniform float uGoo;
uniform float uSwell;
uniform float uBand;
uniform float uPixel;
uniform vec2 uSize;
uniform vec3 uInk;
uniform float uInkAlpha;
uniform vec3 uTint;
uniform float uTintAmount;

in vec2 vUv;
out vec4 fragColor;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float alpha = 0.0;
  float act = 0.0;
  if (uMode == 1) {
    float keep = 1.0;
    float wsum = 0.0;
    float asum = 0.0;
    ${buildLoopBlock('A', 0, BLUR_BODY)}
    ${buildLoopBlock('B', 2, BLUR_BODY)}
    alpha = 1.0 - keep;
    act = wsum > 0.0 ? asum / wsum : 0.0;
  } else {
    float dA = uCap;
    float wA = 0.0;
    float aA = 0.0;
    float dB = uCap;
    float wB = 0.0;
    float aB = 0.0;
    ${buildLoopBlock('A', 0, buildLiquidBody('A'))}
    ${buildLoopBlock('B', 2, buildLiquidBody('B'))}
    aA = wA > 0.0 ? aA / wA : 0.0;
    aB = wB > 0.0 ? aB / wB : 0.0;
    act = mix(aA, aB, smoothstep(-uBand, uBand, dA - dB));
    float d = smin(dA, dB, max(uGoo * act, 0.0001)) - uSwell * act;
    float aa = max(fwidth(d), 0.0001) * 0.38;
    alpha = clamp(0.5 - d / (2.0 * aa), 0.0, 1.0);
  }
  vec3 color = mix(uInk, uTint, clamp(uTintAmount * act * act, 0.0, 1.0));
  float coverage = alpha * uInkAlpha;
  fragColor = vec4(color * coverage, coverage);
}
`;

	const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
	const finiteOr = (val: unknown, fallback: number) =>
		typeof val === 'number' && Number.isFinite(val) ? val : fallback;
	const smoothstep = (e0: number, e1: number, x: number) => {
		const t = clamp((x - e0) / (e1 - e0), 0, 1);
		return t * t * (3 - 2 * t);
	};

	const floatView = new Float32Array(1);
	const int32View = new Int32Array(floatView.buffer);

	function toHalfFloat(val: number): number {
		floatView[0] = val;
		const x = int32View[0];
		let bits = (x >> 16) & 0x8000;
		let m = (x >> 12) & 0x07ff;
		const e = (x >> 23) & 0xff;
		if (e < 103) return bits;
		if (e > 142) {
			bits |= 0x7c00;
			bits |= (e === 255 ? 0 : 1) && x & 0x007fffff;
			return bits;
		}
		if (e < 113) {
			m |= 0x0800;
			bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
			return bits;
		}
		bits |= ((e - 112) << 10) | (m >> 1);
		bits += m & 1;
		return bits;
	}

	let colorProbeCtx: CanvasRenderingContext2D | null = null;

	function parseColorRgba(input: string): [number, number, number, number] | null {
		if (
			typeof document === 'undefined' ||
			!input ||
			(typeof CSS !== 'undefined' &&
				typeof CSS.supports === 'function' &&
				!CSS.supports('color', input))
		) {
			return null;
		}
		if (!colorProbeCtx) {
			const c = document.createElement('canvas');
			c.width = 1;
			c.height = 1;
			colorProbeCtx = c.getContext('2d', { willReadFrequently: true });
		}
		if (!colorProbeCtx) return null;
		colorProbeCtx.clearRect(0, 0, 1, 1);
		colorProbeCtx.fillStyle = '#000';
		colorProbeCtx.fillStyle = input;
		colorProbeCtx.fillRect(0, 0, 1, 1);
		const d = colorProbeCtx.getImageData(0, 0, 1, 1).data;
		return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
	}

	/**
	 * Felzenszwalb & Huttenlocher 2D Exact Euclidean Distance Transform (Squared)
	 */
	function edt2d(grid: Float64Array, width: number, height: number) {
		const maxDim = Math.max(width, height);
		const f = new Float64Array(maxDim);
		const z = new Float64Array(maxDim + 1);
		const v = new Uint16Array(maxDim);

		const edt1d = (offset: number, stride: number, length: number) => {
			for (let q = 0; q < length; q++) f[q] = grid[offset + q * stride];
			v[0] = 0;
			z[0] = -1e20;
			z[1] = 1e20;
			let k = 0;
			for (let q = 1; q < length; q++) {
				let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
				while (s <= z[k]) {
					k--;
					s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
				}
				v[++k] = q;
				z[k] = s;
				z[k + 1] = 1e20;
			}
			k = 0;
			for (let q = 0; q < length; q++) {
				while (z[k + 1] < q) k++;
				const dx = q - v[k];
				grid[offset + q * stride] = f[v[k]] + dx * dx;
			}
		};

		for (let x = 0; x < width; x++) edt1d(x, width, height);
		for (let y = 0; y < height; y++) edt1d(y * width, 1, width);
	}

	/**
	 * Separable 2D Box Blur (3회 반복 시 Gaussian 근사하여 둥근 SDF 필드 생성)
	 */
	function boxBlur2d(
		src: Float32Array,
		width: number,
		height: number,
		radius: number
	): Float32Array {
		const r = Math.max(1, Math.round(radius));
		const tmp = new Float32Array(src.length);
		const dst = new Float32Array(src.length);
		const inv = 1 / (2 * r + 1);

		for (let y = 0; y < height; y++) {
			const row = y * width;
			let sum = 0;
			for (let k = -r; k <= r; k++) sum += src[row + clamp(k, 0, width - 1)];
			for (let x = 0; x < width; x++) {
				tmp[row + x] = sum * inv;
				sum += src[row + Math.min(width - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
			}
		}

		for (let x = 0; x < width; x++) {
			let sum = 0;
			for (let k = -r; k <= r; k++) sum += tmp[clamp(k, 0, height - 1) * width + x];
			for (let y = 0; y < height; y++) {
				dst[y * width + x] = sum * inv;
				sum += tmp[Math.min(height - 1, y + r + 1) * width + x] - tmp[Math.max(0, y - r) * width + x];
			}
		}

		return dst;
	}

	interface GlyphBox {
		text: string;
		x: number;
		y: number;
		w: number;
		h: number;
		cx: number;
		ax: number;
		ay: number;
		u: number;
		v: number;
		du: number;
		dv: number;
	}

	interface WordAtlas {
		glyphs: GlyphBox[];
		texture: WebGLTexture | null;
		left: number;
		right: number;
		depth: number;
	}

	function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
		const shader = gl.createShader(type);
		if (!shader) return null;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	function getPropsSnapshot() {
		const reduced =
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		return {
			words: cleanWords,
			morph,
			color,
			morphColor,
			tint,
			interval,
			duration,
			stagger,
			staggerFrom,
			travel,
			goo,
			swell,
			softness,
			scale,
			trigger,
			loop,
			intro,
			startOnView,
			pauseOnHover,
			paused,
			quality,
			reduced,
			onChange
		};
	}

	let latestConfig = $derived(getPropsSnapshot());

	$effect(() => {
		void latestConfig;
		void align;
		void fontFamily;
		void fontSize;
		void fontWeight;
		void letterSpacing;

		tick().then(() => {
			ctrlRef?.sync();
		});
	});

	/**
	 * 목록의 다음 단어로 모핑 전환합니다.
	 */
	export function next() {
		ctrlRef?.next();
	}

	/**
	 * 지정한 단어 인덱스로 모핑 전환합니다.
	 */
	export function goTo(index: number) {
		ctrlRef?.goTo(index);
	}

	onMount(() => {
		const hostEl = spanEl;
		if (!hostEl) return;

		const doc = hostEl.ownerDocument;
		const win = doc.defaultView ?? window;
		const canvas = doc.createElement('canvas');
		canvas.setAttribute('aria-hidden', 'true');
		canvas.style.cssText = 'position:absolute;pointer-events:none;display:block';

		const gl = canvas.getContext('webgl2', {
			alpha: true,
			premultipliedAlpha: true,
			antialias: false,
			depth: false,
			stencil: false
		});

		if (!gl) return;
		hostEl.appendChild(canvas);

		// HALF_FLOAT 텍스처의 선형 보간 활성화
		gl.getExtension('OES_texture_float_linear');
		gl.getExtension('EXT_color_buffer_float');
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

		const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SHADER);
		const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER);
		const prog = gl.createProgram();
		if (!vs || !fs || !prog) {
			canvas.remove();
			return;
		}

		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			canvas.remove();
			return;
		}
		gl.useProgram(prog);

		// 풀스크린 쿼드 VAO
		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);
		const quadBuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);
		const posLoc = gl.getAttribLocation(prog, 'position');
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

		const loc = {
			uAtlasA: gl.getUniformLocation(prog, 'uAtlasA'),
			uAtlasB: gl.getUniformLocation(prog, 'uAtlasB'),
			uGlyphs: gl.getUniformLocation(prog, 'uGlyphs'),
			uRectA: gl.getUniformLocation(prog, 'uRectA[0]'),
			uRectB: gl.getUniformLocation(prog, 'uRectB[0]'),
			uCountA: gl.getUniformLocation(prog, 'uCountA'),
			uCountB: gl.getUniformLocation(prog, 'uCountB'),
			uMode: gl.getUniformLocation(prog, 'uMode'),
			uCap: gl.getUniformLocation(prog, 'uCap'),
			uGoo: gl.getUniformLocation(prog, 'uGoo'),
			uSwell: gl.getUniformLocation(prog, 'uSwell'),
			uBand: gl.getUniformLocation(prog, 'uBand'),
			uPixel: gl.getUniformLocation(prog, 'uPixel'),
			uSize: gl.getUniformLocation(prog, 'uSize'),
			uInk: gl.getUniformLocation(prog, 'uInk'),
			uInkAlpha: gl.getUniformLocation(prog, 'uInkAlpha'),
			uTint: gl.getUniformLocation(prog, 'uTint'),
			uTintAmount: gl.getUniformLocation(prog, 'uTintAmount')
		};

		gl.uniform1i(loc.uAtlasA, 0);
		gl.uniform1i(loc.uAtlasB, 1);
		gl.uniform1i(loc.uGlyphs, 2);

		// 기본 폴백 1x1 RG16F 텍스처 (거리값 4000)
		const farHalf = toHalfFloat(4000);
		const fallbackTex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, fallbackTex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RG16F,
			1,
			1,
			0,
			gl.RG,
			gl.HALF_FLOAT,
			new Uint16Array([farHalf, farHalf])
		);

		// 글리프 메타데이터 텍스처 (64x4 RGBA32F, NEAREST)
		const glyphData = new Float32Array(1024);
		const glyphTex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, glyphTex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 64, 4, 0, gl.RGBA, gl.FLOAT, glyphData);

		const rectAData = new Float32Array(64 * 4);
		const rectBData = new Float32Array(64 * 4);

		const scratchCanvas = doc.createElement('canvas');
		const scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true });
		const maxTexSize = Math.max(512, Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048));

		let wordAtlases: WordAtlas[] = [];
		let cacheKey = '';
		let rebuildGen = 0;
		let pairKey = '';
		let cachedPairs: { pairs: Int16Array; taken: Uint8Array } | null = null;

		let viewW = 1;
		let viewH = 1;
		let padX = 0;
		let padY = 0;
		let pixelScale = 1;
		let fontSizePx = 16;
		let sdfCap = 8;
		let isRtl = false;

		const initIdx = Math.max(
			0,
			Math.min(Math.max(0, cleanWords.length - 1), Math.round(finiteOr(initialIndex, 0)))
		);
		let randSeed = 1;
		let curWordIdx = initIdx;
		let targetWordIdx = initIdx;
		let prevWordIdx = -1;
		let morphStartSec = -1;
		let morphDurSec = 1;
		let lastTickSec = 0;
		let rafHandle = 0;
		let timerHandle = 0;
		let isIntersecting = false;
		let hasStarted = false;
		let isHover = false;
		let isDestroyed = false;

		let uInkRgb: [number, number, number] = [1, 1, 1];
		let uInkAlpha = 1;
		let uTintRgb: [number, number, number] = [0.545, 0.361, 0.965];

		const rebuildAtlases = (force: boolean) => {
			const cfg = latestConfig;
			const hostRect = hostEl.getBoundingClientRect();
			const cs = win.getComputedStyle(hostEl);
			fontSizePx = parseFloat(cs.fontSize) || 16;

			const qFactor = clamp(finiteOr(cfg.quality, 1), 0.5, 1);
			const dpr = Math.min(win.devicePixelRatio || 1, 3) * qFactor;
			padX = Math.ceil(0.25 * fontSizePx);
			padY = Math.ceil(0.3 * fontSizePx);

			const w = Math.max(1, Math.ceil(hostRect.width) + 2 * padX);
			const h = Math.max(1, Math.ceil(hostRect.height) + 2 * padY);
			const fontStr = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
			const nextKey = [
				w.toFixed(1),
				h.toFixed(1),
				dpr,
				fontStr,
				cfg.words.join('\x01'),
				cs.letterSpacing,
				cs.textAlign,
				cs.direction
			].join('|');

			if (!force && nextKey === cacheKey) return;
			cacheKey = nextKey;
			rebuildGen++;
			viewW = w;
			viewH = h;
			pixelScale = dpr;
			isRtl = cs.direction === 'rtl';
			sdfCap = 0.92 * Math.ceil(0.25 * fontSizePx);

			canvas.style.left = `${-padX}px`;
			canvas.style.top = `${-padY}px`;
			canvas.style.width = `${viewW}px`;
			canvas.style.height = `${viewH}px`;

			const physW = Math.max(1, Math.round(viewW * pixelScale));
			const physH = Math.max(1, Math.round(viewH * pixelScale));
			if (canvas.width !== physW || canvas.height !== physH) {
				canvas.width = physW;
				canvas.height = physH;
			}
			gl.viewport(0, 0, physW, physH);

			for (const entry of wordAtlases) {
				if (entry.texture) gl.deleteTexture(entry.texture);
			}
			wordAtlases = [];
			if (!scratchCtx) return;

			scratchCtx.font = fontStr;
			const ascent = scratchCtx.measureText('Hxg').fontBoundingBoxAscent || 0.92 * fontSizePx;
			const range = doc.createRange();

			const wordSpans = Array.from(hostEl.querySelectorAll('[data-morph-word]'));
			const measuredWords = wordSpans.map((wordSpan) => {
				const boxes: {
					text: string;
					left: number;
					top: number;
					right: number;
					bottom: number;
				}[] = [];
				const textNode = wordSpan.firstChild;
				if (!textNode || textNode.nodeType !== 3) return boxes;
				const str = (textNode as Text).data;
				let offset = 0;

				const segments =
					typeof Intl !== 'undefined' && 'Segmenter' in Intl
						? Array.from(
								new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str),
								(s) => s.segment
							)
						: Array.from(str);

				for (const seg of segments) {
					const len = seg.length;
					if (/\S/.test(seg)) {
						range.setStart(textNode, offset);
						range.setEnd(textNode, offset + len);
						const r = range.getClientRects()[0];
						if (r && r.width > 0) {
							boxes.push({
								text: seg,
								left: r.left - hostRect.left + padX,
								top: r.top - hostRect.top + padY,
								right: r.right - hostRect.left + padX,
								bottom: r.bottom - hostRect.top + padY
							});
						}
					}
					offset += len;
				}
				return boxes;
			});

			range.detach();

			wordAtlases = measuredWords.map((charBoxes) => {
				const emptyAtlas: WordAtlas = {
					glyphs: [],
					texture: null,
					left: viewW / 2,
					right: viewW / 2,
					depth: 1
				};
				if (!scratchCtx || charBoxes.length === 0) return emptyAtlas;

				const margin = Math.ceil(0.25 * fontSizePx);
				const groupSize = Math.ceil(charBoxes.length / 64);
				const groups: {
					parts: typeof charBoxes;
					left: number;
					top: number;
					right: number;
					bottom: number;
					ax: number;
					ay: number;
				}[] = [];

				for (let i = 0; i < charBoxes.length; i += groupSize) {
					const slice = charBoxes.slice(i, i + groupSize);
					groups.push({
						parts: slice,
						left: Math.min(...slice.map((p) => p.left)),
						top: Math.min(...slice.map((p) => p.top)),
						right: Math.max(...slice.map((p) => p.right)),
						bottom: Math.max(...slice.map((p) => p.bottom)),
						ax: 0,
						ay: 0
					});
				}

				// 저배율(1x) 디스플레이에서도 SDF 곡선과 획이 뭉개지지 않도록 최소 2배율로 아틀라스 래스터화
				const atlasBaseScale = Math.max(pixelScale, 2 * qFactor);
				const maxRowWidth = maxTexSize / atlasBaseScale;
				let curX = 0;
				let curY = 0;
				let rowH = 0;
				let atlasW = 0;

				for (const g of groups) {
					const gw = g.right - g.left + 2 * margin;
					const gh = g.bottom - g.top + 2 * margin;
					if (curX > 0 && curX + gw > maxRowWidth) {
						curX = 0;
						curY += rowH;
						rowH = 0;
					}
					g.ax = curX;
					g.ay = curY;
					curX += gw;
					rowH = Math.max(rowH, gh);
					atlasW = Math.max(atlasW, curX);
				}

				const atlasH = curY + rowH;
				const scale =
					atlasBaseScale *
					Math.min(
						1,
						maxTexSize / Math.max(1, atlasW * atlasBaseScale),
						maxTexSize / Math.max(1, atlasH * atlasBaseScale)
					);
				const texW = Math.max(1, Math.ceil(atlasW * scale));
				const texH = Math.max(1, Math.ceil(atlasH * scale));

				scratchCanvas.width = texW;
				scratchCanvas.height = texH;
				scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
				scratchCtx.clearRect(0, 0, texW, texH);
				scratchCtx.setTransform(scale, 0, 0, scale, 0, 0);
				scratchCtx.font = fontStr;
				scratchCtx.fillStyle = '#fff';
				scratchCtx.textBaseline = 'alphabetic';

				for (const g of groups) {
					for (const part of g.parts) {
						scratchCtx.fillText(
							part.text,
							g.ax + margin + part.left - g.left,
							g.ay + margin + part.top - g.top + ascent
						);
					}
				}

				const imgData = scratchCtx.getImageData(0, 0, texW, texH).data;
				const totalPx = texW * texH;
				const outsideGrid = new Float64Array(totalPx);
				const insideGrid = new Float64Array(totalPx);

				for (let i = 0; i < totalPx; i++) {
					const a = imgData[4 * i + 3] / 255;
					if (a >= 1) {
						outsideGrid[i] = 0;
						insideGrid[i] = 1e20;
					} else if (a <= 0) {
						outsideGrid[i] = 1e20;
						insideGrid[i] = 0;
					} else {
						const d = 0.5 - a;
						outsideGrid[i] = d > 0 ? d * d : 0;
						insideGrid[i] = d < 0 ? d * d : 0;
					}
				}

				edt2d(outsideGrid, texW, texH);
				edt2d(insideGrid, texW, texH);

				const sdf = new Float32Array(totalPx);
				for (let i = 0; i < totalPx; i++) {
					sdf[i] = (Math.sqrt(outsideGrid[i]) - Math.sqrt(insideGrid[i])) / scale;
				}

				const maxOutDist = 0.92 * margin;
				let maxInDepth = 1;
				for (let i = 0; i < sdf.length; i++) {
					if (-sdf[i] > maxInDepth) maxInDepth = -sdf[i];
					if (sdf[i] > maxOutDist) sdf[i] = maxOutDist;
				}

				const blurRad = Math.max(1, fontSizePx * scale * 0.05);
				const softSdf = boxBlur2d(
					boxBlur2d(boxBlur2d(sdf, texW, texH, blurRad), texW, texH, blurRad),
					texW,
					texH,
					blurRad
				);

				const halfBuf = new Uint16Array(totalPx * 2);
				for (let i = 0; i < totalPx; i++) {
					halfBuf[2 * i] = toHalfFloat(sdf[i]);
					halfBuf[2 * i + 1] = toHalfFloat(softSdf[i]);
				}

				const tex = gl.createTexture()!;
				gl.bindTexture(gl.TEXTURE_2D, tex);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, texW, texH, 0, gl.RG, gl.HALF_FLOAT, halfBuf);

				return {
					texture: tex,
					depth: maxInDepth,
					left: Math.min(...groups.map((g) => g.left)),
					right: Math.max(...groups.map((g) => g.right)),
					glyphs: groups.map((g) => {
						const gw = g.right - g.left + 2 * margin;
						const gh = g.bottom - g.top + 2 * margin;
						return {
							text: g.parts.map((p) => p.text).join(''),
							x: g.left - margin,
							y: g.top - margin,
							w: gw,
							h: gh,
							cx: (g.left + g.right) / 2,
							ax: isRtl ? g.right : g.left,
							ay: g.top,
							u: (g.ax * scale) / texW,
							v: (g.ay * scale) / texH,
							du: (gw * scale) / texW,
							dv: (gh * scale) / texH
						};
					})
				};
			});
		};

		const syncColors = () => {
			const cfg = latestConfig;
			const compColor = win.getComputedStyle(hostEl).color;
			const inkRgba =
				parseColorRgba(
					cfg.color && cfg.color.toLowerCase() !== 'currentcolor' ? cfg.color : compColor
				) ?? [1, 1, 1, 1];
			uInkRgb = [inkRgba[0], inkRgba[1], inkRgba[2]];
			uInkAlpha = inkRgba[3];

			const tintRgba = parseColorRgba(cfg.morphColor || '#8B5CF6') ?? [0.545, 0.361, 0.965, 1];
			uTintRgb = [tintRgba[0], tintRgba[1], tintRgba[2]];
		};

		const getAtlasAt = (idx: number): WordAtlas | null =>
			wordAtlases.length
				? wordAtlases[((idx % wordAtlases.length) + wordAtlases.length) % wordAtlases.length]
				: null;

		const mapRange = (x: number, a0: number, a1: number, b0: number, b1: number) => {
			const span = a1 - a0;
			return span > 0.001 ? b0 + ((x - a0) / span) * (b1 - b0) : (b0 + b1) / 2;
		};

		const hashRand = (n: number) => {
			const v = 43758.5453 * Math.sin(12.9898 * n + 78.233 * randSeed);
			return v - Math.floor(v);
		};

		const normCharPos = (atlas: WordAtlas, cx: number) => {
			const span = atlas.right - atlas.left;
			const r = span > 0.001 ? clamp((cx - atlas.left) / span, 0, 1) : 0.5;
			return isRtl ? 1 - r : r;
		};

		const computeStaggerEase = (normPos: number, globalT: number, maxGlyphIdx: number) => {
			const cfg = latestConfig;
			const st = clamp(finiteOr(cfg.stagger, 0.25), 0, 0.9);
			let offsetOrder: number;
			if (cfg.staggerFrom === 'end') {
				offsetOrder = 1 - normPos;
			} else if (cfg.staggerFrom === 'center') {
				offsetOrder = 2 * Math.abs(normPos - 0.5);
			} else if (cfg.staggerFrom === 'edges') {
				offsetOrder = 1 - 2 * Math.abs(normPos - 0.5);
			} else if (cfg.staggerFrom === 'random') {
				const scaled = normPos * maxGlyphIdx;
				const idx0 = Math.floor(scaled);
				const frac = scaled - idx0;
				const smoothFrac = frac * frac * (3 - 2 * frac);
				offsetOrder = hashRand(idx0) * (1 - smoothFrac) + hashRand(idx0 + 1) * smoothFrac;
			} else {
				offsetOrder = normPos;
			}

			const u = clamp((globalT - offsetOrder * st) / (1 - st), 0, 1);
			// Quintic smoothstep: u^3 * (u * (6u - 15) + 10)
			return u * u * u * (u * (6 * u - 15) + 10);
		};

		const writeGlyphData = (
			rowPair: number,
			slot: number,
			glyph: GlyphBox,
			g0: number,
			g1: number,
			g2: number,
			g3: number
		) => {
			const base = (64 * rowPair + slot) * 4;
			glyphData[base] = glyph.u;
			glyphData[base + 1] = glyph.v;
			glyphData[base + 2] = glyph.du;
			glyphData[base + 3] = glyph.dv;
			const base2 = base + 256;
			glyphData[base2] = g0;
			glyphData[base2 + 1] = g1;
			glyphData[base2 + 2] = g2;
			glyphData[base2 + 3] = g3;
		};

		const writeRectUniform = (
			arr: Float32Array,
			slot: number,
			glyph: GlyphBox,
			dx: number,
			dy: number,
			sc: number
		) => {
			const cx = viewW / 2;
			const cy = viewH / 2;
			const base = slot * 4;
			arr[base] = cx + (glyph.x + dx - cx) * sc;
			arr[base + 1] = cy + (glyph.y + dy - cy) * sc;
			arr[base + 2] = glyph.w * sc;
			arr[base + 3] = glyph.h * sc;
		};

		/**
		 * LCS(최장 공통 부분수열) 기반 동일 글자 매칭 (최소 이동거리 우선)
		 */
		const matchSharedGlyphs = (fromGlyphs: GlyphBox[], toGlyphs: GlyphBox[], maxDist: number) => {
			const n = fromGlyphs.length;
			const m = toGlyphs.length;
			const cols = m + 1;
			const dpCount = new Int16Array((n + 1) * cols);
			const dpCost = new Float32Array((n + 1) * cols);
			const dpChoice = new Uint8Array((n + 1) * cols);

			for (let i = n - 1; i >= 0; i--) {
				for (let j = m - 1; j >= 0; j--) {
					const idx = i * cols + j;
					let bestCount = dpCount[idx + cols];
					let bestCost = dpCost[idx + cols];
					let choice = 0;

					if (
						dpCount[idx + 1] > bestCount ||
						(dpCount[idx + 1] === bestCount && dpCost[idx + 1] < bestCost)
					) {
						bestCount = dpCount[idx + 1];
						bestCost = dpCost[idx + 1];
						choice = 1;
					}

					if (
						fromGlyphs[i].text === toGlyphs[j].text &&
						Math.abs(fromGlyphs[i].ax - toGlyphs[j].ax) <= maxDist
					) {
						const candCount = dpCount[idx + cols + 1] + 1;
						const candCost = dpCost[idx + cols + 1] + Math.abs(fromGlyphs[i].ax - toGlyphs[j].ax);
						if (candCount > bestCount || (candCount === bestCount && candCost < bestCost)) {
							bestCount = candCount;
							bestCost = candCost;
							choice = 2;
						}
					}

					dpCount[idx] = bestCount;
					dpCost[idx] = bestCost;
					dpChoice[idx] = choice;
				}
			}

			const pairs = new Int16Array(n).fill(-1);
			const taken = new Uint8Array(m);
			let i = 0;
			let j = 0;
			while (i < n && j < m) {
				const c = dpChoice[i * cols + j];
				if (c === 2) {
					pairs[i] = j;
					taken[j] = 1;
					i++;
					j++;
				} else if (c === 0) {
					i++;
				} else {
					j++;
				}
			}
			return { pairs, taken };
		};

		const renderAtTime = (nowSec: number) => {
			const cfg = latestConfig;
			let progress = 1;
			if (morphStartSec >= 0) {
				progress = clamp((nowSec - morphStartSec) / morphDurSec, 0, 1);
				if (progress >= 1) {
					morphStartSec = -1;
					curWordIdx = targetWordIdx;
					prevWordIdx = -1;
					cfg.onChange?.(cfg.words[curWordIdx] ?? '', curWordIdx);
				}
			}

			const isMorphing = morphStartSec >= 0;
			const atlasA = isMorphing && prevWordIdx >= 0 ? getAtlasAt(prevWordIdx) : null;
			const atlasB = getAtlasAt(isMorphing ? targetWordIdx : curWordIdx);
			const t = isMorphing ? progress : 1;

			const isBlurMode = cfg.morph === 'blur';
			const travelAmt = clamp(finiteOr(cfg.travel, 0.5), 0, 1);
			const scaleAmt = clamp(finiteOr(cfg.scale, 0.04), -0.5, 0.5);
			const softAmt = clamp(finiteOr(cfg.softness, 0.8), 0, 1);
			const blurRadius = 0.14 * softAmt * fontSizePx;
			const blurLiftY = 0.12 * fontSizePx;
			const maxGlyphIdx =
				Math.max(atlasA ? atlasA.glyphs.length : 0, atlasB ? atlasB.glyphs.length : 0, 2) - 1;

			if (atlasA && atlasB) {
				const pk = `${rebuildGen}:${prevWordIdx}:${targetWordIdx}`;
				if (pk !== pairKey) {
					pairKey = pk;
					cachedPairs = matchSharedGlyphs(atlasA.glyphs, atlasB.glyphs, 2.5 * fontSizePx);
				}
			} else {
				cachedPairs = null;
			}

			let countA = 0;
			if (atlasA) {
				const erodeDepth = 1.12 * atlasA.depth + 0.5;
				for (let i = 0; i < atlasA.glyphs.length && countA < 64; i++) {
					const gA = atlasA.glyphs[i];
					const matchedIdx = cachedPairs && atlasB ? cachedPairs.pairs[i] : -1;
					const gB = matchedIdx >= 0 && atlasB ? atlasB.glyphs[matchedIdx] : null;

					if (gB && atlasB) {
						const lt = computeStaggerEase(
							(normCharPos(atlasA, gA.cx) + normCharPos(atlasB, gB.cx)) / 2,
							t,
							maxGlyphIdx
						);
						writeRectUniform(rectAData, countA, gA, (gB.ax - gA.ax) * lt, (gB.ay - gA.ay) * lt, 1);
						writeGlyphData(
							0,
							countA,
							gA,
							1,
							0,
							isBlurMode ? 1 : 0,
							0.35 * Math.sin(Math.PI * lt)
						);
					} else {
						const lt = smoothstep(
							0,
							0.62,
							computeStaggerEase(normCharPos(atlasA, gA.cx), t, maxGlyphIdx)
						);
						const driftX = atlasB
							? (mapRange(gA.cx, atlasA.left, atlasA.right, atlasB.left, atlasB.right) - gA.cx) *
								travelAmt *
								lt
							: 0;
						const sc = 1 + scaleAmt * lt;
						if (isBlurMode) {
							writeRectUniform(rectAData, countA, gA, driftX, -blurLiftY * lt, sc);
							writeGlyphData(
								0,
								countA,
								gA,
								sc,
								blurRadius * lt,
								1 - lt,
								0.8 * Math.sin(Math.PI * lt)
							);
						} else {
							writeRectUniform(rectAData, countA, gA, driftX, 0, sc);
							writeGlyphData(
								0,
								countA,
								gA,
								sc,
								smoothstep(0, 0.6, lt) * softAmt,
								erodeDepth * Math.pow(lt, 1.25),
								Math.sin(Math.PI * lt)
							);
						}
					}
					countA++;
				}
			}

			let countB = 0;
			if (atlasB) {
				const erodeDepth = 1.12 * atlasB.depth + 0.5;
				for (let i = 0; i < atlasB.glyphs.length && countB < 64; i++) {
					if (cachedPairs && cachedPairs.taken[i]) continue;
					const gB = atlasB.glyphs[i];
					const rawEase = computeStaggerEase(normCharPos(atlasB, gB.cx), t, maxGlyphIdx);
					const lt = atlasA ? smoothstep(0.38, 1, rawEase) : rawEase;
					const inv = 1 - lt;
					const driftX = atlasA
						? (mapRange(gB.cx, atlasB.left, atlasB.right, atlasA.left, atlasA.right) - gB.cx) *
							travelAmt *
							inv
						: 0;
					const sc = 1 - scaleAmt * inv;
					if (isBlurMode) {
						writeRectUniform(rectBData, countB, gB, driftX, blurLiftY * inv, sc);
						writeGlyphData(
							2,
							countB,
							gB,
							sc,
							blurRadius * inv,
							lt,
							0.8 * Math.sin(Math.PI * lt)
						);
					} else {
						writeRectUniform(rectBData, countB, gB, driftX, 0, sc);
						writeGlyphData(
							2,
							countB,
							gB,
							sc,
							inv * softAmt,
							erodeDepth * Math.pow(inv, 0.85),
							Math.sin(Math.PI * lt)
						);
					}
					countB++;
				}
			}

			gl.useProgram(prog);
			gl.bindVertexArray(vao);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, atlasA?.texture ?? fallbackTex);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, atlasB?.texture ?? fallbackTex);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, glyphTex);
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 4, gl.RGBA, gl.FLOAT, glyphData);

			gl.uniform4fv(loc.uRectA, rectAData);
			gl.uniform4fv(loc.uRectB, rectBData);
			gl.uniform1i(loc.uCountA, countA);
			gl.uniform1i(loc.uCountB, countB);
			gl.uniform1i(loc.uMode, isBlurMode ? 1 : 0);
			gl.uniform1f(loc.uGoo, clamp(finiteOr(cfg.goo, 0.1), 0, 1) * fontSizePx);
			gl.uniform1f(loc.uSwell, clamp(finiteOr(cfg.swell, 0.02), 0, 0.5) * fontSizePx);
			gl.uniform1f(loc.uBand, Math.max(0.5, 0.05 * fontSizePx));
			gl.uniform1f(loc.uPixel, 1 / pixelScale);
			gl.uniform1f(loc.uCap, sdfCap);
			gl.uniform2f(loc.uSize, viewW, viewH);
			gl.uniform3f(loc.uInk, uInkRgb[0], uInkRgb[1], uInkRgb[2]);
			gl.uniform1f(loc.uInkAlpha, uInkAlpha);
			gl.uniform3f(loc.uTint, uTintRgb[0], uTintRgb[1], uTintRgb[2]);
			gl.uniform1f(loc.uTintAmount, clamp(finiteOr(cfg.tint, 0.3), 0, 1));

			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		};

		const requestTick = () => {
			if (!isDestroyed && !rafHandle) {
				rafHandle = win.requestAnimationFrame(tickLoop);
			}
		};

		const startTransition = (toIdx: number, fromIdx: number) => {
			const cfg = latestConfig;
			if (wordAtlases.length === 0) return;
			if (cfg.reduced) {
				curWordIdx = toIdx;
				targetWordIdx = toIdx;
				morphStartSec = -1;
				renderAtTime(performance.now() / 1000);
				cfg.onChange?.(cfg.words[curWordIdx] ?? '', curWordIdx);
				return;
			}
			prevWordIdx = fromIdx;
			targetWordIdx = ((toIdx % wordAtlases.length) + wordAtlases.length) % wordAtlases.length;
			morphStartSec = performance.now() / 1000;
			morphDurSec = clamp(finiteOr(cfg.duration, 1.1), 0.05, 10);
			lastTickSec = morphStartSec;
			randSeed += 1;
			requestTick();
		};

		const triggerNext = () => {
			const cfg = latestConfig;
			if (wordAtlases.length < 2) return;
			const activeIdx = morphStartSec >= 0 ? targetWordIdx : curWordIdx;
			if (!cfg.loop && activeIdx >= wordAtlases.length - 1) return;
			if (morphStartSec >= 0) curWordIdx = targetWordIdx;
			startTransition(activeIdx + 1, activeIdx);
		};

		function tickLoop() {
			rafHandle = 0;
			if (isDestroyed) return;
			const cfg = latestConfig;
			const nowSec = performance.now() / 1000;

			if (
				cfg.trigger === 'auto' &&
				hasStarted &&
				!cfg.reduced &&
				morphStartSec < 0 &&
				wordAtlases.length > 1
			) {
				const isPaused = cfg.paused || (cfg.pauseOnHover && isHover) || !isIntersecting;
				if (isPaused) lastTickSec += 1 / 60;
				const iv = clamp(finiteOr(cfg.interval, 2.6), 0.2, 60);
				if (!isPaused && nowSec - lastTickSec >= iv && (cfg.loop || curWordIdx < wordAtlases.length - 1)) {
					triggerNext();
				}
			}

			renderAtTime(nowSec);

			if (morphStartSec >= 0) {
				requestTick();
			} else if (
				cfg.trigger === 'auto' &&
				hasStarted &&
				!cfg.reduced &&
				wordAtlases.length > 1 &&
				isIntersecting
			) {
				if (timerHandle) win.clearTimeout(timerHandle);
				const remain = clamp(finiteOr(cfg.interval, 2.6), 0.2, 60) - (nowSec - lastTickSec);
				timerHandle = win.setTimeout(
					() => {
						timerHandle = 0;
						requestTick();
					},
					Math.max(16, 1000 * remain)
				);
			}
		}

		const beginIfReady = () => {
			if (hasStarted) return;
			hasStarted = true;
			const cfg = latestConfig;
			if (cfg.intro && !cfg.reduced) {
				startTransition(curWordIdx, -1);
			} else {
				lastTickSec = performance.now() / 1000;
				renderAtTime(performance.now() / 1000);
				requestTick();
			}
		};

		const onPointerEnter = (e: PointerEvent) => {
			if (e.pointerType === 'mouse') isHover = true;
			if (latestConfig.trigger === 'hover' && morphStartSec < 0) triggerNext();
		};

		const onPointerLeave = () => {
			isHover = false;
			requestTick();
		};

		const onClick = () => {
			if (latestConfig.trigger === 'click') triggerNext();
		};

		hostEl.addEventListener('pointerenter', onPointerEnter);
		hostEl.addEventListener('pointerleave', onPointerLeave);
		hostEl.addEventListener('click', onClick);

		const ro = new ResizeObserver(() => {
			rebuildAtlases(false);
			renderAtTime(performance.now() / 1000);
		});
		ro.observe(hostEl);

		const io = new IntersectionObserver(([entry]) => {
			isIntersecting = entry.isIntersecting;
			if (isIntersecting && !hasStarted && latestConfig.startOnView) beginIfReady();
			if (isIntersecting) requestTick();
		});
		io.observe(hostEl);

		const mo = new MutationObserver(() => {
			syncColors();
			renderAtTime(performance.now() / 1000);
		});
		mo.observe(doc.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'style', 'data-theme']
		});

		syncColors();
		rebuildAtlases(true);

		if (latestConfig.startOnView) {
			renderAtTime(performance.now() / 1000);
		} else {
			beginIfReady();
		}

		if (doc.fonts?.ready) {
			doc.fonts.ready.then(() => {
				if (!isDestroyed) {
					rebuildAtlases(true);
					renderAtTime(performance.now() / 1000);
				}
			});
		}

		ctrlRef = {
			sync: () => {
				syncColors();
				rebuildAtlases(false);
				if (curWordIdx >= wordAtlases.length) curWordIdx = 0;
				renderAtTime(performance.now() / 1000);
				requestTick();
			},
			next: () => triggerNext(),
			goTo: (idx: number) => {
				if (wordAtlases.length === 0) return;
				const target = clamp(Math.round(idx), 0, wordAtlases.length - 1);
				const activeIdx = morphStartSec >= 0 ? targetWordIdx : curWordIdx;
				if (target !== activeIdx) {
					if (morphStartSec >= 0) curWordIdx = targetWordIdx;
					startTransition(target, activeIdx);
				}
			},
			destroy: () => {
				isDestroyed = true;
				if (rafHandle) win.cancelAnimationFrame(rafHandle);
				if (timerHandle) win.clearTimeout(timerHandle);
				ro.disconnect();
				io.disconnect();
				mo.disconnect();
				hostEl.removeEventListener('pointerenter', onPointerEnter);
				hostEl.removeEventListener('pointerleave', onPointerLeave);
				hostEl.removeEventListener('click', onClick);
				for (const entry of wordAtlases) {
					if (entry.texture) gl.deleteTexture(entry.texture);
				}
				gl.deleteTexture(fallbackTex);
				gl.deleteTexture(glyphTex);
				gl.deleteBuffer(quadBuf);
				gl.deleteVertexArray(vao);
				gl.deleteProgram(prog);
				gl.deleteShader(vs);
				gl.deleteShader(fs);
				canvas.remove();
			}
		};

		return () => {
			ctrlRef?.destroy();
			ctrlRef = null;
		};
	});

	let mergedClass = $derived([klass, className].filter(Boolean).join(' '));

	let wrapperStyle = $derived.by(() => {
		const parts: string[] = [];
		parts.push(`text-align: ${align}`);
		if (color) parts.push(`color: ${color}`);
		if (fontFamily && fontFamily !== 'inherit') parts.push(`font-family: ${fontFamily}`);
		if (fontSize !== undefined) parts.push(`font-size: ${fontSize}px`);
		if (fontWeight !== undefined) parts.push(`font-weight: ${fontWeight}`);
		if (letterSpacing !== undefined) parts.push(`letter-spacing: ${letterSpacing}em`);
		if (style) parts.push(style);
		return parts.join('; ');
	});
</script>

<span bind:this={spanEl} class="fd-text-morph {mergedClass}" style={wrapperStyle}>
	<span class="sr-only">{cleanWords.join(', ')}</span>
	{#each cleanWords as word, i (i)}
		<span data-morph-word="" aria-hidden="true" class="fd-text-morph-word">{word}</span>
	{/each}
</span>

<style>
	.fd-text-morph {
		position: relative;
		display: inline-grid;
		vertical-align: baseline;
	}

	.fd-text-morph-word {
		grid-area: 1 / 1;
		visibility: hidden;
		white-space: pre;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
