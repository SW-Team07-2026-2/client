export type AlertDialogFrom = 'top' | 'bottom' | 'left' | 'right';
export type AlertDialogSize = 'default' | 'sm';
export type AlertDialogVariant = 'default' | 'danger' | 'warning';

export interface AlertDialogOptions {
	/** 다이얼로그 제목 */
	title: string;
	/** 본문 설명 */
	description?: string;
	/** 확인 버튼 문구 (기본값: '확인') */
	confirmText?: string;
	/** 취소 버튼 문구 (기본값: '취소') */
	cancelText?: string;
	/** true면 취소 버튼을 숨기고 단일 확인 버튼만 표시 */
	hideCancel?: boolean;
	/** 확인 버튼 강조 톤 ('default' | 'danger' | 'warning') */
	variant?: AlertDialogVariant;
	/** 진입·퇴장 방향 ('top' | 'bottom' | 'left' | 'right', 기본값: 'top') */
	from?: AlertDialogFrom;
	/** 다이얼로그 크기 ('default' | 'sm', 기본값: 'default') */
	size?: AlertDialogSize;
	/** 배경(오버레이) 클릭으로 닫기 허용 여부 (기본값: false) */
	closeOnOverlay?: boolean;
	/** Escape 키로 닫기 허용 여부 (기본값: true) */
	closeOnEscape?: boolean;
	/** 확인 클릭 시 실행할 콜백 (Promise 반환 시 완료까지 로딩 상태 유지) */
	onConfirm?: () => void | Promise<void>;
	/** 취소·닫기 시 실행할 콜백 */
	onCancel?: () => void;
}

export interface AlertDialogEntry {
	id: number;
	title: string;
	description?: string;
	confirmText: string;
	cancelText: string;
	hideCancel: boolean;
	variant: AlertDialogVariant;
	from: AlertDialogFrom;
	size: AlertDialogSize;
	closeOnOverlay: boolean;
	closeOnEscape: boolean;
	phase: 'entering' | 'open' | 'exiting';
	busy: boolean;
	onConfirm?: () => void | Promise<void>;
	onCancel?: () => void;
	resolve: (confirmed: boolean) => void;
}

const EXIT_DURATION_MS = 220;

function normalizeOptions(
	input: string | AlertDialogOptions,
	description?: string
): AlertDialogOptions {
	if (typeof input === 'string') {
		return { title: input, description };
	}
	return input;
}

/**
 * 전역 AlertDialog 매니저 (Svelte 5 Runes · toast와 동일한 명령형 사용 패턴)
 *
 * 사용 예시:
 *   import { alertDialog } from '#lib/common/logic';
 *
 *   const ok = await alertDialog.confirm({
 *     title: '정말 삭제하시겠습니까?',
 *     description: '삭제한 항목은 되돌릴 수 없습니다.',
 *     confirmText: '삭제',
 *     variant: 'danger',
 *     from: 'top'
 *   });
 *
 *   await alertDialog.alert('저장이 완료되었습니다.');
 *   await alertDialog.danger('계정을 삭제할까요?', '모든 데이터가 영구 삭제됩니다.');
 */
class AlertDialogManager {
	/** 현재 화면에 표시 중인 다이얼로그 (없으면 null) */
	current = $state<AlertDialogEntry | null>(null);

	private nextId = 0;
	private queue: AlertDialogEntry[] = [];
	private exitTimer: ReturnType<typeof setTimeout> | null = null;

	/** 옵션 기반으로 다이얼로그 열기 (확인: true, 취소/닫기: false) */
	open(options: AlertDialogOptions): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const entry: AlertDialogEntry = {
				id: ++this.nextId,
				title: options.title,
				description: options.description,
				confirmText: options.confirmText ?? '확인',
				cancelText: options.cancelText ?? '취소',
				hideCancel: options.hideCancel ?? false,
				variant: options.variant ?? 'default',
				from: options.from ?? 'top',
				size: options.size ?? 'default',
				closeOnOverlay: options.closeOnOverlay ?? false,
				closeOnEscape: options.closeOnEscape ?? true,
				phase: 'entering',
				busy: false,
				onConfirm: options.onConfirm,
				onCancel: options.onCancel,
				resolve
			};

			if (this.current) {
				this.queue.push(entry);
				return;
			}

			this.activate(entry);
		});
	}

	/** 확인/취소 다이얼로그 */
	confirm(input: string | AlertDialogOptions, description?: string): Promise<boolean> {
		const opts = normalizeOptions(input, description);
		return this.open({
			confirmText: '계속',
			cancelText: '취소',
			...opts,
			hideCancel: false
		});
	}

	/** 위험 동작 확인 다이얼로그 (붉은 강조 확인 버튼) */
	danger(input: string | AlertDialogOptions, description?: string): Promise<boolean> {
		const opts = normalizeOptions(input, description);
		return this.open({
			confirmText: '삭제',
			cancelText: '취소',
			variant: 'danger',
			...opts,
			hideCancel: false
		});
	}

	/** 단일 확인 버튼 알림 다이얼로그 */
	alert(input: string | AlertDialogOptions, description?: string): Promise<boolean> {
		const opts = normalizeOptions(input, description);
		return this.open({
			confirmText: '확인',
			...opts,
			hideCancel: true
		});
	}

	/** 확인 액션 처리 (비동기 onConfirm 지원) */
	async handleConfirm(): Promise<void> {
		const target = this.current;
		if (!target || target.phase === 'exiting' || target.busy) return;

		if (target.onConfirm) {
			target.busy = true;
			try {
				await target.onConfirm();
			} catch (err) {
				target.busy = false;
				throw err;
			}
			target.busy = false;
		}

		this.close(true);
	}

	/** 취소·닫기 액션 처리 */
	handleCancel(): void {
		const target = this.current;
		if (!target || target.phase === 'exiting' || target.busy) return;
		target.onCancel?.();
		this.close(false);
	}

	/** 현재 다이얼로그 닫기 */
	close(confirmed: boolean = false): void {
		const target = this.current;
		if (!target || target.phase === 'exiting') return;

		target.phase = 'exiting';
		const closingId = target.id;

		if (this.exitTimer) {
			clearTimeout(this.exitTimer);
			this.exitTimer = null;
		}

		this.exitTimer = setTimeout(() => {
			this.exitTimer = null;
			if (this.current?.id === closingId) {
				this.current = null;
			}
			target.resolve(confirmed);

			const next = this.queue.shift();
			if (next) {
				this.activate(next);
			}
		}, EXIT_DURATION_MS);
	}

	/** 대기열 포함 모든 다이얼로그 강제 초기화 */
	clear(): void {
		if (this.exitTimer) {
			clearTimeout(this.exitTimer);
			this.exitTimer = null;
		}
		if (this.current) {
			const active = this.current;
			this.current = null;
			active.resolve(false);
		}
		while (this.queue.length > 0) {
			this.queue.shift()?.resolve(false);
		}
	}

	private activate(entry: AlertDialogEntry): void {
		this.current = entry;
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				if (this.current?.id === entry.id && this.current.phase === 'entering') {
					this.current.phase = 'open';
				}
			});
		} else {
			entry.phase = 'open';
		}
	}
}

export const alertDialog = new AlertDialogManager();
