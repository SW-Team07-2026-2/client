/**
 * 상세 페이지 4종(아티스트 · 공연 · 앨범 · 굿즈) 공용 앰비언트 글로우 · FdImage 웨이브 계산 헬퍼
 */

/** 이미지에서 추출된 색상이 유효하면 우선 사용하고, 미추출/폴백 토큰이면 사전 계산된 accentColor 반환 */
export function resolveDetailGlowColor(extractedWaveColor: string, accentColor: string): string {
	return extractedWaveColor &&
		extractedWaveColor !== 'var(--muted-wave)' &&
		extractedWaveColor !== 'var(--white)'
		? extractedWaveColor
		: accentColor;
}

/**
 * 직사각형(비율 heightRatio = H / W) 히어로 이미지 크기에 비례해
 * 한 변당 일정한 물결 개수를 유지하는 FdImage setting 객체를 생성합니다.
 */
export function createWaveRectSetting(
	width: number,
	heightRatio: number,
	radius: number,
	wavesPerEdge = 2.5,
	pauseWhenIdle = false
): { radius: number; waveLength: number; pauseWhenIdle: boolean } {
	const w = Math.max(160, width);
	const h = w * heightRatio;
	const perimeter = 2 * (w + h) - 1.717 * radius;
	const waveLength = Math.round(perimeter / (wavesPerEdge * 4));
	return {
		radius,
		waveLength,
		pauseWhenIdle
	};
}
