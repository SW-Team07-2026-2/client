/**
 * 초기 렌더링 이후 유휴 시간(requestIdleCallback / setTimeout)을 활용해
 * 미마운트 Keep-Alive 섹션을 순차 프리마운트하는 경량 스케줄러
 */
export class IdlePremountScheduler {
	private timers: ReturnType<typeof setTimeout>[] = [];
	private idleIds: number[] = [];

	schedule<K extends string>(
		keys: readonly K[],
		isMounted: (key: K) => boolean,
		mount: (key: K) => void,
		initialDelayMs = 180,
		staggerMs = 160
	): void {
		if (typeof window === 'undefined') return;
		const unmounted = keys.filter((key) => !isMounted(key));
		unmounted.forEach((key, idx) => {
			const timer = setTimeout(
				() => {
					if (isMounted(key)) return;
					if (typeof window.requestIdleCallback === 'function') {
						const id = window.requestIdleCallback(
							() => {
								mount(key);
							},
							{ timeout: 600 }
						);
						this.idleIds.push(id);
					} else {
						mount(key);
					}
				},
				initialDelayMs + idx * staggerMs
			);
			this.timers.push(timer);
		});
	}

	cancelAll(): void {
		for (const t of this.timers) clearTimeout(t);
		this.timers = [];
		if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
			for (const id of this.idleIds) window.cancelIdleCallback(id);
		}
		this.idleIds = [];
	}
}
