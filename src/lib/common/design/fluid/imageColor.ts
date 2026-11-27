const colorCache = new Map<string, string>();
const corsBlockedUrls = new Set<string>();
const MAX_CACHE_SIZE = 240;

function isInlineUrl(url: string): boolean {
	return url.startsWith('data:') || url.startsWith('blob:');
}

/** 해당 이미지 URL에 crossorigin="anonymous" 속성을 붙여도 되는지 URL 단위로 판별 */
export function resolveImageCrossOrigin(url: string): 'anonymous' | undefined {
	const trimmed = url.trim();
	if (!trimmed || isInlineUrl(trimmed)) return undefined;
	if (corsBlockedUrls.has(trimmed)) return undefined;
	return 'anonymous';
}

/** CORS 로드가 실패한 개별 URL만 기록 (같은 CDN origin의 다른 정상 이미지까지 막지 않음) */
export function markImageCorsBlocked(url: string): void {
	const trimmed = url.trim();
	if (!trimmed) return;
	if (corsBlockedUrls.size >= MAX_CACHE_SIZE) {
		const oldest = corsBlockedUrls.values().next().value;
		if (oldest !== undefined) corsBlockedUrls.delete(oldest);
	}
	corsBlockedUrls.add(trimmed);
}

export interface ImageAverageColorOptions {
	/** 추출 색상에 섞을 흰색 비율 (0 ~ 1, 예: 0.45 = 흰색 45% 혼합) */
	whiteMix?: number;
	/** 채도 증폭 배율 (1 = 원본, 예: 1.45 = 채도 45% 강조) */
	saturationBoost?: number;
}

function buildCacheKey(url: string, opts?: ImageAverageColorOptions): string {
	const whiteMix = opts?.whiteMix ?? 0;
	const satBoost = opts?.saturationBoost ?? 1;
	return whiteMix === 0 && satBoost === 1 ? url : `${url}|w:${whiteMix}|s:${satBoost}`;
}

export function boostSaturationAndMixWhite(
	r: number,
	g: number,
	b: number,
	whiteMix = 0,
	saturationBoost = 1
): [number, number, number] {
	let rn = r / 255;
	let gn = g / 255;
	let bn = b / 255;

	if (saturationBoost !== 1) {
		const max = Math.max(rn, gn, bn);
		const min = Math.min(rn, gn, bn);
		const d = max - min;
		const l = (max + min) / 2;

		if (d > 0.0001) {
			const s = d / (1 - Math.abs(2 * l - 1));
			// 무채색에 가까운 흑백 커버는 억지로 색을 만들지 않고 유채색일 때만 채도 증폭
			if (s > 0.04) {
				let h = 0;
				if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
				else if (max === gn) h = ((bn - rn) / d + 2) / 6;
				else h = ((rn - gn) / d + 4) / 6;

				const ns = Math.min(1, s * saturationBoost);
				const c = (1 - Math.abs(2 * l - 1)) * ns;
				const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
				const m = l - c / 2;

				const sector = Math.floor(h * 6) % 6;
				if (sector === 0) [rn, gn, bn] = [c + m, x + m, m];
				else if (sector === 1) [rn, gn, bn] = [x + m, c + m, m];
				else if (sector === 2) [rn, gn, bn] = [m, c + m, x + m];
				else if (sector === 3) [rn, gn, bn] = [m, x + m, c + m];
				else if (sector === 4) [rn, gn, bn] = [x + m, m, c + m];
				else [rn, gn, bn] = [c + m, m, x + m];
			}
		}
	}

	const mix = Math.max(0, Math.min(1, whiteMix));
	const outR = Math.round((rn * (1 - mix) + mix) * 255);
	const outG = Math.round((gn * (1 - mix) + mix) * 255);
	const outB = Math.round((bn * (1 - mix) + mix) * 255);
	return [outR, outG, outB];
}

export function getCachedImageAverageColor(
	url: string,
	options?: ImageAverageColorOptions
): string | null {
	const trimmed = url.trim();
	if (!trimmed) return null;
	return colorCache.get(buildCacheKey(trimmed, options)) ?? null;
}

/**
 * 로드 완료된 <img> 엘리먼트에서 전체 평균 색상을 추출합니다.
 * options로 채도 강조(saturationBoost)와 흰색 혼합(whiteMix)을 적용할 수 있습니다.
 * CORS 오염 캔버스나 읽기 오류 시 null을 반환합니다.
 */
export function extractImageAverageColor(
	img: HTMLImageElement,
	cacheKey?: string,
	options?: ImageAverageColorOptions
): string | null {
	if (typeof document === 'undefined' || !img.complete || img.naturalWidth === 0) {
		return null;
	}

	const rawUrl = cacheKey?.trim() || img.currentSrc || img.src;
	const key = buildCacheKey(rawUrl, options);
	const cached = colorCache.get(key);
	if (cached) return cached;

	try {
		const size = 24;
		const off = document.createElement('canvas');
		off.width = size;
		off.height = size;
		const ctx = off.getContext('2d', { willReadFrequently: true });
		if (!ctx) return null;

		ctx.drawImage(img, 0, 0, size, size);
		const data = ctx.getImageData(0, 0, size, size).data;

		let rSum = 0;
		let gSum = 0;
		let bSum = 0;
		let count = 0;

		for (let i = 0; i < data.length; i += 4) {
			const a = data[i + 3];
			if (a < 24) continue;
			rSum += data[i];
			gSum += data[i + 1];
			bSum += data[i + 2];
			count++;
		}

		if (count === 0) return null;

		const [r, g, b] = boostSaturationAndMixWhite(
			rSum / count,
			gSum / count,
			bSum / count,
			options?.whiteMix ?? 0,
			options?.saturationBoost ?? 1
		);
		const color = `rgb(${r}, ${g}, ${b})`;

		if (colorCache.size >= MAX_CACHE_SIZE) {
			const oldest = colorCache.keys().next().value;
			if (oldest !== undefined) colorCache.delete(oldest);
		}
		colorCache.set(key, color);
		return color;
	} catch {
		if (rawUrl) markImageCorsBlocked(rawUrl);
		return null;
	}
}

export const DETAIL_GLOW_COLOR_OPTIONS: ImageAverageColorOptions = {
	whiteMix: 0.12,
	saturationBoost: 1.85
};

/**
 * 이미지 URL에서 직접 평균 색상을 비동기 추출합니다.
 * 상세 페이지 앰비언트 배경 글로우(DetailAmbientGlow) 등에서 <img> 엘리먼트 없이도 사용할 수 있습니다.
 */
export function loadImageAverageColor(
	url?: string | null,
	options: ImageAverageColorOptions = DETAIL_GLOW_COLOR_OPTIONS
): Promise<string | null> {
	const trimmed = url?.trim() ?? '';
	if (!trimmed || typeof window === 'undefined') return Promise.resolve(null);

	const cached = getCachedImageAverageColor(trimmed, options);
	if (cached) return Promise.resolve(cached);

	const crossOrigin = resolveImageCrossOrigin(trimmed);
	if (!crossOrigin && !isInlineUrl(trimmed)) return Promise.resolve(null);

	return new Promise((resolve) => {
		const img = new Image();
		if (crossOrigin) img.crossOrigin = crossOrigin;
		img.decoding = 'async';
		img.onload = () => {
			resolve(extractImageAverageColor(img, trimmed, options));
		};
		img.onerror = () => {
			markImageCorsBlocked(trimmed);
			resolve(null);
		};
		img.src = trimmed;
	});
}
