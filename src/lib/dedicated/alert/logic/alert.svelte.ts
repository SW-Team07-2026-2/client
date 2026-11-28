import { goto } from '$app/navigation';
import { api } from '#lib/auth';
import { toast } from '#lib/common/logic/toast.svelte';

export type AlertTargetType =
	| 'ALBUM'
	| 'PHYSICAL_ALBUM'
	| 'GOODS'
	| 'CONCERT'
	| 'ORDER'
	| 'BOOKING';

export interface AlertItem {
	id: number;
	type: string;
	target: AlertTargetType | string | null;
	targetId: number | null;
	artistId: number | null;
	message: string;
	isRead: boolean;
	createdAt: string;
}

interface AlertCursorResponse {
	items?: AlertItem[] | null;
	nextCursor?: string | null;
	hasNext?: boolean;
}

/** 알림 target/targetId를 앱 내부 경로로 매핑 */
function resolveAlertHref(item: AlertItem): string | null {
	const id = item.targetId;
	switch (item.target) {
		case 'CONCERT':
			return id ? `/concert/${id}` : '/concert';
		case 'ALBUM':
		case 'PHYSICAL_ALBUM':
			return id ? `/album/${id}` : '/album';
		case 'GOODS':
			return id ? `/goods/${id}` : '/goods';
		case 'ORDER':
		case 'BOOKING':
			return '/mypage';
		default:
			return item.artistId ? `/artist/${item.artistId}` : null;
	}
}

/**
 * 알림함 전용 로직 컨트롤러 (src/lib/dedicated/alert/logic)
 * - 알림 목록 커서 조회, 개별/전체 읽음 처리, 대상 화면 이동을 전담합니다.
 */
export class AlertController {
	items = $state<AlertItem[]>([]);
	isLoading = $state(false);
	isLoadingMore = $state(false);
	isMarkingAll = $state(false);
	errorMessage = $state<string | null>(null);
	nextCursor = $state<string | null>(null);
	hasNext = $state(false);

	private loaded = false;

	get unreadCount(): number {
		return this.items.filter((item) => !item.isRead).length;
	}

	/** 최초 1회 또는 강제 새로고침 시 알림 목록 조회 */
	load = async (force = false): Promise<void> => {
		if (this.isLoading) return;
		if (this.loaded && !force) return;

		this.isLoading = true;
		this.errorMessage = null;
		try {
			const res = await api<AlertCursorResponse>('/api/members/notifications?size=20');
			this.items = Array.isArray(res?.items) ? res.items : [];
			this.nextCursor = res?.nextCursor ?? null;
			this.hasNext = Boolean(res?.hasNext && this.nextCursor);
			this.loaded = true;
		} catch (err) {
			console.error('Failed to load notifications:', err);
			this.errorMessage = '알림을 불러오지 못했습니다.';
		} finally {
			this.isLoading = false;
		}
	};

	/** 다음 페이지 커서 추가 로드 */
	loadMore = async (): Promise<void> => {
		if (this.isLoading || this.isLoadingMore || !this.hasNext || !this.nextCursor) return;

		this.isLoadingMore = true;
		try {
			const qs = new URLSearchParams({ cursor: this.nextCursor, size: '20' });
			const res = await api<AlertCursorResponse>(`/api/members/notifications?${qs.toString()}`);
			const nextItems = Array.isArray(res?.items) ? res.items : [];
			const seen = new Set(this.items.map((item) => item.id));
			this.items = [...this.items, ...nextItems.filter((item) => !seen.has(item.id))];
			this.nextCursor = res?.nextCursor ?? null;
			this.hasNext = Boolean(res?.hasNext && this.nextCursor);
		} catch (err) {
			console.error('Failed to load more notifications:', err);
		} finally {
			this.isLoadingMore = false;
		}
	};

	/** 개별 알림 클릭: 읽음 처리 후 대상 페이지 이동 */
	handleItemClick = async (item: AlertItem): Promise<void> => {
		if (!item.isRead) {
			this.items = this.items.map((it) => (it.id === item.id ? { ...it, isRead: true } : it));
			try {
				await api(`/api/members/notifications/${item.id}/read`, { method: 'POST' });
			} catch (err) {
				const status = (err as { status?: number })?.status;
				if (status === 404) {
					this.items = this.items.filter((it) => it.id !== item.id);
				}
			}
		}

		const href = resolveAlertHref(item);
		if (href) {
			await goto(href, { reset: false });
		}
	};

	/** 전체 읽음 처리 */
	markAllRead = async (): Promise<void> => {
		if (this.isMarkingAll || this.unreadCount === 0) return;

		this.isMarkingAll = true;
		const prev = this.items;
		this.items = this.items.map((it) => ({ ...it, isRead: true }));
		try {
			await api('/api/members/notifications/read', { method: 'POST' });
		} catch (err) {
			console.error('Failed to mark all notifications read:', err);
			this.items = prev;
			toast.error('전체 읽음 처리에 실패했습니다.');
		} finally {
			this.isMarkingAll = false;
		}
	};
}

export function formatAlertTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const diffMs = Date.now() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return '방금 전';
	if (diffMin < 60) return `${diffMin}분 전`;
	const diffHour = Math.floor(diffMin / 60);
	if (diffHour < 24) return `${diffHour}시간 전`;
	const diffDay = Math.floor(diffHour / 24);
	if (diffDay < 7) return `${diffDay}일 전`;
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}.${m}.${day}`;
}
