<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import {
		BellIcon,
		BookmarkIcon,
		LogOutIcon,
		MapPinIcon,
		PanelBottomCloseIcon,
		ShoppingBagIcon,
		SquareArrowOutUpRightIcon,
		TicketIcon,
		TruckIcon,
		UserRoundIcon
	} from '#lib/common/design/icon';
	import {
		createSpring,
		createSpringLoop,
		prefersReducedMotion
	} from '#lib/common/type/spring';
	import type { MyPageNavGroup, MyPageSectionId } from '../logic/myPageTree.svelte';

	interface Props {
		groups: readonly MyPageNavGroup[];
		activeSectionId: MyPageSectionId;
		cartHref: string;
		alertHref: string;
		loggingOut?: boolean;
		onSelectSection: (id: MyPageSectionId) => void;
		onLogout: () => void;
	}

	let {
		groups,
		activeSectionId,
		cartHref,
		alertHref,
		loggingOut = false,
		onSelectSection,
		onLogout
	}: Props = $props();

	let navContainerEl = $state<HTMLElement | null>(null);
	let hoverHighlightEl = $state<HTMLDivElement | null>(null);
	let activeBarEl = $state<HTMLDivElement | null>(null);
	let hoveredId = $state<string | null>(null);

	const itemRefs = new Map<string, HTMLElement>();

	// Animate UI Docs 스타일 글라이딩 하이라이트 스프링
	const hlTop = createSpring(0, 520, 34);
	const hlLeft = createSpring(0, 520, 34);
	const hlWidth = createSpring(180, 520, 34);
	const hlHeight = createSpring(32, 420, 30);
	const hlOpacity = createSpring(0, 460, 34);

	// 좌측 가이드 레일 위 액티브 인디케이터 바 스프링
	const barTop = createSpring(0, 480, 34);
	const barHeight = createSpring(18, 420, 30);
	const barOpacity = createSpring(0, 460, 34);

	const allSprings = [hlTop, hlLeft, hlWidth, hlHeight, hlOpacity, barTop, barHeight, barOpacity];
	let hlInitialized = false;
	let barInitialized = false;

	function registerItem(node: HTMLElement, id: string) {
		itemRefs.set(id, node);
		return {
			destroy() {
				if (itemRefs.get(id) === node) {
					itemRefs.delete(id);
				}
			}
		};
	}

	function measureItem(id: string) {
		if (!navContainerEl) return null;
		const el = itemRefs.get(id);
		if (!el) return null;
		const navRect = navContainerEl.getBoundingClientRect();
		const elRect = el.getBoundingClientRect();
		if (elRect.height <= 0 || elRect.width <= 0) return null;
		return {
			top: elRect.top - navRect.top,
			left: elRect.left - navRect.left,
			width: elRect.width,
			height: elRect.height
		};
	}

	function renderSprings() {
		if (hoverHighlightEl) {
			hoverHighlightEl.style.transform = `translate3d(${hlLeft.x.toFixed(2)}px, ${hlTop.x.toFixed(2)}px, 0)`;
			hoverHighlightEl.style.width = `${Math.max(0, hlWidth.x).toFixed(2)}px`;
			hoverHighlightEl.style.height = `${Math.max(0, hlHeight.x).toFixed(2)}px`;
			hoverHighlightEl.style.opacity = Math.max(0, Math.min(1, hlOpacity.x)).toFixed(3);
		}
		if (activeBarEl) {
			activeBarEl.style.transform = `translate3d(0, ${barTop.x.toFixed(2)}px, 0)`;
			activeBarEl.style.height = `${Math.max(0, barHeight.x).toFixed(2)}px`;
			activeBarEl.style.opacity = Math.max(0, Math.min(1, barOpacity.x)).toFixed(3);
		}
	}

	const loop = createSpringLoop({
		springs: allSprings,
		isSettled: () =>
			allSprings.every((s) => Math.abs(s.x - s.t) < 0.05 && Math.abs(s.v) < 0.08),
		onFrame: renderSprings
	});

	function syncHighlight(snap = false) {
		const targetId = hoveredId ?? activeSectionId;
		const hlBox = measureItem(targetId);
		const activeBox = measureItem(activeSectionId);
		const reduced = prefersReducedMotion();

		if (hlBox) {
			hlTop.t = hlBox.top;
			hlLeft.t = hlBox.left;
			hlWidth.t = hlBox.width;
			hlHeight.t = hlBox.height;
			hlOpacity.t = 1;
			if (!hlInitialized || snap || reduced) {
				hlTop.x = hlTop.t;
				hlTop.v = 0;
				hlLeft.x = hlLeft.t;
				hlLeft.v = 0;
				hlWidth.x = hlWidth.t;
				hlWidth.v = 0;
				hlHeight.x = hlHeight.t;
				hlHeight.v = 0;
				hlOpacity.x = 1;
				hlOpacity.v = 0;
				hlInitialized = true;
			}
		}

		if (activeBox) {
			const inset = 6;
			barTop.t = activeBox.top + inset;
			barHeight.t = Math.max(12, activeBox.height - inset * 2);
			barOpacity.t = 1;
			if (!barInitialized || snap || reduced) {
				barTop.x = barTop.t;
				barTop.v = 0;
				barHeight.x = barHeight.t;
				barHeight.v = 0;
				barOpacity.x = 1;
				barOpacity.v = 0;
				barInitialized = true;
			}
		}

		if (reduced || snap) {
			renderSprings();
		} else {
			loop.wake();
		}
	}

	$effect(() => {
		void activeSectionId;
		void hoveredId;
		untrack(() => {
			void tick().then(() => syncHighlight(false));
		});
	});

	onMount(() => {
		void tick().then(() => {
			syncHighlight(true);
			requestAnimationFrame(() => syncHighlight(true));
		});
		const ro =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(() => syncHighlight(true))
				: null;
		if (navContainerEl && ro) ro.observe(navContainerEl);
		return () => {
			ro?.disconnect();
		};
	});

	onDestroy(() => {
		loop.stop();
	});
