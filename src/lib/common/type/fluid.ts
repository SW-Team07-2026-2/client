/**
 * Fluid 컴포넌트(FdDiv 및 이를 기반으로 하는 모든 Fd 컴포넌트)의
 * 도형·물결·색상·테두리·반응성·최적화 설정을 담는 단일 데이터 클래스.
 *
 * 별도의 Options 인터페이스나 FdWave 클래스로 쪼개지 않고,
 * 클래스 필드 기본값(FdButton 기준)과 Partial<FluidSetting> 생성자만으로 동작합니다.
 */
export class FluidSetting {
	/* ── 1. 도형 & 근접 돌출 (Geometry & Bulge) ── */
	/** 몸체 모서리 반경 (px) */
	radius = 999;
	/** 포인터 근접 감지 거리 (px) */
	reach = 40;
	/** 포인터 근접 시 몸체가 솟아오르는 최대 높이 (px) */
	bulge = 8;
	/** 근접 돌출 가우시안 폭 (px) */
	bulgeWidth = 22;
	/** 히트박스 투명 테두리 두께 (px). 미지정 시 돌출/물결 폭에 맞춰 자동 계산 */
	inset?: number;

	/* ── 2. 물결 (Wave) ── */
	/** 뒤쪽 물결 겹 개수 (0 ~ 2) */
	layers = 2;
	/** 물결 겹 사이 간격 (px) */
	layerGap = 3;
	/** 물결 진폭 (px) */
	waveAmp = 3;
	/** 물결 파장 길이 (px) */
	waveLength = 70;
	/** 물결 회전 속도 (rad/s) */
	spin = 1.2;
	/** 가장 앞쪽(본체) 레이어의 물결 요동 비활성화 여부 (true면 뒷 레이어만 물결침) */
	staticFrontWave = false;

	/* ── 3. 색상 (Colors — FdButton 기본값 기준) ── */
	/** 기본 몸체 배경색 */
	color = 'rgb(255, 255, 255)';
	/** 호버 시 몸체 배경색 (미지정 시 color 유지) */
	hoverColor?: string;
	/** 클릭/누름 시 몸체 배경색 */
	pressColor = '#737373';
	/** 뒤쪽 물결 레이어 색상 (미지정 시 hoverColor ?? color) */
	waveColor?: string;
	/** 호버 시 뒤쪽 물결 레이어 색상 (미지정 시 waveColor 유지) */
	hoverWaveColor?: string;
	/** 내부 텍스트 기본 색상 */
	textColor = '#282828';

	/* ── 4. 테두리 (Border — 기본값 0으로 미지정 시 비활성) ── */
	/** 몸체 테두리 두께 (px). 0이면 테두리를 그리지 않음 */
	borderWidth = 0;
	/** 기본 테두리 색상 (borderWidth > 0 일 때 적용, 미지정 시 textColor ?? '#ffffff') */
	borderColor?: string;
	/** 호버 시 테두리 색상 (미지정 시 borderColor 유지) */
	hoverBorderColor?: string;
	/** 클릭/누름 시 테두리 색상 (미지정 시 hoverBorderColor ?? borderColor 유지) */
	pressBorderColor?: string;

	/* ── 5. 반응성 & 최적화 (Interaction & Optimization) ── */
	/** 호버 시 물결 및 hoverColor 반응 여부 */
	hoverReactive = true;
	/** 포인터 근접 시 테두리 마그네틱 돌출 반응 여부 */
	bulgeReactive = true;
	/** 클릭/누름 시 텐션 변형 및 pressColor 반응 여부 */
	clickReactive = true;
	/**
	 * 비활성(호버/움직임 없음) 시 requestAnimationFrame 루프를 멈춰 최적화할지 여부.
	 * - true: 가만히 있을 때 루프 정지 (최적화)
	 * - false: 호버하지 않아도 평상시에 물결이 계속 일렁임
	 */
	pauseWhenIdle = true;
	/** 클릭/누름 시 몸체 가로/세로 텐션 변형량 (px) */
	pressDeform: { x: number; y: number } = { x: 1.5, y: -2.5 };

	constructor(init?: Partial<FluidSetting>) {
		if (init) {
			Object.assign(this, init);
			if (init.pressDeform) {
				this.pressDeform = { ...init.pressDeform };
			}
		}
	}

	/** 실제로 렌더링할 뒤쪽 물결 겹 수 (0 ~ 2 보정) */
	get layerCount(): number {
		return Math.max(0, Math.min(2, Math.floor(this.layers)));
	}

	/** 물결이 몸체 바깥으로 번지는 최대 반경 (px) */
	get waveExtent(): number {
		const L = this.layerCount;
		const maxWaveAmp = this.waveAmp * (1 + Math.max(0, L - 1) * 0.45);
		return (L * this.layerGap + maxWaveAmp) * 1.15 + 2;
	}

	/** 히트박스 투명 테두리 두께(inset) 계산 */
	get computedInset(): number {
		if (this.inset !== undefined) return this.inset;
		const b = this.bulgeReactive ? this.bulge : 0;
		const bw = Math.max(0, this.borderWidth);
		return Math.max(2, Math.ceil(Math.max(b, this.waveExtent) + bw * 0.5));
	}

	/** 일부 설정만 덮어쓴 새 FluidSetting 인스턴스를 반환 (불변 업데이트 패턴용) */
	with(patch: Partial<FluidSetting>): FluidSetting {
		return new FluidSetting({ ...this, ...patch });
	}

	/** FluidSetting 인스턴스 또는 부분 객체를 FluidSetting 인스턴스로 정규화 */
	static from(input?: FluidSetting | Partial<FluidSetting>): FluidSetting {
		return input instanceof FluidSetting ? input : new FluidSetting(input);
	}
}

/**
 * 유기적 유체 파동 함수 (-1 ~ 1 근처).
 * 단일 사인파 대신 서로 다른 방향·파장·속도의 2D 공간 파동과 저차 윤곽 고조파를 중첩해
 * 비대칭적이고 자연스럽게 출렁이는 액체 표면을 만듭니다.
 */
export function computeFluidWave(
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

export { computeFluidWave as organicWave };

/**
 * 포인터 이벤트의 실제 대상이 [data-fd-barrier] 오버레이(예: BotArea) 내부이면서
 * 현재 유체 컴포넌트(selfEl)는 그 오버레이 바깥(뒤쪽)에 있는지 판별합니다.
 */
export function isPointerBlocked(
	target: EventTarget | null,
	selfEl: HTMLElement | null | undefined
): boolean {
	if (!(target instanceof Node) || !selfEl) return false;
	if (selfEl.contains(target)) return false;
	const el = target instanceof Element ? target : target.parentElement;
	const barrier = el?.closest('[data-fd-barrier]');
	return Boolean(barrier && !barrier.contains(selfEl));
}
