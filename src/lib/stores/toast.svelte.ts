import type { ToastType } from '#lib/components/ui/FdToast.svelte';

/**
 * 전역 토스트 알림 싱글톤 매니저 (Svelte 5 Runes)
 *
 * 사용 예시:
 *   import { toast } from '#lib/stores';
 *   toast.success('저장이 완료되었습니다.');
 *   toast.error('네트워크 오류가 발생했습니다.');
 *   toast.info('새로운 소식이 있습니다.');
 */
class ToastManager {
	open = $state(false);
	type = $state<ToastType>('info');
	message = $state('');
	duration = $state(2000);
	triggerId = $state(0);

	/** 토스트 표시 */
	show(message: string, type: ToastType = 'info', duration = 2000): void {
		this.message = message;
		this.type = type;
		this.duration = duration;
		this.triggerId += 1;
		this.open = true;
	}

	/** 에러 토스트 표시 */
	error(message: string, duration = 2000): void {
		this.show(message, 'error', duration);
	}

	/** 안내 토스트 표시 */
	info(message: string, duration = 2000): void {
		this.show(message, 'info', duration);
	}

	/** 성공 토스트 표시 */
	success(message: string, duration = 2000): void {
		this.show(message, 'success', duration);
	}

	/** 토스트 즉시 닫기 */
	close(): void {
		this.open = false;
	}
}

export const toast = new ToastManager();
export default toast;
