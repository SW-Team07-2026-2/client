/**
 * WebGL2 Distortion Wave 셰이더 렌더러
 * - 두 DOM 스냅샷 텍스처(before / after) 사이를 유리 굴절 · 색수차 · 컬러 림 · 파티클 파동으로 전환합니다.
 */
export type DistortionWaveType = 'center' | 'vertical' | 'horizontal';
export type DistortionWavePalette = 'colorful' | 'ocean' | 'sunset' | 'green' | 'mono';

export interface DistortionWaveStyle {
	amplitude?: number;
	lensWidth?: number;
	aberration?: number;
	blur?: number;
	rimWidth?: number;
	particles?: number;
}

type RgbVec3 = [number, number, number];

const PALETTE_COLORS: Record<DistortionWavePalette, [RgbVec3, RgbVec3, RgbVec3]> = {
	colorful: [
		[0.24, 0.88, 1.0],
		[0.64, 0.42, 1.0],
		[1.0, 0.36, 0.68]
	],
	ocean: [
		[0.14, 0.85, 0.96],
		[0.26, 0.56, 1.0],
		[0.45, 0.34, 0.98]
	],
	sunset: [
		[1.0, 0.72, 0.28],
		[1.0, 0.42, 0.48],
		[0.82, 0.3, 0.88]
	],
	green: [
		[0.28, 0.96, 0.72],
		[0.18, 0.82, 0.58],
		[0.24, 0.72, 0.95]
	],
	mono: [
		[0.96, 0.96, 0.98],
		[0.74, 0.76, 0.82],
		[1.0, 1.0, 1.0]
	]
};

const VERTEX_SHADER_SRC = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
	vUv = aPos * 0.5 + 0.5;
	vUv.y = 1.0 - vUv.y;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uBeforeTex;
uniform sampler2D uAfterTex;
uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform float uProgress;
uniform int uType;
uniform float uAmplitude;
uniform float uLensWidth;
uniform float uAberration;
uniform float uBlur;
uniform float uRimWidth;
uniform float uParticles;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

vec4 sampleView(sampler2D tex, vec2 uv, vec2 dir, float blurAmt, float aberAmt) {
	vec2 clamped = clamp(uv, vec2(0.001), vec2(0.999));
	if (blurAmt <= 0.0001 && aberAmt <= 0.0001) {
		return texture(tex, clamped);
	}

	vec2 rUv = clamp(uv + dir * aberAmt, vec2(0.001), vec2(0.999));
	vec2 bUv = clamp(uv - dir * aberAmt, vec2(0.001), vec2(0.999));

	vec3 col = vec3(0.0);
	float alpha = 0.0;
	for (int i = -2; i <= 2; i++) {
		float fi = float(i) * 0.5;
		vec2 off = dir * (fi * blurAmt);
		float w = (i == 0) ? 0.32 : (abs(i) == 1 ? 0.22 : 0.12);
		col.r += texture(tex, clamp(rUv + off, vec2(0.001), vec2(0.999))).r * w;
		col.g += texture(tex, clamp(clamped + off, vec2(0.001), vec2(0.999))).g * w;
		col.b += texture(tex, clamp(bUv + off, vec2(0.001), vec2(0.999))).b * w;
		alpha += texture(tex, clamp(clamped + off, vec2(0.001), vec2(0.999))).a * w;
	}
	return vec4(col, alpha);
}

