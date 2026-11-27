export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';
export type ToastSwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface ToastOptions {
	title?: string;
	description?: string;
	type?: ToastType;
	duration?: number;
	progressBar?: boolean;
}

export interface ToastItem {
	id: number;
	type: ToastType;
	message: string;
	description?: string;
	duration: number;
	progressBar?: boolean;
	state: 'entering' | 'open' | 'exiting';
	exitReason: 'timeout' | 'dismiss' | 'swipe' | null;
	swipeExit?: { x: number; y: number; durationMs: number };
	remainingMs: number;
	startedAt: number;
	updateKey: number;
}

const DEFAULT_DURATION_MS = 3500;
const MAX_VISIBLE_TOASTS = 4;
const EXIT_REMOVE_MS = 240;

/**
 * 전역 스택형 토스트 매니저 (Svelte 5 Runes · Animate UI 스펙 호환)
 *
 * 사용 예시:
 *   import { toast } from '#lib/common/logic';
 *   toast.success('저장이 완료되었습니다.');
 *   toast.error('네트워크 오류가 발생했습니다.');
 *   toast.info('새로운 소식이 있습니다.');
 *   const id = toast.loading('처리 중...');
 *   toast.update(id, { type: 'success', title: '완료되었습니다.' });
 */
class ToastManager {
	/** 최신 토스트가 앞쪽(index 0)에 오는 스택 배열 */
	items = $state<ToastItem[]>([]);
	paused = $state(false);

	private nextId = 0;
	private timers = new Map<number, ReturnType<typeof setTimeout>>();
	private removeTimers = new Map<number, ReturnType<typeof setTimeout>>();

