<script lang="ts">
	import { onDestroy, onMount, tick, untrack, type Snippet } from 'svelte';
	import { prefersReducedMotion } from '#lib/common/type/spring';
	import type { MobileShellPane } from '../logic/appShell.svelte';
	import { showMobileHeader } from '../logic/mobileScrollVisibility.svelte';

	interface ActorBox {
		left: number;
		top: number;
		width: number;
		height: number;
	}

	interface Props {
		/** 현재 활성 패널 ('left' | 'center' | 'right') */
		activePane: MobileShellPane;
		/** 중앙 패널일 때 MbHeader가 스크롤로 숨겨졌는지 여부 (단일 액터도 함께 숨김) */
		centerHeaderHidden?: boolean;
		/** 좌측 패널 (-100vw) 슬롯 — 내부 헤더·닫기·콘텐츠는 전용 컴포넌트가 직접 관리 */
		left: Snippet;
		/** 중앙 상단 고정 헤더 슬롯 (MbHeader) */
		centerHeader: Snippet;
		/** 중앙 본문 슬롯 */
		centerBody: Snippet;
		/** 중앙 하단 고정 바 슬롯 (MbNavigationBar) */
		centerFooter: Snippet;
		/** 우측 패널 (+100vw) 슬롯 — 내부 헤더·닫기·콘텐츠는 전용 컴포넌트가 직접 관리 */
		right: Snippet;
		/** 좌측 단일 공유 액터 (예: Bot 1개 인스턴스) */
		leftActor: Snippet<[{ pane: MobileShellPane }]>;
		/** 우측 단일 공유 액터 (예: BellIcon 1개 인스턴스) */
		rightActor: Snippet<[{ pane: MobileShellPane }]>;
	}

	let {
		activePane,
		centerHeaderHidden = false,
		left,
		centerHeader,
		centerBody,
		centerFooter,
		right,
		leftActor,
		rightActor
	}: Props = $props();

	const SLIDE_DURATION_MS = 380;
	const SLIDE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

	let stageEl = $state<HTMLDivElement | null>(null);
	let trackEl = $state<HTMLDivElement | null>(null);
	let leftActorEl = $state<HTMLDivElement | null>(null);
	let rightActorEl = $state<HTMLDivElement | null>(null);

	let prevPane: MobileShellPane = untrack(() => activePane);
	let settledPane = $state<MobileShellPane>(untrack(() => activePane));
	let isTransitioning = $state(false);
	let isViewportLocked = $state(untrack(() => activePane !== 'center'));
	let lockedScrollY = $state(0);
	let vvTop = $state(0);
	let vvHeight = $state<number | null>(null);

	// 단일 액터 현재 정착 좌표 (px)
	// 우측 액터는 뷰포트 폭 변화에도 화면 밖으로 밀리지 않도록 우측 끝 기준 거리(rightEdgePx)를 함께 추적
	let leftBox = $state<ActorBox>({ left: 16, top: 13, width: 34, height: 34 });
	let rightBox = $state<ActorBox>({ left: 320, top: 13, width: 34, height: 34 });
	let rightEdgePx = $state(16);
	let actorsMeasured = $state(false);

	let transitionTimer: ReturnType<typeof setTimeout> | undefined;
	let runSeq = 0;

	function getViewportWidth(): number {
		if (typeof window === 'undefined') return 390;
		return stageEl?.clientWidth || window.innerWidth || document.documentElement.clientWidth || 390;
	}

	function setRightBox(box: ActorBox, vw = getViewportWidth()): void {
		rightBox = box;
		rightEdgePx = Math.round((vw - (box.left + box.width)) * 100) / 100;
	}

	function paneOffsetPercent(pane: MobileShellPane): number {
		if (pane === 'left') return 100;
		if (pane === 'right') return -100;
		return 0;
	}

	function cancelRunningAnimations() {
		clearTimeout(transitionTimer);
		trackEl?.getAnimations().forEach((a) => a.cancel());
		leftActorEl?.getAnimations().forEach((a) => a.cancel());
		rightActorEl?.getAnimations().forEach((a) => a.cancel());
	}

	function readElementTranslateY(el: HTMLElement | null): number {
		if (!el || typeof window === 'undefined') return 0;
		const tf = getComputedStyle(el).transform;
		if (!tf || tf === 'none') return 0;
		if (typeof DOMMatrixReadOnly !== 'undefined') {
			try {
				return new DOMMatrixReadOnly(tf).m42;
			} catch {
				// fallback below
			}
		}
		const match = tf.match(/matrix\(([^)]+)\)/);
		if (match) {
			const parts = match[1].split(',');
			const ty = Number.parseFloat(parts[5] ?? '0');
			return Number.isFinite(ty) ? ty : 0;
		}
		return 0;
	}

	function measureAnchorRect(name: string): ActorBox | null {
		if (!stageEl) return null;
		const el = stageEl.querySelector<HTMLElement>(`[data-shell-anchor="${name}"]`);
		if (!el) return null;
		const r = el.getBoundingClientRect();
		if (r.width <= 0 || r.height <= 0) return null;

		// MbHeader가 스크롤로 숨겨지거나 트랜지션 중일 때도 항상 정상 노출(translateY=0) 기준 Y좌표로 보정
		let top = r.top;
		if (name === 'left-from' || name === 'right-from') {
			const mobileHeaderEl = el.closest<HTMLElement>('.mobile-top-header');
			top -= readElementTranslateY(mobileHeaderEl);
		}
		return { left: r.left, top, width: r.width, height: r.height };
	}

	/** 현재 settledPane 기준으로 두 단일 액터의 정착 좌표를 측정·동기화 */
	function syncSettledActorBoxes() {
		if (typeof window === 'undefined') return;
		const vw = getViewportWidth();

		if (settledPane === 'center') {
			const lf = measureAnchorRect('left-from');
			const rf = measureAnchorRect('right-from');
			if (lf && lf.left >= -8 && lf.left < vw) leftBox = lf;
			if (rf && rf.left >= 0 && rf.left + rf.width <= vw + 8) {
				setRightBox(rf, vw);
			} else if (!actorsMeasured) {
				setRightBox({ left: Math.max(0, vw - 50), top: 13, width: 34, height: 34 }, vw);
			}
			actorsMeasured = Boolean(lf || rf);
		} else if (settledPane === 'left') {
			const lt = measureAnchorRect('left-to');
			const rf = measureAnchorRect('right-from');
			if (lt && lt.left >= -8 && lt.left < vw) {
				leftBox = lt;
			} else {
				leftBox = { left: 16, top: 13, width: 34, height: 34 };
			}
			if (rf) {
				setRightBox(rf, vw);
			} else {
				setRightBox({ ...rightBox, left: vw + 16 }, vw);
			}
			actorsMeasured = true;
		} else {
			const rt = measureAnchorRect('right-to');
			const lf = measureAnchorRect('left-from');
			if (rt && rt.left >= 0 && rt.left + rt.width <= vw + 8) {
				setRightBox(rt, vw);
			} else {
				setRightBox({ left: Math.max(0, vw - 50), top: 13, width: 34, height: 34 }, vw);
			}
			if (lf) {
				leftBox = lf;
			} else {
				leftBox = { ...leftBox, left: -vw + 16 };
			}
			actorsMeasured = true;
		}
	}

	function buildActorAnim(el: HTMLElement | null, from: ActorBox, to: ActorBox): Animation | null {
		if (!el) return null;
		const dx = to.left + to.width / 2 - (from.left + from.width / 2);
		const dy = to.top + to.height / 2 - (from.top + from.height / 2);
		const sx = from.width > 0 ? to.width / from.width : 1;
		const sy = from.height > 0 ? to.height / from.height : 1;

		// 제자리에 고정되는 액터는 불필요한 WAAPI 레이어를 만들지 않고 그대로 유지
		if (
			Math.abs(dx) < 0.5 &&
			Math.abs(dy) < 0.5 &&
			Math.abs(sx - 1) < 0.005 &&
			Math.abs(sy - 1) < 0.005
		) {
			return null;
		}

		return el.animate(
			[
				{ transform: 'translate3d(0px, 0px, 0) scale(1, 1)' },
				{
					transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`
				}
			],
			{
				duration: SLIDE_DURATION_MS,
				easing: SLIDE_EASE,
				fill: 'both'
			}
		);
	}

	async function runPaneTransition(fromPane: MobileShellPane, toPane: MobileShellPane) {
		const seq = ++runSeq;
		cancelRunningAnimations();

		if (typeof window === 'undefined' || prefersReducedMotion()) {
			settledPane = toPane;
			if (toPane === 'center') {
				const restoreY = lockedScrollY;
				isViewportLocked = false;
				isTransitioning = false;
				await tick();
				if (restoreY > 0) {
					showMobileHeader();
					window.scrollTo({ top: restoreY, left: 0, behavior: 'auto' });
					showMobileHeader();
				}
				syncSettledActorBoxes();
			} else {
				if (!isViewportLocked) {
					lockedScrollY = Math.max(0, window.scrollY);
					isViewportLocked = true;
				}
				isTransitioning = false;
				await tick();
				syncSettledActorBoxes();
			}
			return;
		}

		// 1) 트랙은 아직 fromPane 위치에 둔 채 뷰포트 잠금 -> 출발/도착 앵커를 정확히 측정
		settledPane = fromPane;
		if (toPane === 'center') {
			// 복귀 슬라이드 시작 시점에 상단/콘텐츠 헤더를 미리 노출해 전환 완료 후 갑자기 튀어나오는 현상 방지
			showMobileHeader();
		}
		if (fromPane === 'center' && !isViewportLocked) {
			lockedScrollY = Math.max(0, window.scrollY);
			isViewportLocked = true;
			await tick();
			if (seq !== runSeq) return;
		}

		const vw = getViewportWidth();
		const fromShiftPx = (paneOffsetPercent(fromPane) / 100) * vw;
		const toShiftPx = (paneOffsetPercent(toPane) / 100) * vw;
		const deltaShiftPx = toShiftPx - fromShiftPx;

		// 현재(fromPane) 위치의 실제 앵커 측정
		const lf = measureAnchorRect('left-from');
		const lt = measureAnchorRect('left-to');
		const rf = measureAnchorRect('right-from');
		const rt = measureAnchorRect('right-to');

		const leftStart: ActorBox =
			(fromPane === 'left' ? lt : lf) ?? { ...leftBox };
		const rightStart: ActorBox =
			(fromPane === 'right' ? rt : rf) ?? { ...rightBox };

		// 도착(toPane) 후의 최종 뷰포트 좌표 계산 (트랙이 deltaShiftPx 이동한 뒤의 위치)
		const shiftBox = (box: ActorBox): ActorBox => ({
			...box,
			left: box.left + deltaShiftPx
		});

		const isOnScreenLeft = (box: ActorBox) => box.left >= -8 && box.left < vw;
		const isOnScreenRight = (box: ActorBox) => box.left >= 0 && box.left + box.width <= vw + 8;

		const leftEndCandidate =
			toPane === 'left'
				? lt
					? shiftBox(lt)
					: leftStart
				: lf
					? shiftBox(lf)
					: shiftBox(leftStart);

		const leftEnd: ActorBox =
			toPane === 'left' || toPane === 'center'
				? isOnScreenLeft(leftEndCandidate)
					? leftEndCandidate
					: { ...leftStart, left: 16 }
				: leftEndCandidate;

		const rightEndCandidate =
			toPane === 'right'
				? rt
					? shiftBox(rt)
					: rightStart
				: rf
					? shiftBox(rf)
					: shiftBox(rightStart);

		const rightEnd: ActorBox =
			toPane === 'right' || toPane === 'center'
				? isOnScreenRight(rightEndCandidate)
					? rightEndCandidate
					: { ...rightStart, left: Math.max(0, vw - rightStart.width - 16) }
				: rightEndCandidate;

		// 출발 좌표로 정확히 스냅 후 애니메이션 시작
		leftBox = leftStart;
		setRightBox(rightStart, vw);
		actorsMeasured = true;
		isTransitioning = true;
		await tick();
		if (seq !== runSeq) return;

		const anims: Animation[] = [];

		if (trackEl) {
			anims.push(
				trackEl.animate(
					[
						{ transform: `translate3d(${fromShiftPx.toFixed(1)}px, 0, 0)` },
						{ transform: `translate3d(${toShiftPx.toFixed(1)}px, 0, 0)` }
					],
					{
						duration: SLIDE_DURATION_MS,
						easing: SLIDE_EASE,
						fill: 'both'
					}
				)
			);
		}

		const leftAnim = buildActorAnim(leftActorEl, leftStart, leftEnd);
		const rightAnim = buildActorAnim(rightActorEl, rightStart, rightEnd);
		if (leftAnim) anims.push(leftAnim);
		if (rightAnim) anims.push(rightAnim);

		let didFinish = false;
		const finish = () => {
			if (didFinish || seq !== runSeq) return;
			didFinish = true;
			clearTimeout(transitionTimer);
			settledPane = toPane;
			leftBox = leftEnd;
			setRightBox(rightEnd, vw);

			if (trackEl && toPane !== 'center') {
				trackEl.style.transform = `translate3d(${paneOffsetPercent(toPane)}%, 0, 0)`;
			} else if (trackEl) {
				trackEl.style.transform = '';
			}
			trackEl?.getAnimations().forEach((a) => a.cancel());
			leftActorEl?.getAnimations().forEach((a) => a.cancel());
			rightActorEl?.getAnimations().forEach((a) => a.cancel());
			isTransitioning = false;

			if (toPane === 'center') {
				const restoreY = lockedScrollY;
				isViewportLocked = false;
				void tick().then(() => {
					if (seq !== runSeq) return;
					showMobileHeader();
					if (restoreY > 0) {
						window.scrollTo({ top: restoreY, left: 0, behavior: 'auto' });
						showMobileHeader();
					}
					syncSettledActorBoxes();
					requestAnimationFrame(() => {
						if (seq === runSeq && !isTransitioning) {
							syncSettledActorBoxes();
						}
					});
				});
			} else {
				void tick().then(() => {
					if (seq !== runSeq) return;
					syncSettledActorBoxes();
					requestAnimationFrame(() => {
						if (seq === runSeq && !isTransitioning) {
							syncSettledActorBoxes();
						}
					});
				});
			}
		};

		for (const a of anims) a.pause();
		try {
			await Promise.all(anims.map((a) => a.ready));
		} catch {
			// 취소 무시
		}
		if (seq !== runSeq) {
			for (const a of anims) a.cancel();
			return;
		}
		const syncTime = document.timeline?.currentTime ?? null;
		for (const a of anims) {
			a.play();
			if (syncTime !== null) a.startTime = syncTime;
		}

		transitionTimer = setTimeout(finish, SLIDE_DURATION_MS + 80);
		await Promise.allSettled(anims.map((a) => a.finished));
		finish();
	}

	$effect(() => {
		const nextPane = activePane;
		if (nextPane === prevPane) return;
		const from = prevPane;
		prevPane = nextPane;
		untrack(() => {
			void runPaneTransition(from, nextPane);
		});
	});

	function syncVisualViewport() {
		if (typeof window === 'undefined') return;
		const vv = window.visualViewport;
		if (!vv) {
			vvTop = 0;
			vvHeight = null;
			return;
		}
		vvTop = Math.max(0, Math.round(vv.offsetTop));
		vvHeight = Math.round(vv.height);
	}

	onMount(() => {
		syncVisualViewport();
		syncSettledActorBoxes();
		const rafId = requestAnimationFrame(() => {
			syncVisualViewport();
			if (!isTransitioning) syncSettledActorBoxes();
		});
		const handleViewportChange = () => {
			syncVisualViewport();
			if (!isTransitioning) {
				syncSettledActorBoxes();
				requestAnimationFrame(() => {
					if (!isTransitioning) syncSettledActorBoxes();
				});
			}
		};
		window.addEventListener('resize', handleViewportChange);
		window.visualViewport?.addEventListener('resize', handleViewportChange);
		window.visualViewport?.addEventListener('scroll', handleViewportChange);
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleViewportChange) : null;
		if (stageEl && ro) ro.observe(stageEl);
		return () => {
			cancelAnimationFrame(rafId);
			ro?.disconnect();
			window.removeEventListener('resize', handleViewportChange);
			window.visualViewport?.removeEventListener('resize', handleViewportChange);
			window.visualViewport?.removeEventListener('scroll', handleViewportChange);
		};
	});

	onDestroy(() => {
		runSeq += 1;
		cancelRunningAnimations();
	});

	const settledTrackTransform = $derived.by(() => {
		if (!isViewportLocked) return undefined;
		const pct = paneOffsetPercent(settledPane);
		return `translate3d(${pct}%, 0, 0)`;
	});

	const hideActorsWithCenterHeader = $derived(
		!isTransitioning && settledPane === 'center' && centerHeaderHidden
	);
</script>

<!-- 모바일 3-패널 수평 슬라이드 무대 + 단일 공유 액터 레이어 (순수 모션 담당) -->
<div
	bind:this={stageEl}
	class="mb-shell-stage"
	class:is-locked={isViewportLocked}
	style:top={isViewportLocked ? `${vvTop}px` : undefined}
	style:height={isViewportLocked && vvHeight !== null ? `${vvHeight}px` : undefined}
	style:bottom={isViewportLocked && vvHeight !== null ? 'auto' : undefined}
>
	<div
		bind:this={trackEl}
		class="mb-shell-track"
		class:is-locked={isViewportLocked}
		class:is-transitioning={isTransitioning}
		style:transform={settledTrackTransform}
	>
		<!-- 좌측 패널 (-100vw) -->
		<div
			class="mb-shell-side-pane is-left"
			class:is-visible={isViewportLocked &&
				(activePane === 'left' || settledPane === 'left' || isTransitioning)}
			aria-hidden={activePane !== 'left' || undefined}
			inert={activePane !== 'left' || undefined}
		>
			{@render left()}
		</div>

		<!-- 중앙 패널 (메인 AppShell 통째) -->
		<div
			class="mb-shell-center-pane"
			class:is-locked={isViewportLocked}
			aria-hidden={activePane !== 'center' || undefined}
			inert={activePane !== 'center' || undefined}
		>
			<div class="mb-shell-center-header" class:is-locked={isViewportLocked}>
				{@render centerHeader()}
			</div>

			<div
				class="mb-shell-center-scroll"
				class:is-locked={isViewportLocked}
				style:--mb-scroll-lock-y={isViewportLocked && lockedScrollY > 0
					? `${lockedScrollY}px`
					: undefined}
				style:transform={isViewportLocked && lockedScrollY > 0
					? `translate3d(0, ${-lockedScrollY}px, 0)`
					: undefined}
			>
				{@render centerBody()}
			</div>

			{@render centerFooter()}
		</div>

		<!-- 우측 패널 (+100vw) -->
		<div
			class="mb-shell-side-pane is-right"
			class:is-visible={isViewportLocked &&
				(activePane === 'right' || settledPane === 'right' || isTransitioning)}
			aria-hidden={activePane !== 'right' || undefined}
			inert={activePane !== 'right' || undefined}
		>
			{@render right()}
		</div>
	</div>
</div>

<!-- 단일 공유 액터: 좌측(Bot) — stage의 overflow:hidden/트랙 GPU 레이어와 완전히 분리된 최상위 고정 레이어 -->
<div
	bind:this={leftActorEl}
	class="mb-shell-actor"
	class:is-ready={actorsMeasured}
	class:is-transitioning={isTransitioning}
	class:is-header-hidden={hideActorsWithCenterHeader}
	class:is-offscreen={!isTransitioning && settledPane === 'right'}
	style:left="{leftBox.left}px"
	style:top="{leftBox.top}px"
	style:width="{leftBox.width}px"
	style:height="{leftBox.height}px"
>
	{@render leftActor({ pane: activePane })}
</div>

<!-- 단일 공유 액터: 우측(BellIcon) — stage의 overflow:hidden/트랙 GPU 레이어와 완전히 분리된 최상위 고정 레이어 -->
<div
	bind:this={rightActorEl}
	class="mb-shell-actor"
	class:is-ready={actorsMeasured}
	class:is-transitioning={isTransitioning}
	class:is-header-hidden={hideActorsWithCenterHeader}
	class:is-offscreen={!isTransitioning && settledPane === 'left'}
	style:right="{rightEdgePx}px"
	style:top="{rightBox.top}px"
	style:width="{rightBox.width}px"
	style:height="{rightBox.height}px"
>
	{@render rightActor({ pane: activePane })}
</div>

<style>
	.mb-shell-stage {
		position: relative;
		width: 100%;
		min-height: 100dvh;
		overflow-x: clip;
	}

	.mb-shell-stage.is-locked {
		position: fixed;
		inset: 0;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		z-index: 60;
	}

	.mb-shell-track {
		position: relative;
		z-index: 1;
		width: 100%;
		min-height: 100dvh;
	}

	.mb-shell-track.is-locked {
		height: 100%;
		min-height: 0;
		will-change: transform;
	}

	.mb-shell-center-pane {
		position: relative;
		width: 100%;
		min-height: 100dvh;
	}

	.mb-shell-center-pane.is-locked {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		transform: translate3d(0, 0, 0);
	}

	.mb-shell-center-header {
		position: sticky;
		top: 0;
		z-index: 50;
		width: 100%;
	}

	.mb-shell-center-header.is-locked {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
	}

	.mb-shell-center-scroll {
		width: 100%;
		min-height: 100dvh;
	}

	.mb-shell-center-scroll.is-locked {
		padding-top: 60px;
		box-sizing: border-box;
	}

	.mb-shell-side-pane {
		position: absolute;
		top: 0;
		width: 100%;
		height: 100%;
		background: var(--bg);
		color: var(--fg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		visibility: hidden;
		pointer-events: none;
	}

	.mb-shell-side-pane.is-visible {
		visibility: visible;
		pointer-events: auto;
	}

	.mb-shell-side-pane.is-left {
		left: -100%;
	}

	.mb-shell-side-pane.is-right {
		left: 100%;
	}

	.mb-shell-actor {
		position: fixed;
		z-index: 80;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transform-origin: center center;
		opacity: 0;
		pointer-events: auto;
		will-change: transform;
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.mb-shell-actor.is-ready {
		opacity: 1;
	}

	.mb-shell-actor.is-transitioning {
		transition: none;
	}

	.mb-shell-actor.is-header-hidden {
		transform: translate3d(0, -60px, 0);
		pointer-events: none;
	}

	.mb-shell-actor.is-offscreen {
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.mb-shell-actor {
			transition: none;
		}
	}
</style>
