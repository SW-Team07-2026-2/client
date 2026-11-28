<script lang="ts">
	import { onDestroy, onMount, tick, untrack, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		BookmarkIcon,
		ChevronLeftIcon,
		ChevronRightIcon,
		LogOutIcon,
		MapPinIcon,
		PanelBottomCloseIcon,
		ShoppingBagIcon,
		SquareArrowOutUpRightIcon,
		TicketIcon,
		TruckIcon,
		UserRoundIcon
	} from '#lib/common/design/icon';
	import { prefersReducedMotion } from '#lib/common/type/spring';
	import type { MyPageNavGroup, MyPageSectionId } from '../logic/myPageTree.svelte';

	interface TitleOrigin {
		left: number;
		top: number;
		height: number;
		fontSize: number;
	}

	interface Props {
		groups: readonly MyPageNavGroup[];
		activeSectionId: MyPageSectionId;
		detailOpen: boolean;
		cartHref: string;
		loggingOut?: boolean;
		onSelectSection: (id: MyPageSectionId) => void;
		onBackToHub: () => void;
		onLogout: () => void;
		detailContent: Snippet<[{ sectionId: MyPageSectionId }]>;
	}

	let {
		groups,
		activeSectionId,
		detailOpen,
		cartHref,
		loggingOut = false,
		onSelectSection,
		onBackToHub,
		onLogout,
		detailContent
	}: Props = $props();

	const PUSH_DURATION_MS = 300;
	const POP_DURATION_MS = 260;
	const EASE_IOS = 'cubic-bezier(0.23, 1, 0.32, 1)';
	const PARALLAX = 0.3;
	const HUB_BLUR_PX = 8;
	const POP_DISTANCE = 0.35;
	const POP_VELOCITY = 500;

	let panelEl = $state<HTMLDivElement | null>(null);
	let bodyEl = $state<HTMLDivElement | null>(null);
	let hubPageEl = $state<HTMLDivElement | null>(null);
	let detailPageEl = $state<HTMLDivElement | null>(null);
	let backBtnEl = $state<HTMLButtonElement | null>(null);
	let headerTitleEl = $state<HTMLSpanElement | null>(null);

	let panelWidth = $state(360);
	let busy = $state(false);
	let isRenderedDetail = $state(untrack(() => detailOpen));
	let dragX = $state(0);
	let isDragging = $state(false);
	const isHubHidden = $derived(isRenderedDetail && !busy && !isDragging);

	let titleOrigin: TitleOrigin | null = null;
	let lastOpenerId: MyPageSectionId | null = null;
	let animSeq = 0;

	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let axisLocked: 'x' | 'y' | null = null;
	let lastMoveX = 0;
	let lastMoveTime = 0;
	let velocityX = 0;

	const activeItem = $derived.by(() => {
		for (const g of groups) {
			const found = g.items.find((it) => it.id === activeSectionId);
			if (found) return found;
		}
		return groups[0]?.items[0];
	});

	const headerTitle = $derived(isRenderedDetail ? (activeItem?.label ?? '마이페이지') : '마이페이지');

	function cancelActiveAnimations() {
		hubPageEl?.getAnimations().forEach((a) => a.cancel());
		detailPageEl?.getAnimations().forEach((a) => a.cancel());
		headerTitleEl?.getAnimations().forEach((a) => a.cancel());
	}

	function animateHeaderTitle(origin: TitleOrigin | null, direction: 1 | -1) {
		const el = headerTitleEl;
		const panel = panelEl;
		if (!el || !panel) return;
		el.getAnimations().forEach((a) => a.cancel());

		if (prefersReducedMotion()) return;

		if (!origin) {
			el.animate(
				[
					{ opacity: 0, transform: `translate3d(${direction * 24}px, -50%, 0)` },
					{ opacity: 1, transform: 'translate3d(0px, -50%, 0)' }
				],
				{ duration: 280, easing: EASE_IOS, fill: 'both' }
			);
			return;
		}

		const box = panel.getBoundingClientRect();
		const own = el.getBoundingClientRect();
		const ownFontSize = Number.parseFloat(getComputedStyle(el).fontSize) || 15;
		const scale = origin.fontSize / ownFontSize;
		const dx = origin.left - (own.left - box.left);
		const dy = origin.top + origin.height / 2 - (own.top - box.top + own.height / 2);

		el.animate(
			[
				{
					transform: `translate3d(${dx.toFixed(1)}px, calc(-50% + ${dy.toFixed(1)}px), 0) scale(${scale.toFixed(4)})`,
					opacity: 1
				},
				{ transform: 'translate3d(0px, -50%, 0) scale(1)', opacity: 1 }
			],
			{ duration: PUSH_DURATION_MS, easing: EASE_IOS, fill: 'both' }
		);
	}

	async function runPush(sectionId: MyPageSectionId, labelEl: HTMLElement | null) {
		if (busy) return;
		const seq = ++animSeq;
		cancelActiveAnimations();

		if (panelEl && labelEl) {
			const box = panelEl.getBoundingClientRect();
			const rect = labelEl.getBoundingClientRect();
			titleOrigin = {
				left: rect.left - box.left,
				top: rect.top - box.top,
				height: rect.height,
				fontSize: Number.parseFloat(getComputedStyle(labelEl).fontSize) || 15
			};
		} else {
			titleOrigin = null;
		}
		lastOpenerId = sectionId;

		onSelectSection(sectionId);
		isRenderedDetail = true;
		dragX = 0;

		if (prefersReducedMotion()) {
			await tick();
			backBtnEl?.focus({ preventScroll: true });
			return;
		}

		busy = true;
		await tick();
		if (seq !== animSeq) return;

		animateHeaderTitle(titleOrigin, 1);

		const w = bodyEl?.clientWidth || panelWidth || 360;
		const anims: Animation[] = [];

		if (detailPageEl) {
			anims.push(
				detailPageEl.animate(
					[
						{ transform: `translate3d(${w}px, 0, 0)` },
						{ transform: 'translate3d(0px, 0, 0)' }
					],
					{ duration: PUSH_DURATION_MS, easing: EASE_IOS, fill: 'both' }
				)
			);
		}
		if (hubPageEl) {
			anims.push(
				hubPageEl.animate(
					[
						{
							transform: 'translate3d(0px, 0, 0)',
							opacity: 1,
							filter: 'blur(0px)'
						},
						{
							transform: `translate3d(${(-PARALLAX * w).toFixed(1)}px, 0, 0)`,
							opacity: 0,
							filter: `blur(${HUB_BLUR_PX}px)`
						}
					],
					{ duration: Math.round(PUSH_DURATION_MS * 0.85), easing: EASE_IOS, fill: 'both' }
				)
			);
		}

		backBtnEl?.focus({ preventScroll: true });
		await Promise.allSettled(anims.map((a) => a.finished));
		if (seq !== animSeq) return;
		cancelActiveAnimations();
		busy = false;
	}

	async function runPop(fromX = 0) {
		if (!isRenderedDetail || busy) return;
		const seq = ++animSeq;
		cancelActiveAnimations();

		const hadFocus = Boolean(panelEl?.contains(document.activeElement));
		titleOrigin = null;

		if (prefersReducedMotion()) {
			isRenderedDetail = false;
			dragX = 0;
			onBackToHub();
			await tick();
			restoreOpenerFocus(hadFocus);
			return;
		}

		busy = true;
		await tick();
		if (seq !== animSeq) return;
		const w = bodyEl?.clientWidth || panelWidth || 360;
		const progress = Math.max(0, Math.min(1, fromX / Math.max(1, w)));
		const underStart = -PARALLAX * (w - fromX);
		const startBlur = ((1 - progress) * HUB_BLUR_PX).toFixed(2);
		const anims: Animation[] = [];

		if (detailPageEl) {
			anims.push(
				detailPageEl.animate(
					[
						{ transform: `translate3d(${fromX.toFixed(1)}px, 0, 0)` },
						{ transform: `translate3d(${w}px, 0, 0)` }
					],
					{ duration: POP_DURATION_MS, easing: EASE_IOS, fill: 'both' }
				)
			);
		}
		if (hubPageEl) {
			anims.push(
				hubPageEl.animate(
					[
						{
							transform: `translate3d(${underStart.toFixed(1)}px, 0, 0)`,
							opacity: progress,
							filter: `blur(${startBlur}px)`
						},
						{
							transform: 'translate3d(0px, 0, 0)',
							opacity: 1,
							filter: 'blur(0px)'
						}
					],
					{ duration: POP_DURATION_MS, easing: EASE_IOS, fill: 'both' }
				)
			);
		}

		await Promise.allSettled(anims.map((a) => a.finished));
		if (seq !== animSeq) return;

		cancelActiveAnimations();
		dragX = 0;
		isRenderedDetail = false;
		onBackToHub();
		await tick();
		if (seq !== animSeq) return;

		animateHeaderTitle(null, -1);
		busy = false;
		restoreOpenerFocus(hadFocus);
	}

	function restoreOpenerFocus(hadFocus: boolean) {
		if (!hadFocus || !lastOpenerId || !bodyEl) return;
		const row = bodyEl.querySelector<HTMLElement>(`[data-stack-row="${lastOpenerId}"]`);
		row?.focus({ preventScroll: true });
	}

	function handleDetailPointerDown(e: PointerEvent) {
		if (!isRenderedDetail || busy || e.button !== 0) return;
		if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		lastMoveX = e.clientX;
		lastMoveTime = performance.now();
		velocityX = 0;
		axisLocked = null;
	}

	function handleDetailPointerMove(e: PointerEvent) {
		if (pointerId !== e.pointerId || !isRenderedDetail || busy) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (!axisLocked) {
			if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
				axisLocked = 'y';
				pointerId = null;
				return;
			}
			if (dx > 10 && dx > Math.abs(dy)) {
				axisLocked = 'x';
				isDragging = true;
				try {
					detailPageEl?.setPointerCapture(e.pointerId);
				} catch {
					// ignore
				}
			} else {
				return;
			}
		}

		if (axisLocked === 'x') {
			const now = performance.now();
			const dt = Math.max(1, now - lastMoveTime) / 1000;
			velocityX = (e.clientX - lastMoveX) / dt;
			lastMoveX = e.clientX;
			lastMoveTime = now;
			dragX = Math.max(0, dx);
		}
	}

	async function handleDetailPointerUp(e: PointerEvent) {
		if (pointerId !== e.pointerId) return;
		pointerId = null;
		const wasDragging = isDragging;
		isDragging = false;
		axisLocked = null;

		if (!wasDragging) return;
		const w = bodyEl?.clientWidth || panelWidth || 360;
		const curX = dragX;

		if (curX > w * POP_DISTANCE || velocityX > POP_VELOCITY) {
			await runPop(curX);
			return;
		}

		if (curX > 0 && detailPageEl && !prefersReducedMotion()) {
			busy = true;
			const progress = Math.max(0, Math.min(1, curX / Math.max(1, w)));
			const underStart = -PARALLAX * (w - curX);
			const startBlur = ((1 - progress) * HUB_BLUR_PX).toFixed(2);
			const anims: Animation[] = [
				detailPageEl.animate(
					[
						{ transform: `translate3d(${curX.toFixed(1)}px, 0, 0)` },
						{ transform: 'translate3d(0px, 0, 0)' }
					],
					{ duration: 220, easing: EASE_IOS, fill: 'both' }
				)
			];
			if (hubPageEl) {
				anims.push(
					hubPageEl.animate(
						[
							{
								transform: `translate3d(${underStart.toFixed(1)}px, 0, 0)`,
								opacity: progress,
								filter: `blur(${startBlur}px)`
							},
							{
								transform: `translate3d(${(-PARALLAX * w).toFixed(1)}px, 0, 0)`,
								opacity: 0,
								filter: `blur(${HUB_BLUR_PX}px)`
							}
						],
						{ duration: 220, easing: EASE_IOS, fill: 'both' }
					)
				);
			}
			await Promise.allSettled(anims.map((a) => a.finished));
			cancelActiveAnimations();
			busy = false;
		}
		dragX = 0;
	}

	function handlePanelKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isRenderedDetail && !busy) {
			e.preventDefault();
			void runPop(0);
		}
	}

	$effect(() => {
		const targetOpen = detailOpen;
		untrack(() => {
			if (!busy && targetOpen !== isRenderedDetail) {
				isRenderedDetail = targetOpen;
				dragX = 0;
			}
		});
	});

	onMount(() => {
		if (!bodyEl || typeof ResizeObserver === 'undefined') return;
		panelWidth = bodyEl.clientWidth || 360;
		const ro = new ResizeObserver(() => {
			if (bodyEl) panelWidth = bodyEl.clientWidth || 360;
		});
		ro.observe(bodyEl);
		return () => ro.disconnect();
	});

	onDestroy(() => {
		animSeq += 1;
		cancelActiveAnimations();
	});

	const dragProgress = $derived(Math.max(0, Math.min(1, dragX / Math.max(1, panelWidth))));
	const underParallaxX = $derived(-PARALLAX * Math.max(0, panelWidth - dragX));
	const underOpacity = $derived(isRenderedDetail ? dragProgress : 1);
	const underBlurPx = $derived(isRenderedDetail ? (1 - dragProgress) * HUB_BLUR_PX : 0);
