export interface NotificationItem {
	id: string;
	title: string;
	body: string;
	createdAt: string;
	read: boolean;
}

/**
 * 1_app_shell/part/notification 전용 로직 컨트롤러
 * - 알림 목록 조회/읽음 처리 상태 전담 (design 컴포넌트는 순수 렌더링)
 */
export class NotificationController {
	items = $state<NotificationItem[]>([]);
	isLoading = $state(false);

	get unreadCount(): number {
		return this.items.filter((item) => !item.read).length;
	}
}
