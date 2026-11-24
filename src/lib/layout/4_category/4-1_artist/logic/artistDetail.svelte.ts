import { api, auth } from '#lib/auth/auth.svelte';
import {
	mapArtistDetail,
	type ArtistDetailDto,
	type CatalogArtist
} from '#lib/config/artists';
import { artistDetailState, toast } from '#lib/common/logic';

/**
 * 4-1_artist 상세 페이지 전용 컨트롤러
 * - 캐시된 아티스트 즉시 복원 + GET /api/catalog/artists/{id} 상세 조회
 * - 팔로우 상태 조회/토글(M4·M5·M7), 링크 공유, 상세 보기 패널 토글 관리
 */
export class ArtistDetailController {
	artist = $state<CatalogArtist | null>(null);
	isLoading = $state(false);
	errorMessage = $state<string | null>(null);
	following = $state(false);
	followLoading = $state(false);
	moreOpen = $state(false);
	accentColor = $state<string>('var(--white)');

	private currentId: number | null = null;
	private loadToken = 0;

	/** artistId 변경 시 캐시 즉시 반영 후 상세·팔로우 상태 비동기 동기화 */
	load = (artistId: number): void => {
		if (this.currentId === artistId && this.artist) return;
		this.currentId = artistId;
		this.moreOpen = false;
		this.errorMessage = null;

		const cached = artistDetailState.getCachedArtist(artistId);
		this.artist = cached?.artist ?? null;
		this.accentColor = cached?.waveColor || 'var(--white)';

		const cachedFollow = artistDetailState.getFollowing(artistId);
		this.following = cachedFollow ?? false;

		const token = ++this.loadToken;
		void this.fetchDetail(artistId, token);
		if (auth.isLoggedIn) {
			void this.fetchFollowStatus(artistId, token);
		}
	};

	toggleMore = (): void => {
		this.moreOpen = !this.moreOpen;
	};

	setAccentColor = (color: string): void => {
		const trimmed = color?.trim();
		if (!trimmed || trimmed === 'var(--muted-wave)') {
			this.accentColor = 'var(--white)';
			return;
		}
		this.accentColor = trimmed;
	};

	/** M4 POST / M5 DELETE /api/members/follows/{artistId} */
	toggleFollow = async (): Promise<void> => {
		const targetId = this.currentId;
		if (targetId === null || this.followLoading) return;

		if (!auth.isLoggedIn) {
			toast.info('로그인 후 아티스트를 팔로우할 수 있습니다.');
			return;
		}

		const prev = this.following;
		const next = !prev;
		this.following = next;
		this.followLoading = true;
		artistDetailState.setFollowing(targetId, next);

		try {
			if (next) {
				await api<{ artistId: number; following: boolean }>(`/api/members/follows/${targetId}`, {
					method: 'POST'
				});
			} else {
				await api<void>(`/api/members/follows/${targetId}`, {
					method: 'DELETE'
				});
			}
		} catch (err) {
			console.error('Artist detail follow toggle failed:', err);
			this.following = prev;
			artistDetailState.setFollowing(targetId, prev);
			toast.error('팔로우 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
		} finally {
			this.followLoading = false;
		}
	};

	/** 현재 아티스트 페이지 URL 공유(클립보드 복사) */
	shareLink = async (): Promise<void> => {
		if (typeof window === 'undefined') return;
		const url = window.location.href;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(url);
				toast.success('아티스트 링크가 복사되었습니다.');
				return;
			}
		} catch {
			// 클립보드 API 실패 시 폴백 시도
		}

		try {
			const input = document.createElement('input');
			input.value = url;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
			toast.success('아티스트 링크가 복사되었습니다.');
		} catch {
			toast.error('링크를 복사하지 못했습니다.');
		}
	};

	private async fetchDetail(artistId: number, token: number): Promise<void> {
		if (!this.artist) {
			this.isLoading = true;
		}

		try {
			const dto = await api<ArtistDetailDto>(`/api/catalog/artists/${artistId}`);
			if (token !== this.loadToken || !dto) return;
			const mapped = mapArtistDetail(dto);
			this.artist = mapped;
			artistDetailState.cacheArtist(mapped, this.accentColor);
		} catch (err) {
			if (token !== this.loadToken) return;
			console.error('Failed to fetch artist detail:', err);
			if (!this.artist) {
				this.errorMessage = '아티스트 정보를 불러오지 못했습니다.';
			}
		} finally {
			if (token === this.loadToken) {
				this.isLoading = false;
			}
		}
	}

	private async fetchFollowStatus(artistId: number, token: number): Promise<void> {
		try {
			const res = await api<{ following: boolean }>(`/api/members/follows/${artistId}`);
			if (token !== this.loadToken || typeof res?.following !== 'boolean') return;
			this.following = res.following;
			artistDetailState.setFollowing(artistId, res.following);
		} catch {
			// 팔로우 여부 조회 실패 시 기존 상태 유지
		}
	}
}