	/** 토스트 추가 (생성된 id 반환) */
	show(message: string, type: ToastType = 'info', duration?: number): number {
		const id = ++this.nextId;
		const resolvedDuration =
			type === 'loading' ? 0 : typeof duration === 'number' ? duration : DEFAULT_DURATION_MS;
		const now = performance.now();

		const entry: ToastItem = {
			id,
			type,
			message,
			duration: resolvedDuration,
			state: 'entering',
			exitReason: null,
			remainingMs: resolvedDuration,
			startedAt: now,
			updateKey: 0
		};

		this.items = [entry, ...this.items];

		// 다음 프레임에 open 상태로 전환해 CSS 스프링 진입 애니메이션 트리거
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				const target = this.items.find((t) => t.id === id);
				if (target && target.state === 'entering') {
					target.state = 'open';
				}
			});
		} else {
			entry.state = 'open';
		}

		// 최대 노출 개수 초과 시 가장 오래된 활성 토스트 자동 종료
		const activeItems = this.items.filter((t) => t.state !== 'exiting');
		if (activeItems.length > MAX_VISIBLE_TOASTS) {
			const overflow = activeItems.slice(MAX_VISIBLE_TOASTS);
			for (const old of overflow) {
				this.dismiss(old.id, 'timeout');
			}
		}

		if (resolvedDuration > 0 && !this.paused) {
			this.scheduleTimer(id, resolvedDuration);
		}

		return id;
	}

	/** 에러 토스트 표시 */
	error(message: string, duration = DEFAULT_DURATION_MS): number {
		return this.show(message, 'error', duration);
	}

	/** 안내 토스트 표시 */
	info(message: string, duration = DEFAULT_DURATION_MS): number {
		return this.show(message, 'info', duration);
	}

	/** 성공 토스트 표시 */
	success(message: string, duration = DEFAULT_DURATION_MS): number {
		return this.show(message, 'success', duration);
	}

	/** 경고 토스트 표시 */
	warning(message: string, duration = DEFAULT_DURATION_MS): number {
		return this.show(message, 'warning', duration);
	}

	/** 로딩 토스트 표시 (자동 닫힘 없음 · update로 결과 전환) */
	loading(message: string): number {
		return this.show(message, 'loading', 0);
	}

	/** 기존 토스트를 제자리에서 상태/문구 업데이트 (promise · loading → success/error 전환) */
	update(id: number, patch: ToastOptions): void {
		const target = this.items.find((t) => t.id === id);
		if (!target || target.state === 'exiting') return;

		this.clearTimer(id);

		if (patch.type !== undefined) target.type = patch.type;
		if (patch.title !== undefined) target.message = patch.title;
		if (patch.description !== undefined) target.description = patch.description;
		if (patch.progressBar !== undefined) target.progressBar = patch.progressBar;

		const nextDuration =
			target.type === 'loading'
				? 0
				: typeof patch.duration === 'number'
					? patch.duration
					: DEFAULT_DURATION_MS;

		target.duration = nextDuration;
		target.remainingMs = nextDuration;
		target.startedAt = performance.now();
		target.updateKey += 1;

		if (nextDuration > 0 && !this.paused) {
			this.scheduleTimer(id, nextDuration);
		}
	}

	/** Promise 상태에 따라 하나의 토스트를 loading → success / error로 제자리 전환 */
	promise<T>(
		promise: Promise<T>,
		messages: {
			loading: string;
			success: string | ((value: T) => string);
			error: string | ((err: unknown) => string);
		}
	): Promise<T> {
		const id = this.loading(messages.loading);
		return promise.then(
			(val) => {
				const msg =
					typeof messages.success === 'function' ? messages.success(val) : messages.success;
				this.update(id, { type: 'success', title: msg });
				return val;
			},
			(err) => {
				const msg = typeof messages.error === 'function' ? messages.error(err) : messages.error;
				this.update(id, { type: 'error', title: msg });
				throw err;
			}
		);
	}

	/** 특정 토스트 닫기 (종료 애니메이션 후 DOM 제거) */
	dismiss(
		id: number,
		reason: 'timeout' | 'dismiss' | 'swipe' = 'dismiss',
		swipeExit?: { x: number; y: number; durationMs: number }
	): void {
		const target = this.items.find((t) => t.id === id);
		if (!target || target.state === 'exiting') return;

		this.clearTimer(id);
		target.state = 'exiting';
		target.exitReason = reason;
		if (swipeExit) {
			target.swipeExit = swipeExit;
		}

		const waitMs = swipeExit ? Math.max(100, swipeExit.durationMs + 30) : EXIT_REMOVE_MS;
		const prevRemove = this.removeTimers.get(id);
		if (prevRemove) clearTimeout(prevRemove);
		const timer = setTimeout(() => {
			this.removeTimers.delete(id);
			this.items = this.items.filter((t) => t.id !== id);
		}, waitMs);
		this.removeTimers.set(id, timer);
	}

	/** 모든 토스트 즉시 닫기 */
	close(): void {
		for (const item of this.items) {
			this.dismiss(item.id, 'dismiss');
		}
	}

	/** 호버·포커스·탭 비활성 시 모든 활성 타이머 일시정지 */
	pauseAll(): void {
		if (this.paused) return;
		this.paused = true;
		const now = performance.now();
		for (const item of this.items) {
			if (item.state === 'exiting' || item.duration <= 0) continue;
			this.clearTimer(item.id);
			const elapsed = Math.max(0, now - item.startedAt);
			item.remainingMs = Math.max(0, item.remainingMs - elapsed);
		}
	}

	/** 남은 시간부터 타이머 재개 */
	resumeAll(): void {
		if (!this.paused) return;
		this.paused = false;
		const now = performance.now();
		for (const item of this.items) {
			if (item.state === 'exiting' || item.duration <= 0) continue;
			item.startedAt = now;
			if (item.remainingMs <= 30) {
				this.dismiss(item.id, 'timeout');
			} else {
				this.scheduleTimer(item.id, item.remainingMs);
			}
		}
	}

	private scheduleTimer(id: number, ms: number): void {
		this.clearTimer(id);
		const timer = setTimeout(() => {
			this.timers.delete(id);
			this.dismiss(id, 'timeout');
		}, ms);
		this.timers.set(id, timer);
	}

	private clearTimer(id: number): void {
		const timer = this.timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(id);
		}
	}
}

export const toast = new ToastManager();
export default toast;