void main() {
	float aspect = uResolution.x / max(uResolution.y, 1.0);
	vec2 delta = vUv - uOrigin;
	vec2 scaledDelta = vec2(delta.x * aspect, delta.y);

	float dist = 0.0;
	vec2 dir = vec2(0.0, -1.0);
	float maxDist = 1.0;

	if (uType == 0) {
		// center: 원형 방사 파동
		dist = length(scaledDelta);
		dir = dist > 0.0001 ? normalize(scaledDelta) : vec2(0.0, -1.0);
		dir.x /= max(aspect, 0.001);
		float d0 = length(vec2((0.0 - uOrigin.x) * aspect, 0.0 - uOrigin.y));
		float d1 = length(vec2((1.0 - uOrigin.x) * aspect, 0.0 - uOrigin.y));
		float d2 = length(vec2((0.0 - uOrigin.x) * aspect, 1.0 - uOrigin.y));
		float d3 = length(vec2((1.0 - uOrigin.x) * aspect, 1.0 - uOrigin.y));
		maxDist = max(max(d0, d1), max(d2, d3));
	} else if (uType == 1) {
		// vertical: 아래 -> 위 파동
		dist = 1.0 - vUv.y;
		dir = vec2(0.0, -1.0);
		maxDist = 1.0;
	} else {
		// horizontal: 왼쪽 -> 오른쪽 파동
		dist = vUv.x;
		dir = vec2(1.0, 0.0);
		maxDist = 1.0;
	}

	// 초반 미세 수축(anticipation) 후 부드럽게 가속 확산
	float p = clamp(uProgress, 0.0, 1.0);
	float eased = 1.0 - pow(1.0 - p, 3.0);
	float anticipation = -0.025 * sin(min(p * 6.0, 1.0) * 3.14159265);
	float waveR = (eased * (maxDist + uLensWidth * 2.2)) - uLensWidth * 0.65 + anticipation;

	// 시작과 끝에서 부드럽게 감쇠되는 파동 강도 포락선
	float env = smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.84, 1.0, p));

	float band = dist - waveR;
	float normBand = band / max(uLensWidth, 0.001);
	float lens = exp(-(normBand * normBand) * 1.45);

	// 볼록 렌즈 굴절 UV 변위
	float disp = -normBand * lens * uAmplitude * env;
	vec2 warpedUv = vUv + dir * disp;

	float localAber = uAberration * lens * env;
	float localBlur = uBlur * lens * env;

	vec4 beforeCol = sampleView(uBeforeTex, warpedUv, dir, localBlur, localAber);
	vec4 afterCol = sampleView(uAfterTex, warpedUv, dir, localBlur, localAber);

	// 파동 경계를 기준으로 부드럽게 before -> after 전환
	float revealMask = 1.0 - smoothstep(-uLensWidth * 0.24, uLensWidth * 0.24, band);
	vec4 baseCol = mix(beforeCol, afterCol, revealMask);

	// 무지개 컬러 림 (파동 마루)
	float rim = exp(-pow(band / max(uRimWidth, 0.001), 2.0)) * env;
	float angle = atan(scaledDelta.y, scaledDelta.x);
	float hueMix = 0.5 + 0.5 * sin(angle * 2.5 + p * 5.0 + dist * 6.0);
	float hueMix2 = 0.5 + 0.5 * cos(angle * 1.8 - p * 4.0);
	vec3 rimColor = mix(mix(uColorA, uColorB, hueMix), uColorC, hueMix2 * 0.65);

	// 파동 띠를 따라 반짝이는 미세 파티클
	float sparkle = 0.0;
	if (uParticles > 0.01 && lens > 0.08) {
		vec2 cellUv = vUv * vec2(36.0 * aspect, 36.0) + dir * (p * 4.0);
		vec2 cellId = floor(cellUv);
		vec2 cellLocal = fract(cellUv) - 0.5;
		float rnd = hash21(cellId);
		if (rnd > 0.86) {
			float dotDist = length(cellLocal);
			sparkle = smoothstep(0.24, 0.02, dotDist) * lens * env * uParticles * 0.75;
		}
	}

	vec3 finalRgb = baseCol.rgb + rimColor * (rim * 0.52 + sparkle);
	fragColor = vec4(finalRgb, 1.0);
}
`;

export class WebGLWaveRenderer {
	private gl: WebGL2RenderingContext;
	private program: WebGLProgram;
	private vao: WebGLVertexArrayObject;
	private vbo: WebGLBuffer;
	private beforeTex: WebGLTexture;
	private afterTex: WebGLTexture;
	private uniforms: Record<string, WebGLUniformLocation | null> = {};

	private constructor(
		gl: WebGL2RenderingContext,
		program: WebGLProgram,
		vao: WebGLVertexArrayObject,
		vbo: WebGLBuffer,
		beforeTex: WebGLTexture,
		afterTex: WebGLTexture
	) {
		this.gl = gl;
		this.program = program;
		this.vao = vao;
		this.vbo = vbo;
		this.beforeTex = beforeTex;
		this.afterTex = afterTex;

		const names = [
			'uBeforeTex',
			'uAfterTex',
			'uResolution',
			'uOrigin',
			'uProgress',
			'uType',
			'uAmplitude',
			'uLensWidth',
			'uAberration',
			'uBlur',
			'uRimWidth',
			'uParticles',
			'uColorA',
			'uColorB',
			'uColorC'
		];
		for (const name of names) {
			this.uniforms[name] = gl.getUniformLocation(program, name);
		}
	}

	static create(canvas: HTMLCanvasElement): WebGLWaveRenderer | null {
		const gl = canvas.getContext('webgl2', {
			alpha: true,
			antialias: true,
			premultipliedAlpha: false
		});
		if (!gl) return null;

		const vs = WebGLWaveRenderer.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
		const fs = WebGLWaveRenderer.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
		if (!vs || !fs) return null;

		const program = gl.createProgram();
		if (!program) return null;
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);
		gl.deleteShader(vs);
		gl.deleteShader(fs);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			gl.deleteProgram(program);
			return null;
		}

		const vao = gl.createVertexArray();
		const vbo = gl.createBuffer();
		const beforeTex = WebGLWaveRenderer.createTexture(gl);
		const afterTex = WebGLWaveRenderer.createTexture(gl);
		if (!vao || !vbo || !beforeTex || !afterTex) return null;

		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);
		const loc = gl.getAttribLocation(program, 'aPos');
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		gl.bindVertexArray(null);

		return new WebGLWaveRenderer(gl, program, vao, vbo, beforeTex, afterTex);
	}

	private static compileShader(
		gl: WebGL2RenderingContext,
		type: number,
		source: string
	): WebGLShader | null {
		const shader = gl.createShader(type);
		if (!shader) return null;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.warn('DistortionWave shader compile failed:', gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	private static createTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
		const tex = gl.createTexture();
		if (!tex) return null;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		return tex;
	}

	uploadSnapshots(before: HTMLCanvasElement, after: HTMLCanvasElement): void {
		const { gl } = this;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.beforeTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, before);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.afterTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, after);
	}

	render(opts: {
		width: number;
		height: number;
		progress: number;
		origin: { x: number; y: number };
		type: DistortionWaveType;
		palette: DistortionWavePalette;
		style?: DistortionWaveStyle;
	}): void {
		const { gl, uniforms } = this;
		const [cA, cB, cC] = PALETTE_COLORS[opts.palette] ?? PALETTE_COLORS.colorful;
		const typeId = opts.type === 'center' ? 0 : opts.type === 'vertical' ? 1 : 2;
		const st = opts.style ?? {};

		gl.viewport(0, 0, opts.width, opts.height);
		gl.useProgram(this.program);
		gl.bindVertexArray(this.vao);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.beforeTex);
		gl.uniform1i(uniforms.uBeforeTex, 0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.afterTex);
		gl.uniform1i(uniforms.uAfterTex, 1);

		gl.uniform2f(uniforms.uResolution, opts.width, opts.height);
		gl.uniform2f(uniforms.uOrigin, opts.origin.x, opts.origin.y);
		gl.uniform1f(uniforms.uProgress, opts.progress);
		gl.uniform1i(uniforms.uType, typeId);
		gl.uniform1f(uniforms.uAmplitude, st.amplitude ?? 0.095);
		gl.uniform1f(uniforms.uLensWidth, st.lensWidth ?? 0.16);
		gl.uniform1f(uniforms.uAberration, st.aberration ?? 0.018);
		gl.uniform1f(uniforms.uBlur, st.blur ?? 0.008);
		gl.uniform1f(uniforms.uRimWidth, st.rimWidth ?? 0.042);
		gl.uniform1f(uniforms.uParticles, st.particles ?? 1.0);
		gl.uniform3f(uniforms.uColorA, cA[0], cA[1], cA[2]);
		gl.uniform3f(uniforms.uColorB, cB[0], cB[1], cB[2]);
		gl.uniform3f(uniforms.uColorC, cC[0], cC[1], cC[2]);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.bindVertexArray(null);
	}

	destroy(): void {
		const { gl } = this;
		gl.deleteTexture(this.beforeTex);
		gl.deleteTexture(this.afterTex);
		gl.deleteBuffer(this.vbo);
		gl.deleteVertexArray(this.vao);
		gl.deleteProgram(this.program);
	}
}
