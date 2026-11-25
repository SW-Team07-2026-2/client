export type ScrollRevealState = 'visible' | 'above' | 'below';

export interface ScrollRevealOptions {
	/** 상단 헤더 높이 등 위쪽 판정 여백 (px, 기본 64) */
	topMargin?: number;
	/** 하단 네비게이션 등 아래쪽 판정 여백 (px, 기본 24) */
	bottomMargin?: number;
	/** 가시성 임계 비율 (0 ~ 1, 기본 0.08) */
	threshold?: number;
	/** 비활성화 시 항상 visible 유지 */
	enabled?: boolean;
	/** 상태 변경 콜백 (선택) */
	onChange?: (state: ScrollRevealState) => void;
}

/**
 * 모바일 목록 아이템·섹션 공용 스크롤 진입/이탈 감지 Svelte action.
 * - 노드에 `data-scroll-reveal="visible" | "above" | "below"` 속성을 자동 부여합니다.
 * - `layout.css`의 `.mb-scroll-reveal` 클래스와 함께 사용하면 1줄로 상·하단 스크롤 모션을 적용할 수 있습니다.
 */
export function scrollReveal(node: HTMLElement, initialOptions: ScrollRevealOptions = {}) {
	let observer: IntersectionObserver | null = null;
	let currentState: ScrollRevealState = 'visible';

	function setState(next: ScrollRevealState, onChange?: (state: ScrollRevealState) => void) {
		if (currentState === next && node.dataset.scrollReveal === next) return;
		currentState = next;
		node.dataset.scrollReveal = next;
		onChange?.(next);
	}

	function teardown() {
		observer?.disconnect();
		observer = null;
	}

	function setup(opts: ScrollRevealOptions) {
		teardown();

		const enabled = opts.enabled ?? true;
		if (
			!enabled ||
			typeof window === 'undefined' ||
			typeof IntersectionObserver === 'undefined' ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			setState('visible', opts.onChange);
			return;
		}

		const topMargin = opts.topMargin ?? 64;
		const bottomMargin = opts.bottomMargin ?? 24;
		const threshold = opts.threshold ?? 0.08;

		// 초기 마운트 시 이미 뷰포트 위/아래에 있는 항목의 시작 상태 판별
		const rect = node.getBoundingClientRect();
		if (rect.top > window.innerHeight - bottomMargin) {
			setState('below', opts.onChange);
		} else if (rect.bottom < topMargin) {
			setState('above', opts.onChange);
		} else {
			setState('visible', opts.onChange);
		}

		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setState('visible', opts.onChange);
					} else {
						const rootTop = entry.rootBounds?.top ?? topMargin;
						setState(entry.boundingClientRect.top < rootTop ? 'above' : 'below', opts.onChange);
					}
				}
			},
			{
				root: null,
				rootMargin: `-${topMargin}px 0px -${bottomMargin}px 0px`,
				threshold
			}
		);

		observer.observe(node);
	}

	setup(initialOptions);

	return {
		update(nextOptions: ScrollRevealOptions = {}) {
			setup(nextOptions);
		},
		destroy() {
			teardown();
			delete node.dataset.scrollReveal;
		}
	};
}
