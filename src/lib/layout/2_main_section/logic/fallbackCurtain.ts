/**
 * 독립 섹션(/cart, /checkout, /payments/*) -> 메인 섹션 복귀 시
 * 현재 뷰포트에 보이는 영역(100dvh)만 스냅샷 커튼으로 캡처·마운트·정리하는 헬퍼
 */
export interface FallbackExitSnapshot {
	el: HTMLElement;
	rectTop: number;
}

export class FallbackCurtainHelper {
	private fallbackPaneEl: HTMLDivElement | undefined;
	private exitHostEl: HTMLDivElement | undefined;
	private pendingSnapshot: FallbackExitSnapshot | null = null;

	registerPaneEl(el: HTMLDivElement | undefined): void {
		this.fallbackPaneEl = el;
	}

	registerExitHostEl(el: HTMLDivElement | undefined): void {
		this.exitHostEl = el;
	}

	get paneEl(): HTMLDivElement | undefined {
		return this.fallbackPaneEl;
	}

	/** 독립 섹션을 떠나 메인 섹션으로 복귀하기 직전에 현재 화면 스냅샷을 캡처합니다. */
	captureSnapshot(): void {
		if (!this.fallbackPaneEl) {
			this.pendingSnapshot = null;
			return;
		}
		const rectTop = this.fallbackPaneEl.getBoundingClientRect().top;
		const clone = this.fallbackPaneEl.cloneNode(true) as HTMLElement;
		clone.setAttribute('aria-hidden', 'true');
		clone.setAttribute('inert', '');
		this.pendingSnapshot = { el: clone, rectTop };
	}

	clearPendingSnapshot(): void {
		this.pendingSnapshot = null;
	}

	/** 캡처된 스냅샷을 100dvh 커튼 DOM에 마운트하고 애니메이션 대상 엘리먼트를 반환합니다. */
	mountExitCurtain(): HTMLElement | undefined {
		const snapshot = this.pendingSnapshot;
		this.pendingSnapshot = null;
		if (!snapshot || !this.exitHostEl || typeof document === 'undefined') return undefined;

		const curtain = document.createElement('div');
		curtain.className = 'fallback-exit-curtain';
		const { el: ghostEl, rectTop } = snapshot;
		ghostEl.style.position = 'absolute';
		ghostEl.style.top = `${Math.round(rectTop)}px`;
		ghostEl.style.left = '0';
		ghostEl.style.right = '0';
		ghostEl.style.pointerEvents = 'none';
		curtain.appendChild(ghostEl);
		this.exitHostEl.replaceChildren(curtain);
		return curtain;
	}

	/** 퇴장 커튼 및 대기 중인 스냅샷을 모두 정리합니다. */
	clear(): void {
		this.pendingSnapshot = null;
		if (this.exitHostEl) {
			this.exitHostEl.replaceChildren();
		}
	}
}
