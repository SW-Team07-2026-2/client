import type { CatalogConcert } from '#lib/common/catalog/concerts';

/**
 * 4-2_concert 목록 <-> 상세 간 공유 캐시 스토어
 * - 목록/달력에서 클릭한 공연 요약을 즉시 캐시해 상세 진입 시 빈 화면 없이 바로 표시합니다.
 */
class ConcertDetailStateStore {
	private cache = new Map<number, CatalogConcert>();

	cacheConcert(concert: CatalogConcert): void {
		this.cache.set(concert.id, concert);
	}

	cacheConcertList(concerts: readonly CatalogConcert[]): void {
		for (const item of concerts) {
			this.cache.set(item.id, item);
		}
	}

	getCachedConcert(id: number): CatalogConcert | null {
		return this.cache.get(id) ?? null;
	}
}

export const concertDetailState = new ConcertDetailStateStore();
