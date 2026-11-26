import { FluidSetting } from '#lib/common/type/fluid';

/**
 * 공용 메인 CTA `FdButton` 프리셋 (장바구니 담기 · 주문하기 · 결제하기 · 결제 결과 메인 버튼)
 * - 버튼 폭에 비례해 가로 한 변당 물결이 항상 2~3개(약 2.5개) 유지되도록 `waveLength`를 계산합니다.
 */
const PRIMARY_CTA_ACTIVE_BASE = new FluidSetting({
	radius: 14,
	inset: 6,
	reach: 28,
	bulge: 4,
	bulgeWidth: 18,
	layers: 2,
	layerGap: 2.2,
	waveAmp: 2.4,
	waveLength: 88,
	spin: 1.2,
	pauseWhenIdle: true,
	color: 'var(--white-2)',
	hoverColor: 'var(--white)',
	pressColor: 'var(--white-3)',
	waveColor: 'var(--white-3)',
	hoverWaveColor: 'var(--white-3)',
	textColor: 'var(--bg)',
	borderWidth: 0
});

const PRIMARY_CTA_DISABLED_SETTING = PRIMARY_CTA_ACTIVE_BASE.with({
	hoverReactive: false,
	bulgeReactive: false,
	clickReactive: false,
	layerGap: 0,
	waveAmp: 0,
	color: 'var(--surface-2)',
	hoverColor: 'var(--surface-2)',
	pressColor: 'var(--surface-2)',
	waveColor: 'var(--surface-2)',
	hoverWaveColor: 'var(--surface-2)',
	textColor: 'var(--muted)'
});

/** 메인 CTA 버튼의 활성/비활성 상태와 현재 폭에 맞는 `FluidSetting`을 반환합니다. */
export function createPrimaryCtaSetting(width: number, disabled = false): FluidSetting {
	if (disabled) return PRIMARY_CTA_DISABLED_SETTING;
	const clampedWidth = Math.max(120, width);
	const waveLength = Math.max(48, Math.round(clampedWidth / 2.5));
	return PRIMARY_CTA_ACTIVE_BASE.with({ waveLength });
}
