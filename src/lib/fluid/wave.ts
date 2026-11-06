/**
 * 유체 물결(wave) 디자인 인터페이스.
 * FdButton / FdCheckButton 등 Fd 계열 컴포넌트가 공통으로 사용하는 "물결 모양 한 벌"을 정의한다.
 */
export interface FdWaveOptions {
	/** 뒤쪽 물결 겹 개수 (0~2) */
	layers: number;
	/** 겹 사이 간격(px) */
	layerGap: number;
	/** 물결 진폭(px) */
	waveAmp: number;
	/** 물결 한 마디 길이(px). 둘레에 정수 개로 맞춰짐 */
	waveLength: number;
	/** 물결 회전 속도(rad/s) */
	spin: number;
	/** 뒤쪽 물결 레이어 색상 (생략하면 컴포넌트 기본 색 / CSS 변수를 따름) */
	color?: string;
}

export const FD_WAVE_DEFAULTS: Readonly<FdWaveOptions> = Object.freeze({
	layers: 2,
	layerGap: 3,
	waveAmp: 3,
	waveLength: 70,
	spin: 1.2,
	color: undefined
});

/** 물결 디자인 구현 클래스. 일부 값만 주면 나머지는 기본값으로 채워진다. */
export class FdWave implements FdWaveOptions {
	layers: number;
	layerGap: number;
	waveAmp: number;
	waveLength: number;
	spin: number;
	color?: string;

	constructor(init: Partial<FdWaveOptions> = {}) {
		this.layers = init.layers ?? FD_WAVE_DEFAULTS.layers;
		this.layerGap = init.layerGap ?? FD_WAVE_DEFAULTS.layerGap;
		this.waveAmp = init.waveAmp ?? FD_WAVE_DEFAULTS.waveAmp;
		this.waveLength = init.waveLength ?? FD_WAVE_DEFAULTS.waveLength;
		this.spin = init.spin ?? FD_WAVE_DEFAULTS.spin;
		this.color = init.color;
	}

	/** FdWave 인스턴스 / 부분 옵션 / undefined 를 모두 FdWave 로 정규화 */
	static from(w?: Partial<FdWaveOptions> | FdWave | null): FdWave {
		return w instanceof FdWave ? w : new FdWave(w ?? {});
	}

	/** 일부 값만 바꾼 새 FdWave */
	with(patch: Partial<FdWaveOptions>): FdWave {
		return new FdWave({ ...this, ...patch });
	}

	/** 실제로 그려지는 겹 개수 (0~2 로 보정) */
	get layerCount(): number {
		return Math.max(0, Math.min(2, Math.floor(this.layers)));
	}

	/** 이 물결이 몸체 바깥으로 최대 얼마나 번지는지(px). 버튼 inset 계산에 사용 */
	get extent(): number {
		const L = this.layerCount;
		const maxWaveAmp = this.waveAmp * (1 + Math.max(0, L - 1) * 0.45);
		return (L * this.layerGap + maxWaveAmp) * 1.15 + 2;
	}
}

/**
 * 유기적 유체 파동 값 (-1 ~ 1 근처).
 * 단일 사인파 대신 서로 다른 방향·파장·속도의 2D 공간 파동과 저차 윤곽 고조파를 중첩해
 * 비대칭적이고 불규칙하게 출렁이는 액체 표면을 만든다.
 *
 * @param x,y  휴식 위치(몸체 중심 기준)
 * @param th   둘레 각도 (0 ~ 2π)
 * @param k    공간 주파수 (2π / waveLength)
 * @param s    시간 위상
 * @param seed 겹마다 다른 모양을 만들기 위한 시드
 */
export function organicWave(
	x: number,
	y: number,
	th: number,
	k: number,
	s: number,
	seed: number
): number {
	const w1 = Math.sin((x * 0.85 + y * 0.52) * k * 0.72 + s * 1.13 + seed * 2.1);
	const w2 = Math.sin((-x * 0.62 + y * 0.78) * k * 1.08 - s * 0.89 + seed * 3.7);
	const w3 = Math.cos((x * 0.28 - y * 0.96) * k * 1.42 + s * 1.47 + seed * 5.3);

	const m2 = Math.sin(th * 2 - s * 0.76 + seed * 1.7);
	const m3 = Math.cos(th * 3 + s * 1.04 + seed * 2.9);

	const env = 0.8 + 0.2 * Math.sin(th - s * 0.53 + seed * 4.1);

	return (w1 * 0.36 + w2 * 0.28 + w3 * 0.16 + m2 * 0.12 + m3 * 0.08) * env;
}

