import type { CatalogArtist } from '#lib/common/catalog/artists';

/**
 * 아티스트 목록 <-> 상세 간 아티스트 데이터 캐시 및 팔로우 상태 동기화 스토어.
 */
class ArtistDetailStateStore {
	private cache = new Map<number, { artist: CatalogArtist; waveColor?: string }>();
	private followOverrides = $state<Record<number, boolean>>({});

	cacheArtist(artist: CatalogArtist, waveColor?: string): void {
		const prev = this.cache.get(artist.id);
		this.cache.set(artist.id, {
			artist: { ...prev?.artist, ...artist },
			waveColor: waveColor ?? prev?.waveColor
		});
	}

	cacheArtists(artists: CatalogArtist[]): void {
		for (const artist of artists) {
			this.cacheArtist(artist);
		}
	}

	getCachedArtist(artistId: number): { artist: CatalogArtist; waveColor?: string } | null {
		return this.cache.get(artistId) ?? null;
	}

	setFollowing(artistId: number, following: boolean): void {
		if (this.followOverrides[artistId] === following) return;
		this.followOverrides = { ...this.followOverrides, [artistId]: following };
	}

	getFollowing(artistId: number): boolean | undefined {
		return this.followOverrides[artistId];
	}
}

export const artistDetailState = new ArtistDetailStateStore();