</script>

<!-- 모바일 마이페이지 드릴다운 스택 패널 (PcSidebar와 동일한 그룹 트리 구성 · 순수 렌더링) -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={panelEl}
	class="stack-panel"
	role="region"
	aria-label="마이페이지"
	onkeydown={handlePanelKeyDown}
>
	<header class="stack-header">
		{#if isRenderedDetail}
			<button
				bind:this={backBtnEl}
				type="button"
				class="stack-back-btn"
				onclick={() => void runPop(0)}
				in:fade={{ duration: 180 }}
				out:fade={{ duration: 150 }}
			>
				<ChevronLeftIcon size={16} />
				<span>마이페이지</span>
			</button>
		{/if}

		{#key `${isRenderedDetail ? activeSectionId : 'root'}`}
			<span bind:this={headerTitleEl} class="stack-header-title">
				{headerTitle}
			</span>
		{/key}
	</header>

	<div bind:this={bodyEl} class="stack-body">
		<!-- 루트 허브 페이지 (하위 화면 진입 시 패럴랙스로 뒤에서 이동 · 상세 정착 후 숨김) -->
		<div
			bind:this={hubPageEl}
			class="stack-page is-hub"
			class:is-under={isRenderedDetail}
			class:is-hidden={isHubHidden}
			aria-hidden={isRenderedDetail || undefined}
			inert={isRenderedDetail || undefined}
			style:transform={isRenderedDetail
				? `translate3d(${underParallaxX.toFixed(1)}px, 0, 0)`
				: undefined}
			style:opacity={isRenderedDetail ? underOpacity.toFixed(3) : undefined}
			style:filter={isRenderedDetail ? `blur(${underBlurPx.toFixed(2)}px)` : undefined}
		>
			<nav class="docs-nav" aria-label="마이페이지 메뉴">
				{#each groups as group (group.id)}
					<div class="docs-group">
						<h3 class="docs-group-title">{group.title}</h3>
						<ul class="docs-group-list">
							{#each group.items as item (item.id)}
								<li>
									<button
										type="button"
										class="docs-nav-item"
										class:is-active={item.id === activeSectionId}
										data-stack-row={item.id}
										onclick={(e) => {
											const labelEl = e.currentTarget.querySelector<HTMLElement>('.docs-item-label');
											void runPush(item.id, labelEl);
										}}
									>
										<span class="docs-item-leading">
											{#if item.id === 'account'}
												<UserRoundIcon size={17} strokeWidth={1.9} class="docs-leading-icon" />
											{:else if item.id === 'collection'}
												<BookmarkIcon size={17} strokeWidth={1.9} class="docs-leading-icon" />
											{:else if item.id === 'order'}
												<TruckIcon size={17} strokeWidth={1.9} class="docs-leading-icon" />
											{:else if item.id === 'ticket'}
												<TicketIcon size={17} strokeWidth={1.9} class="docs-leading-icon" />
											{:else}
												<MapPinIcon size={17} strokeWidth={1.9} class="docs-leading-icon" />
											{/if}
											<span class="docs-item-label">{item.label}</span>
										</span>
										<ChevronRightIcon size={16} class="docs-link-icon" />
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/each}

				<!-- 하단 바로가기 링크 (장바구니 · 로그아웃) -->
				<div class="docs-group docs-quick-group">
					<ul class="docs-group-list">
						<li>
							<a href={cartHref} class="docs-nav-item" data-sveltekit-reset="false">
								<span class="docs-item-leading">
									<ShoppingBagIcon size={17} class="docs-leading-icon" />
									<span class="docs-item-label">장바구니</span>
								</span>
								<PanelBottomCloseIcon size={15} strokeWidth={2} class="docs-link-icon" />
							</a>
						</li>
						<li>
							<button
								type="button"
								class="docs-nav-item"
								disabled={loggingOut}
								onclick={onLogout}
							>
								<span class="docs-item-leading">
									<LogOutIcon size={17} strokeWidth={1.9} class="docs-leading-icon" />
									<span class="docs-item-label">{loggingOut ? '로그아웃 중...' : '로그아웃'}</span>
								</span>
								<SquareArrowOutUpRightIcon size={15} strokeWidth={2} class="docs-link-icon" />
							</button>
						</li>
					</ul>
				</div>
			</nav>
		</div>

		<!-- 하위 상세 페이지 (우측에서 슬라이드 진입 · 오른쪽 스와이프로 복귀) -->
		{#if isRenderedDetail}
			<div
				bind:this={detailPageEl}
				class="stack-page is-top"
				role="group"
				aria-label={headerTitle}
				style:transform={isDragging || dragX > 0
					? `translate3d(${dragX.toFixed(1)}px, 0, 0)`
					: undefined}
				onpointerdown={handleDetailPointerDown}
				onpointermove={handleDetailPointerMove}
				onpointerup={handleDetailPointerUp}
				onpointercancel={handleDetailPointerUp}
			>
				<div class="stack-detail-inner">
					{@render detailContent({ sectionId: activeSectionId })}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.stack-panel {
		position: relative;
		width: 100%;
		overflow-x: clip;
		background: var(--bg);
	}

	.stack-header {
		position: relative;
		z-index: 10;
		height: 44px;
		padding: 0 4px;
		display: flex;
		align-items: center;
		background: var(--bg);
	}

	.stack-back-btn {
		position: relative;
		z-index: 10;
		max-width: 38%;
		padding: 6px 8px 6px 4px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.86rem;
		font-weight: var(--fw-medium);
		display: inline-flex;
		align-items: center;
		gap: 2px;
		cursor: pointer;
		outline: none;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.stack-back-btn:hover,
	.stack-back-btn:active {
		background: var(--surface-dim);
		color: var(--white);
	}

	.stack-back-btn span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stack-header-title {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		margin: 0 auto;
		width: fit-content;
		max-width: 55%;
		transform: translate3d(0, -50%, 0);
		transform-origin: left center;
		font-size: 0.96rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		pointer-events: none;
		will-change: transform, opacity;
	}

	.stack-body {
		position: relative;
		overflow-x: clip;
	}

	.stack-page {
		width: 100%;
		background: var(--bg);
		will-change: transform, opacity, filter;
	}

	.stack-page.is-under {
		position: absolute;
		inset: 0 0 auto 0;
		pointer-events: none;
	}

	.stack-page.is-hidden {
		display: none;
	}

	.stack-page.is-top {
		position: relative;
		z-index: 2;
		touch-action: pan-y;
		box-shadow: -8px 0 24px -12px rgba(0, 0, 0, 0.55);
	}

	.stack-detail-inner {
		padding: 16px 14px 20px;
	}

	/* ── PcSidebar 그룹 트리 구성 + 기존 모바일 개별 버튼(--surface 둥근 카드) 디자인 유지 ── */
	.docs-nav {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		padding: 0.4rem 0 1rem;
	}

	.docs-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.docs-quick-group {
		padding-top: 0.25rem;
	}

	.docs-group-title {
		margin: 0;
		padding: 0 0.75rem;
		font-size: 0.75rem;
		font-weight: var(--fw-medium);
		letter-spacing: -0.01em;
		color: var(--muted);
	}

	.docs-group-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
		border-radius: 14px;
		overflow: hidden;
		background: var(--surface-dim);
	}

	.docs-group-list li + li {
		border-top: var(--thin-border);
	}

	.docs-nav-item {
		position: relative;
		width: 100%;
		min-height: 46px;
		padding: 10px 14px;
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--white-2);
		font: inherit;
		font-size: 0.94rem;
		font-weight: var(--fw-medium);
		text-align: left;
		text-decoration: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		cursor: pointer;
		outline: none;
		box-sizing: border-box;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.docs-nav-item:active:not(:disabled),
	.docs-nav-item:focus-visible {
		color: var(--white);
		background: var(--surface-1);
	}

	.docs-nav-item.is-active {
		color: var(--white);
		font-weight: var(--fw-semibold);
	}

	.docs-nav-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.docs-item-leading {
		min-width: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
	}

	.docs-item-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.docs-nav-item :global(.docs-leading-icon) {
		flex-shrink: 0;
		opacity: 0.82;
	}

	.docs-nav-item.is-active :global(.docs-leading-icon),
	.docs-nav-item:active:not(:disabled) :global(.docs-leading-icon) {
		opacity: 1;
	}

	.docs-nav-item :global(.docs-link-icon) {
		flex-shrink: 0;
		color: var(--muted);
	}
</style>
