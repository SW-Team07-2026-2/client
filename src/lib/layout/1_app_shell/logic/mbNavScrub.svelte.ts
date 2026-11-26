import type { AppShellMobileNavItem } from './appShell.svelte';

export interface MbNavIndicatorRect {
	x: number;
	y: number;
	width: number;
	height: number;
	ready: boolean;
}

export interface MbNavScrubCallbacks {
	getItems: () => readonly AppShellMobileNavItem[];
	onSelect: (nextValue: string) => void;
	onActiveReselect: (currentValue: string) => void;
}

const DRAG_THRESHOLD_PX = 4;

/**
 * 모바일 하단 네비게이션바 전용 인디케이터 측정 및 좌우 드래그 스크러빙 컨트롤러
 * - 활성 선택 영역(알약)을 손가락/마우스로 잡고 좌우로 끌면 1:1 실시간으로 이동하며
 *   다른 탭 중심을 지나는 즉시 카테고리를 전환합니다.
 * - 터치(touchstart/touchmove non-passive)와 마우스(mousedown/window mousemove)를 모두 지원합니다.
 */
export class MbNavScrubController {
	activeValue = $state('');
	isDragging = $state(false);
	indicator = $state<MbNavIndicatorRect>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		ready: false
	});

	private trackEl: HTMLElement | null = null;
	private buttonEls: Array<HTMLButtonElement | undefined> = [];
	private callbacks: MbNavScrubCallbacks;

	private dragMode: 'touch' | 'mouse' | null = null;
	private activeTouchId: number | null = null;
	private startX = 0;
	private startY = 0;
	private grabOffsetX = 0;
	private minX = 0;
	private maxX = 0;
	private dragActivated = false;
	private suppressClickUntil = 0;

	constructor(initialValue: string, callbacks: MbNavScrubCallbacks) {
		this.activeValue = initialValue;
		this.callbacks = callbacks;
	}

	syncSelectedValue = (nextValue: string): void => {
		if (this.isDragging) return;
		if (this.activeValue !== nextValue) {
			this.activeValue = nextValue;
		}
		this.measureIndicator();
	};

	registerButton = (index: number, el: HTMLButtonElement | undefined): void => {
		this.buttonEls[index] = el;
	};

	measureIndicator = (): void => {
		if (this.isDragging || !this.trackEl) return;
		const items = this.callbacks.getItems();
		const activeIdx = items.findIndex((item) => item.value === this.activeValue);
		const btn = activeIdx >= 0 ? this.buttonEls[activeIdx] : this.buttonEls[0];
		if (!btn) return;

		this.indicator = {
			x: btn.offsetLeft,
			y: btn.offsetTop,
			width: btn.offsetWidth,
			height: btn.offsetHeight,
			ready: btn.offsetWidth > 0 && btn.offsetHeight > 0
		};
	};

	handleButtonClick = (e: MouseEvent, value: string): void => {
		if (performance.now() < this.suppressClickUntil) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		if (e.detail > 0) {
			(e.currentTarget as HTMLButtonElement | null)?.blur();
		}

		if (value === this.activeValue) {
			this.callbacks.onActiveReselect(value);
			return;
		}

		this.activeValue = value;
		this.measureIndicator();
		this.callbacks.onSelect(value);
	};

	/** 트랙 엘리먼트에 ResizeObserver 및 터치/마우스 드래그 리스너를 바인딩합니다. */
	attachTrack = (node: HTMLElement): (() => void) => {
		this.trackEl = node;
		this.measureIndicator();

		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.measureIndicator()) : null;
		ro?.observe(node);

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length !== 1) return;
			const touch = e.touches[0];
			if (!this.tryBeginPress('touch', touch.clientX, touch.clientY, e.target)) return;
			this.activeTouchId = touch.identifier;
		};

		const onTouchMove = (e: TouchEvent) => {
			if (this.dragMode !== 'touch' || this.activeTouchId === null) return;
			const touch = this.findTouch(e.touches, this.activeTouchId);
			if (!touch) return;
			const handled = this.handleMove(touch.clientX, touch.clientY);
			if (handled && e.cancelable) {
				e.preventDefault();
			}
		};

		const onTouchEnd = (e: TouchEvent) => {
			if (this.dragMode !== 'touch' || this.activeTouchId === null) return;
			const ended = this.findTouch(e.changedTouches, this.activeTouchId);
			if (!ended) return;
			this.endPress();
		};

		const onMouseDown = (e: MouseEvent) => {
			if (e.button !== 0) return;
			if (!this.tryBeginPress('mouse', e.clientX, e.clientY, e.target)) return;
			window.addEventListener('mousemove', onWindowMouseMove);
			window.addEventListener('mouseup', onWindowMouseUp);
		};

		const onWindowMouseMove = (e: MouseEvent) => {
			if (this.dragMode !== 'mouse') return;
			this.handleMove(e.clientX, e.clientY);
		};

		const onWindowMouseUp = () => {
			window.removeEventListener('mousemove', onWindowMouseMove);
			window.removeEventListener('mouseup', onWindowMouseUp);
			if (this.dragMode !== 'mouse') return;
			this.endPress();
		};

		node.addEventListener('touchstart', onTouchStart, { passive: true });
		node.addEventListener('touchmove', onTouchMove, { passive: false });
		node.addEventListener('touchend', onTouchEnd, { passive: true });
		node.addEventListener('touchcancel', onTouchEnd, { passive: true });
		node.addEventListener('mousedown', onMouseDown);

		return () => {
			ro?.disconnect();
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchEnd);
			node.removeEventListener('mousedown', onMouseDown);
			window.removeEventListener('mousemove', onWindowMouseMove);
			window.removeEventListener('mouseup', onWindowMouseUp);
			this.trackEl = null;
		};
	};

	private findTouch(list: TouchList, id: number): Touch | null {
		for (let i = 0; i < list.length; i++) {
			const t = list.item(i);
			if (t && t.identifier === id) return t;
		}
		return null;
	}

	private tryBeginPress(
		mode: 'touch' | 'mouse',
		clientX: number,
		clientY: number,
		target: EventTarget | null
	): boolean {
		if (!this.trackEl || !this.indicator.ready) return false;
		const items = this.callbacks.getItems();
		if (items.length < 2) return false;

		const rect = this.trackEl.getBoundingClientRect();
		const relX = clientX - rect.left;
		const targetEl = target as HTMLElement | null;

		const onActivePill =
			Boolean(targetEl?.closest('.mb-dock-btn.is-active')) ||
			(relX >= this.indicator.x && relX <= this.indicator.x + this.indicator.width);
		if (!onActivePill) return false;

		const firstBtn = this.buttonEls[0];
		const lastBtn = this.buttonEls[items.length - 1];
		if (!firstBtn || !lastBtn) return false;

		this.minX = firstBtn.offsetLeft;
		this.maxX = Math.max(this.minX, lastBtn.offsetLeft + lastBtn.offsetWidth - this.indicator.width);
		this.dragMode = mode;
		this.startX = clientX;
		this.startY = clientY;
		this.grabOffsetX = relX - this.indicator.x;
		this.dragActivated = false;
		return true;
	}

	private handleMove(clientX: number, clientY: number): boolean {
		if (!this.trackEl) return false;
		const dx = clientX - this.startX;
		const dy = clientY - this.startY;

		if (!this.dragActivated) {
			if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
				return false;
			}
			if (Math.abs(dy) > Math.abs(dx) * 1.25) {
				this.dragMode = null;
				this.activeTouchId = null;
				return false;
			}
			this.dragActivated = true;
			this.isDragging = true;
		}

		const rect = this.trackEl.getBoundingClientRect();
		const nextX = Math.max(this.minX, Math.min(this.maxX, clientX - rect.left - this.grabOffsetX));

		this.indicator = {
			...this.indicator,
			x: nextX
		};

		const nextValue = this.resolveClosestValue(nextX + this.indicator.width / 2);
		if (nextValue && nextValue !== this.activeValue) {
			this.activeValue = nextValue;
			this.callbacks.onSelect(nextValue);
			this.triggerHaptic();
		}

		return true;
	}

	private endPress(): void {
		const wasDragging = this.dragActivated;
		this.dragMode = null;
		this.activeTouchId = null;
		this.dragActivated = false;

		if (wasDragging) {
			this.isDragging = false;
			this.suppressClickUntil = performance.now() + 80;
			this.measureIndicator();
		}
	}

	private resolveClosestValue(centerX: number): string | null {
		const items = this.callbacks.getItems();
		let bestValue: string | null = null;
		let bestDist = Infinity;

		for (let i = 0; i < items.length; i++) {
			const btn = this.buttonEls[i];
			const item = items[i];
			if (!btn || !item) continue;
			const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
			const dist = Math.abs(centerX - btnCenter);
			if (dist < bestDist) {
				bestDist = dist;
				bestValue = item.value;
			}
		}

		return bestValue;
	}

	private triggerHaptic(): void {
		if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
			try {
				navigator.vibrate(8);
			} catch {
				// 진동 차단 환경 무시
			}
		}
	}
}