</script>

<!-- Animate UI Docs(animate-ui.com/docs) 스타일 PC 좌측 세로바 (그룹 트리 · 좌측 가이드 레일 · 글라이딩 하이라이트, 순수 렌더링) -->
<aside class="pc-docs-sidebar" aria-label="마이페이지 메뉴">
	<nav
		bind:this={navContainerEl}
		class="docs-nav"
		onpointerleave={() => (hoveredId = null)}
	>
		<!-- Animate UI Highlight: 호버/활성 항목을 따라 부드럽게 이동하는 배경 필 -->
		<div bind:this={hoverHighlightEl} class="docs-gliding-hl" aria-hidden="true"></div>
		<!-- 좌측 세로 가이드 라인 위 현재 활성 인디케이터 -->
		<div bind:this={activeBarEl} class="docs-active-bar" aria-hidden="true"></div>

		{#each groups as group (group.id)}
			<div class="docs-group">
				<h3 class="docs-group-title">{group.title}</h3>
				<ul class="docs-group-list">
					{#each group.items as item (item.id)}
						{@const isActive = item.id === activeSectionId}
						{@const isHovered = hoveredId === item.id}
						<li>
							<button
								use:registerItem={item.id}
								type="button"
								class="docs-nav-item"
								class:is-active={isActive}
								aria-current={isActive ? 'page' : undefined}
								onpointerenter={() => (hoveredId = item.id)}
								onfocus={() => (hoveredId = item.id)}
								onblur={() => {
									if (hoveredId === item.id) hoveredId = null;
								}}
								onclick={() => onSelectSection(item.id)}
							>
								<span class="docs-item-leading">
									{#if item.id === 'account'}
										<UserRoundIcon size={15} strokeWidth={1.9} hovered={isHovered} class="docs-leading-icon" />
									{:else if item.id === 'collection'}
										<BookmarkIcon size={15} strokeWidth={1.9} hovered={isHovered} class="docs-leading-icon" />
									{:else if item.id === 'order'}
										<TruckIcon size={15} strokeWidth={1.9} hovered={isHovered} class="docs-leading-icon" />
									{:else if item.id === 'ticket'}
										<TicketIcon size={15} strokeWidth={1.9} hovered={isHovered} class="docs-leading-icon" />
									{:else}
										<MapPinIcon size={15} strokeWidth={1.9} hovered={isHovered} class="docs-leading-icon" />
									{/if}
									<span class="docs-item-label">{item.label}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}

		<!-- 하단 바로가기 링크 버튼 (하위 섹션 전환 없이 외부 이동 / 로그아웃만 수행) -->
		<div class="docs-group docs-quick-group">
			<ul class="docs-group-list">
				<li>
					<a
						use:registerItem={'link:cart'}
						href={cartHref}
						class="docs-nav-item"
						data-sveltekit-reset="false"
						onpointerenter={() => (hoveredId = 'link:cart')}
						onfocus={() => (hoveredId = 'link:cart')}
						onblur={() => {
							if (hoveredId === 'link:cart') hoveredId = null;
						}}
					>
						<span class="docs-item-leading">
							<ShoppingBagIcon
								size={15}
								animating={hoveredId === 'link:cart'}
								class="docs-leading-icon"
							/>
							<span class="docs-item-label">장바구니</span>
						</span>
						<PanelBottomCloseIcon
							size={14}
							strokeWidth={2}
							hovered={hoveredId === 'link:cart'}
							class="docs-link-icon"
						/>
					</a>
				</li>

				<li>
					<a
						use:registerItem={'link:alert'}
						href={alertHref}
						class="docs-nav-item"
						data-sveltekit-reset="false"
						onpointerenter={() => (hoveredId = 'link:alert')}
						onfocus={() => (hoveredId = 'link:alert')}
						onblur={() => {
							if (hoveredId === 'link:alert') hoveredId = null;
						}}
					>
						<span class="docs-item-leading">
							<BellIcon
								size={15}
								strokeWidth={1.9}
								animateOnHover={true}
								hovered={hoveredId === 'link:alert'}
								class="docs-leading-icon"
							/>
							<span class="docs-item-label">알림함</span>
						</span>
						<PanelBottomCloseIcon
							size={14}
							strokeWidth={2}
							hovered={hoveredId === 'link:alert'}
							class="docs-link-icon"
						/>
					</a>
				</li>

				<li>
					<button
						use:registerItem={'link:logout'}
						type="button"
						class="docs-nav-item"
						disabled={loggingOut}
						onpointerenter={() => (hoveredId = 'link:logout')}
						onfocus={() => (hoveredId = 'link:logout')}
						onblur={() => {
							if (hoveredId === 'link:logout') hoveredId = null;
						}}
						onclick={onLogout}
					>
						<span class="docs-item-leading">
							<LogOutIcon
								size={15}
								strokeWidth={1.9}
								hovered={hoveredId === 'link:logout'}
								class="docs-leading-icon"
							/>
							<span class="docs-item-label">{loggingOut ? '로그아웃 중...' : '로그아웃'}</span>
						</span>
						<SquareArrowOutUpRightIcon
							size={14}
							strokeWidth={2}
							hovered={hoveredId === 'link:logout'}
							class="docs-link-icon"
						/>
					</button>
				</li>
			</ul>
		</div>
	</nav>
</aside>

<style>
	.pc-docs-sidebar {
		position: sticky;
		top: calc(var(--pc-header-height, 70px) + 1.5rem);
		align-self: start;
		display: flex;
		flex-direction: column;
		border: var(--thin-border);
		border-radius: 16px;
		background: var(--bg);
	}

	.docs-nav {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		padding: 0.9rem 0.75rem;
	}

	.docs-gliding-hl {
		position: absolute;
		top: 0;
		left: 0;
		border-radius: 8px;
		background: color-mix(in srgb, var(--white) 8%, transparent);
		pointer-events: none;
		z-index: 0;
		opacity: 0;
		will-change: transform, width, height, opacity;
	}

	/* 사이드바 좌측 1px 테두리 선 위를 따라 이동하는 액티브 화이트 바 */
	.docs-active-bar {
		position: absolute;
		top: 0;
		left: -1.5px;
		width: 2px;
		border-radius: 999px;
		background: var(--white);
		pointer-events: none;
		z-index: 2;
		opacity: 0;
		will-change: transform, height, opacity;
	}

	.docs-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.docs-quick-group {
		padding-top: 0.85rem;
		border-top: var(--thin-border);
	}

	.docs-group-title {
		margin: 0;
		padding: 0 0.65rem;
		font-size: 0.76rem;
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		color: var(--white-2);
	}

	.docs-group-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.docs-nav-item {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 32px;
		padding: 0 0.65rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.85rem;
		font-weight: var(--fw-medium);
		text-align: left;
		text-decoration: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		cursor: pointer;
		outline: none;
		box-sizing: border-box;
		transition: color 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.docs-nav-item:hover:not(:disabled),
	.docs-nav-item:focus-visible {
		color: var(--white-2);
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
		gap: 0.55rem;
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
		transition: opacity 0.15s ease;
	}

	.docs-nav-item:hover:not(:disabled) :global(.docs-leading-icon),
	.docs-nav-item:focus-visible :global(.docs-leading-icon),
	.docs-nav-item.is-active :global(.docs-leading-icon) {
		opacity: 1;
	}

	.docs-nav-item :global(.docs-link-icon) {
		color: var(--muted);
		transition: color 0.15s ease;
	}

	.docs-nav-item:hover:not(:disabled) :global(.docs-link-icon),
	.docs-nav-item:focus-visible :global(.docs-link-icon) {
		color: var(--white-2);
	}
</style>
