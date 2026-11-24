import { resolveArtistImageUrl, type CatalogArtist } from '#lib/config/artists';
import { detailOverlay, type DetailRect } from './detailOverlayState.svelte';

export type ExpandOriginRect = DetailRect;

export interface ArtistExpandOrigin {
	artistId: number;
	artist: CatalogArtist;
	following: boolean;
	waveColor: string;
	rect: ExpandOriginRect | null;
}

/**
 * 아티스트 목록 <-> 상세 간 아티스트 데이터 캐시 및 팔로우 상태 동기화 스토어.
 * (열기/닫기 전환 상태 머신은 카테고리 공통 detailOverlay 스토어가 담당)
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

	prepareEnter(origin: ArtistExpandOrigin): void {
		this.cacheArtist(origin.artist, origin.waveColor);
		this.setFollowing(origin.artistId, origin.following);
		detailOverlay.prepareOpen({
			category: 'artist',
			itemId: origin.artistId,
			originRect: origin.rect,
			imageSrc: resolveArtistImageUrl(origin.artist),
			shape: 'circle',
			accentColor: origin.waveColor
		});
	}
}

export const artistDetailState = new ArtistDetailStateStore();
