import { findMockArtistById, type CatalogArtist } from '#lib/config/artists';

export type ArtistVtPhase = 'idle' | 'entering' | 'leaving';

export interface CachedArtistState {
	artist: CatalogArtist;
	waveColor?: string;
}

export interface ArtistFeedSnapshot {
	artists: CatalogArtist[];
	currentPage: number;
	hasNext: boolean;
	query: string;
	genre: string;
}

function createArtistTransitionStore() {
	let vtPhase = $state<ArtistVtPhase>('idle');
	let vtArtistId = $state<number | null>(null);
	let accentColor = $state<string>('var(--surface-2)');
	let canUseHistoryBack = $state<boolean>(false);
	let feedSnapshot: ArtistFeedSnapshot | null = null;

	// 상세 진입/복귀 시 즉시 데이터를 그릴 수 있도록 아티스트 메타/추출 색상/팔로우 상태 캐시
	const artistCache = new Map<number, CachedArtistState>();
	const followOverride = $state<Record<number, boolean>>({});

	function applyOriginVars(x: number, y: number, r: number, color?: string) {
		if (typeof document === 'undefined') return;
		const vw = window.innerWidth || 1280;
		const vh = window.innerHeight || 800;
		const maxDist = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));

		const rootStyle = document.documentElement.style;
		rootStyle.setProperty('--vt-origin-x', `${x.toFixed(1)}px`);
		rootStyle.setProperty('--vt-origin-y', `${y.toFixed(1)}px`);
		rootStyle.setProperty('--vt-origin-r', `${Math.max(0, r).toFixed(1)}px`);
		rootStyle.setProperty('--vt-max-r', `${Math.ceil(maxDist) + 24}px`);
		if (color) {
			rootStyle.setProperty('--vt-accent-color', color);
			accentColor = color;
		}
	}

	function cacheArtists(list: CatalogArtist[]) {
		for (const item of list) {
			const prev = artistCache.get(item.id);
			artistCache.set(item.id, {
				artist: item,
				waveColor: prev?.waveColor
			});
		}
	}

	function cacheArtist(artist: CatalogArtist, waveColor?: string) {
		const prev = artistCache.get(artist.id);
		artistCache.set(artist.id, {
			artist,
			waveColor: waveColor ?? prev?.waveColor
		});
	}

	function getCachedArtist(id: number): CachedArtistState | null {
		const cached = artistCache.get(id);
		if (cached) return cached;
		const mock = findMockArtistById(id);
		if (mock) {
			return { artist: mock };
		}
		return null;
	}

	function setFollowing(id: number, following: boolean) {
		followOverride[id] = following;
	}

	function getFollowing(id: number): boolean | undefined {
		return followOverride[id];
	}

	function prepareEnter(
		artist: CatalogArtist,
		photoEl?: HTMLElement | null,
		waveColor?: string,
		following?: boolean
	) {
		cacheArtist(artist, waveColor);
		if (typeof following === 'boolean') {
			followOverride[artist.id] = following;
		}
		canUseHistoryBack = true;

		if (photoEl) {
			const rect = photoEl.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) {
				applyOriginVars(
					rect.left + rect.width / 2,
					rect.top + rect.height / 2,
					Math.min(rect.width, rect.height) / 2,
					waveColor
				);
				return;
			}
		}

		if (typeof window !== 'undefined') {
			applyOriginVars(window.innerWidth / 2, window.innerHeight / 2, 48, waveColor);
		}
	}

	function syncOriginFromDom(artistId: number): boolean {
		if (typeof document === 'undefined') return false;
		const el = document.querySelector<HTMLElement>(`[data-artist-photo="${artistId}"]`);
		if (el) {
			const rect = el.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) {
				const cached = artistCache.get(artistId);
				applyOriginVars(
					rect.left + rect.width / 2,
					rect.top + rect.height / 2,
					Math.min(rect.width, rect.height) / 2,
					cached?.waveColor
				);
				return true;
			}
		}

		if (typeof window !== 'undefined') {
			applyOriginVars(window.innerWidth / 2, window.innerHeight * 0.42, 36);
		}
		return false;
	}

	function beginTransition(phase: 'entering' | 'leaving', artistId: number) {
		vtPhase = phase;
		vtArtistId = artistId;
		if (typeof document !== 'undefined') {
			const html = document.documentElement;
			html.classList.remove('vt-artist-enter', 'vt-artist-leave');
			html.classList.add(phase === 'entering' ? 'vt-artist-enter' : 'vt-artist-leave');
		}
	}

	function clearTransition() {
		vtPhase = 'idle';
		vtArtistId = null;
		if (typeof document !== 'undefined') {
			document.documentElement.classList.remove('vt-artist-enter', 'vt-artist-leave');
		}
	}

	function saveFeedSnapshot(snapshot: ArtistFeedSnapshot) {
		feedSnapshot = {
			...snapshot,
			artists: [...snapshot.artists]
		};
	}

	function getFeedSnapshot(): ArtistFeedSnapshot | null {
		return feedSnapshot;
	}

	function clearFeedSnapshot() {
		feedSnapshot = null;
	}

	return {
		get vtPhase() {
			return vtPhase;
		},
		get vtArtistId() {
			return vtArtistId;
		},
		get accentColor() {
			return accentColor;
		},
		get canUseHistoryBack() {
			return canUseHistoryBack;
		},
		cacheArtists,
		cacheArtist,
		getCachedArtist,
		setFollowing,
		getFollowing,
		saveFeedSnapshot,
		getFeedSnapshot,
		clearFeedSnapshot,
		prepareEnter,
		syncOriginFromDom,
		beginTransition,
		clearTransition
	};
}

export const artistTransition = createArtistTransitionStore();
