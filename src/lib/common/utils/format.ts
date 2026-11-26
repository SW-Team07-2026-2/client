/** 원화 금액 포맷 (예: 35000 -> "35,000원") */
export function formatWon(price?: number | null): string {
	if (typeof price !== 'number' || !Number.isFinite(price)) return '';
	return `${price.toLocaleString('ko-KR')}원`;
}

/** 원화 가격 범위 포맷 (예: "35,000원 ~ 55,000원") */
export function formatWonRange(minPrice?: number | null, maxPrice?: number | null): string {
	if (typeof minPrice !== 'number' || !Number.isFinite(minPrice)) return '';
	if (typeof maxPrice === 'number' && Number.isFinite(maxPrice) && maxPrice > minPrice) {
		return `${minPrice.toLocaleString('ko-KR')}원 ~ ${maxPrice.toLocaleString('ko-KR')}원`;
	}
	return `${minPrice.toLocaleString('ko-KR')}원`;
}
