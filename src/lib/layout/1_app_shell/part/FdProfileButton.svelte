<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
	import {
		BellIcon,
		DotGridMenuIcon,
		LogOutIcon,
		ShoppingBagIcon,
		UserRoundIcon
	} from '#lib/common/design/icon';
	import { ALERT_ROUTE_PATH, CART_ROUTE_PATH } from '#lib/config/routes';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { prefersReducedMotion } from '#lib/common/type/spring';
	import { auth } from '#lib/auth';

	interface Props {
		/** 마이페이지 이동 경로 (기본값: '/mypage') */
		href?: string;
		/** 기본(접힌 상태) 버튼 높이 (px 단위, 기본값: 38) */
		height?: number;
		/** 확장 시 최소 가로 폭 (px 단위, 기본값: 152) */
		expandedMinWidth?: number;
		/** 확장 시 가로 폭 증가량 (px 단위, 기본값: 36) */
		expandWidthDelta?: number;
		/** 닉네임 텍스트 표시 여부 (기본값: true) */
		showNickname?: boolean;
		/** 유체 물리/디자인 커스텀 설정 (미지정 시 헤더와 일체화된 다크 스타일 적용) */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 외부 클래스 */
		class?: string;
		/** 인라인 스타일 */
		style?: string;
		/** 상단 프로필 영역 클릭 이벤트 핸들러 */
		onclick?: (e: MouseEvent) => void;
		/** 로그아웃 완료 후 추가 콜백 */
		onlogout?: () => void;
	}

	let {
		href = '/mypage',
		height = 38,
		expandedMinWidth = 152,
		expandWidthDelta = 36,
		showNickname = true,
		setting,
		class: klass = '',
		style = '',
		onclick,
		onlogout
	}: Props = $props();

	let isHovered = $state(false);
	let isPinned = $state(false);

	let rootEl: HTMLDivElement | undefined = $state();
	let cardEl: HTMLDivElement | undefined = $state();
	let triggerEl: HTMLButtonElement | undefined = $state();
	let measureEl: HTMLSpanElement | undefined = $state();
	let menuEl: HTMLDivElement | undefined = $state();
	let hlEl: HTMLElement | undefined = $state();
	let alertBellRef = $state<{ ring?: () => void } | undefined>(undefined);
	let itemEls: Array<HTMLElement | undefined> = $state([]);

	let collapsedWidth = $state(0);
	let menuHeight = $state(146);
	let hoveredMenuIdx = $state(-1);

	const expanded = $derived(isHovered || isPinned);
	const isOnMyPage = $derived.by(() => {
		const target = href.replace(/\/+$/, '') || '/';
		const current = page.url.pathname.replace(/\/+$/, '') || '/';
		return current === target || current.startsWith(`${target}/`);
	});

	const DEFAULT_PROFILE_SETTING: Partial<FluidSetting> = {
		radius: 19,
		bulge: 4,
		reach: 20,
		inset: 8,
		staticFrontWave: true,
		pressDeform: { x: 0, y: 0 },
		color: 'var(--surface-dim)',
		hoverColor: 'var(--surface)',
		pressColor: 'var(--surface-2)',
		waveColor: 'var(--line-wave)',
		borderWidth: 1,
		borderColor: 'var(--line)',
		hoverBorderColor: 'var(--line)',
		pressBorderColor: 'var(--line)',
		textColor: 'var(--fg)'
	};

	const resolvedSetting = $derived.by(() => {
		if (!setting) {
			return { ...DEFAULT_PROFILE_SETTING, pauseWhenIdle: !isPinned };
		}
		return {
			...DEFAULT_PROFILE_SETTING,
			...setting,
			pauseWhenIdle: setting.pauseWhenIdle ?? !isPinned
		};
	});

	const inset = $derived(FluidSetting.from(resolvedSetting).computedInset);

	// 닉네임/아바타 영역의 실제 접힌 가로 폭 및 하단 메뉴 높이를 추적하여 픽셀 단위 부드러운 트랜지션 보장
	$effect(() => {
		void auth.user?.nickname;
		void showNickname;
		void isOnMyPage;
		if (!measureEl) return;

		const updateSize = () => {
			if (measureEl) {
				const w = Math.ceil(measureEl.getBoundingClientRect().width);
				if (w > 0) collapsedWidth = w;
			}
			if (menuEl) {
				const h = Math.ceil(menuEl.scrollHeight);
				if (h > 0) menuHeight = h;
			}
		};

		updateSize();
		const ro = new ResizeObserver(updateSize);
		ro.observe(measureEl);
		if (menuEl) ro.observe(menuEl);
		return () => ro.disconnect();
	});

	// 외부 영역 클릭 또는 Escape 입력 시 클릭 고정(isPinned) 해제 및 축소
	$effect(() => {
		if (!isPinned && !isHovered) return;

		const handleOutsidePointerDown = (e: PointerEvent) => {
			const target = e.target as Node | null;
			if (rootEl && target && !rootEl.contains(target)) {
				isPinned = false;
				isHovered = false;
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				isPinned = false;
				isHovered = false;
				triggerEl?.focus();
			}
		};

		window.addEventListener('pointerdown', handleOutsidePointerDown, true);
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('pointerdown', handleOutsidePointerDown, true);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	const expandedWidth = $derived(
		collapsedWidth > 0
			? Math.max(collapsedWidth + expandWidthDelta, expandedMinWidth)
			: expandedMinWidth
	);

	// ── Dynamic Menu 스프링 물리 엔진 (가로 W: 320/26, 세로 H: 240/22, 항목 스태거: 260/22) ──
	interface SpringVal {
		x: number;
		v: number;
		t: number;
		k: number;
		c: number;
	}

	const makeSpring = (x: number, k: number, c: number): SpringVal => ({ x, v: 0, t: x, k, c });
	const tuneSpring = (s: SpringVal, k: number, c: number) => {
		s.k = k;
		s.c = prefersReducedMotion() ? 2 * Math.sqrt(k) : c;
	};
	const clampVal = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
	const stepSpring = (s: SpringVal, dt: number, reduced: boolean) => {
		const c = reduced ? 2 * Math.sqrt(s.k) : s.c;
		const a = -s.k * (s.x - s.t) - c * s.v;
		s.v += a * dt;
		s.x += s.v * dt;
	};
	const isSettled = (s: SpringVal, eps = 0.05) =>
		Math.abs(s.x - s.t) <= eps && Math.abs(s.v) <= eps * 12;

	const W = makeSpring(0, 320, 26);
	const H = makeSpring(untrack(() => height), 240, 22);
	const itemSprings: SpringVal[] = [
		makeSpring(0, 260, 22),
		makeSpring(0, 260, 22),
		makeSpring(0, 260, 22),
		makeSpring(0, 260, 22)
	];
	// SpringDropdown과 동일한 스트레치 호버 하이라이트 스프링 (선행 엣지 620/36, 후행 엣지 200/20)
	const HT = makeSpring(0, 620, 36);
	const HB = makeSpring(32, 620, 36);
	const HO = makeSpring(0, 400, 32);

	let springInitialized = false;
	let springRafId = 0;
	let springLastTs = 0;
	const itemTimers = new Set<ReturnType<typeof setTimeout>>();

	function clearItemTimers() {
		for (const id of itemTimers) clearTimeout(id);
		itemTimers.clear();
	}

	function hoverMenuItem(idx: number) {
		if (!expanded || idx === hoveredMenuIdx) return;
		const el = itemEls[idx];
		if (!el) return;
		const top = el.offsetTop;
		const bottom = top + el.offsetHeight;
		if (hoveredMenuIdx < 0 || prefersReducedMotion()) {
			HT.x = HT.t = top;
			HB.x = HB.t = bottom;
			HT.v = HB.v = 0;
		} else {
			const down = idx > hoveredMenuIdx;
			tuneSpring(down ? HB : HT, 620, 36);
			tuneSpring(down ? HT : HB, 200, 20);
			HT.t = top;
			HB.t = bottom;
		}
		hoveredMenuIdx = idx;
		HO.t = 1;
		wakeSprings();
	}

	function clearMenuHover() {
		if (hoveredMenuIdx === -1 && HO.t === 0) return;
		hoveredMenuIdx = -1;
		HO.t = 0;
		wakeSprings();
	}

	function renderSprings() {
		if (cardEl && W.x > 0) {
			cardEl.style.width = `${Math.max(1, W.x).toFixed(2)}px`;
			cardEl.style.height = `${Math.max(height, H.x).toFixed(2)}px`;
		}
		if (hlEl) {
			hlEl.style.opacity = clampVal(HO.x, 0, 1).toFixed(3);
			const ht = Math.min(HT.x, HB.x - 16);
			const hb = Math.max(HB.x, ht + 16);
			hlEl.style.height = `${(hb - ht).toFixed(2)}px`;
			hlEl.style.transform = `translate3d(0, ${ht.toFixed(2)}px, 0)`;
		}
		for (let i = 0; i < itemSprings.length; i++) {
			const el = itemEls[i];
			if (!el) continue;
			const s = itemSprings[i].x;
			el.style.opacity = clampVal(s, 0, 1).toFixed(3);
			el.style.transform = `translate3d(0, ${((1 - s) * 14).toFixed(2)}px, 0)`;
		}
	}

	function tickSprings(now: number) {
		springRafId = 0;
		const dt = springLastTs ? Math.min((now - springLastTs) / 1000, 1 / 30) : 1 / 60;
		springLastTs = now;

		const reduced = prefersReducedMotion();
		const sub = 4;
		const subDt = dt / sub;
		for (let step = 0; step < sub; step++) {
			stepSpring(W, subDt, reduced);
			stepSpring(H, subDt, reduced);
			stepSpring(HT, subDt, reduced);
			stepSpring(HB, subDt, reduced);
			stepSpring(HO, subDt, reduced);
			for (let i = 0; i < itemSprings.length; i++) {
				stepSpring(itemSprings[i], subDt, reduced);
			}
		}

		renderSprings();

		const moving =
			!isSettled(W, 0.08) ||
			!isSettled(H, 0.08) ||
			!isSettled(HT, 0.08) ||
			!isSettled(HB, 0.08) ||
			!isSettled(HO, 0.004) ||
			itemSprings.some((s) => !isSettled(s, 0.004));

		if (moving) {
			springRafId = requestAnimationFrame(tickSprings);
		} else {
			W.x = W.t;
			W.v = 0;
			H.x = H.t;
			H.v = 0;
			HT.x = HT.t;
			HT.v = 0;
			HB.x = HB.t;
			HB.v = 0;
			HO.x = HO.t;
			HO.v = 0;
			for (const s of itemSprings) {
				s.x = s.t;
				s.v = 0;
			}
			renderSprings();
			springLastTs = 0;
		}
	}

	function wakeSprings() {
		if (typeof window === 'undefined' || springRafId) return;
		springLastTs = performance.now();
		springRafId = requestAnimationFrame(tickSprings);
	}

	// 접힌 폭 / 메뉴 높이 / 확장 상태 변화 시 Dynamic Menu 스프링 목표 동기화
	$effect(() => {
		const cw = collapsedWidth;
		const ew = expandedWidth;
		const mh = menuHeight;
		const isOpen = expanded;
		const baseH = height;
		const onMyPage = isOnMyPage;

		untrack(() => {
			if (cw <= 0) return;

			const nextW = isOpen ? ew : cw;
			const nextH = isOpen ? baseH + mh : baseH;
			const visibleIndices = onMyPage ? [1, 2, 3] : [0, 1, 2, 3];

			if (onMyPage && hoveredMenuIdx === 0) {
				hoveredMenuIdx = -1;
				HO.t = 0;
			}

			if (!springInitialized || prefersReducedMotion()) {
				springInitialized = true;
				clearItemTimers();
				W.x = W.t = nextW;
				W.v = 0;
				H.x = H.t = nextH;
				H.v = 0;
				for (const s of itemSprings) {
					s.x = s.t = isOpen ? 1 : 0;
					s.v = 0;
				}
				renderSprings();
				return;
			}

			W.t = nextW;
			H.t = nextH;

			if (!isOpen) {
				hoveredMenuIdx = -1;
				HO.t = 0;
			}

			clearItemTimers();
			if (onMyPage) {
				itemSprings[0].x = itemSprings[0].t = 0;
				itemSprings[0].v = 0;
			}
			const n = visibleIndices.length;
			for (let order = 0; order < n; order++) {
				const idx = visibleIndices[order];
				const delayMs = isOpen ? 70 + order * 50 : (n - 1 - order) * 30;
				const id = setTimeout(() => {
					itemTimers.delete(id);
					itemSprings[idx].t = expanded ? 1 : 0;
					wakeSprings();
				}, delayMs);
				itemTimers.add(id);
			}

			wakeSprings();
		});
	});

	onDestroy(() => {
		clearItemTimers();
		if (springRafId) cancelAnimationFrame(springRafId);
	});

	function handlePointerEnter(e: PointerEvent) {
		if (e.pointerType === 'mouse') {
			isHovered = true;
		}
	}

	function handlePointerLeave(e: PointerEvent) {
		if (e.pointerType === 'mouse') {
			isHovered = false;
		}
	}

	function handleFocusOut(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (next && rootEl && !rootEl.contains(next)) {
			isPinned = false;
		}
	}

	function handleTriggerClick(e: MouseEvent) {
		e.stopPropagation();
		if (isPinned) {
			isPinned = false;
			isHovered = false;
		} else {
			isPinned = true;
		}
		onclick?.(e);
	}

	function handleMyPageClick() {
		isPinned = false;
		isHovered = false;
	}

	async function handleLogoutClick(e: MouseEvent) {
		e.stopPropagation();
		isPinned = false;
		isHovered = false;
		await auth.logout();
		onlogout?.();
		await goto('/', { replaceState: true });
	}
</script>

<div
	bind:this={rootEl}
	role="group"
	aria-label="프로필 메뉴 영역"
	class="fd-profile-anchor {klass}"
	style:height="{height + inset * 2}px"
	{style}
	onfocusout={handleFocusOut}
>
	<FdDiv
		setting={resolvedSetting}
		staticFrontWave={resolvedSetting.staticFrontWave ?? true}
		bodyClass="fd-profile-body"
	>
		<div
			bind:this={cardEl}
			role="group"
			class="profile-card"
			class:is-expanded={expanded}
			style:height="{height}px"
			onpointerenter={handlePointerEnter}
			onpointerleave={handlePointerLeave}
		>
			<!-- 상단 프로필 트리거 (접힌 상태 디자인 100% 유지) -->
			<button
				bind:this={triggerEl}
				type="button"
				class="profile-btn"
				style:height="{height}px"
				aria-label="내 프로필"
				aria-expanded={expanded}
				aria-haspopup="menu"
				onclick={handleTriggerClick}
			>
				<span
					bind:this={measureEl}
					class="profile-btn-inner"
					style:padding-left="{Math.max(8, height / 2 - 7)}px"
				>
					<DotGridMenuIcon size={14} {expanded} class="profile-dot-icon" />
					{#if showNickname}
						<span class="profile-nickname">
							{auth.user?.nickname ? `${auth.user.nickname}님` : '로그인'}
						</span>
					{/if}
				</span>
			</button>

			<!-- 하단 확장 액션 메뉴 (마이페이지 / 장바구니 / 로그아웃) -->
			<div bind:this={menuEl} class="profile-menu" role="menu" aria-hidden={!expanded}>
				<div class="menu-divider"></div>

				<div class="profile-menu-list" role="none" onpointerleave={clearMenuHover}>
					<i
						bind:this={hlEl}
						class="menu-hl"
						class:is-danger={hoveredMenuIdx === 3}
						aria-hidden="true"
					></i>

					{#if !isOnMyPage}
						<a
							bind:this={itemEls[0]}
							{href}
							role="menuitem"
							class="menu-action-btn mypage-btn"
							tabindex={expanded ? 0 : -1}
							data-sveltekit-noscroll
							onpointerenter={() => hoverMenuItem(0)}
							onfocus={() => hoverMenuItem(0)}
							onclick={handleMyPageClick}
						>
							<UserRoundIcon
								size={15}
								strokeWidth={1.8}
								hovered={hoveredMenuIdx === 0}
								class="menu-action-icon"
							/>
							<span>마이페이지</span>
						</a>
					{/if}

					<a
						bind:this={itemEls[1]}
						href={CART_ROUTE_PATH}
						role="menuitem"
						class="menu-action-btn cart-btn"
						tabindex={expanded ? 0 : -1}
						data-sveltekit-reset="false"
						onpointerenter={() => hoverMenuItem(1)}
						onfocus={() => hoverMenuItem(1)}
						onclick={handleMyPageClick}
					>
						<ShoppingBagIcon
							size={15}
							animating={hoveredMenuIdx === 1}
							class="menu-action-icon"
						/>
						<span>장바구니</span>
					</a>

					<a
						bind:this={itemEls[2]}
						href={ALERT_ROUTE_PATH}
						role="menuitem"
						class="menu-action-btn alert-btn"
						tabindex={expanded ? 0 : -1}
						data-sveltekit-reset="false"
						onpointerenter={() => {
							hoverMenuItem(2);
							alertBellRef?.ring?.();
						}}
						onfocus={() => {
							hoverMenuItem(2);
							alertBellRef?.ring?.();
						}}
						onclick={handleMyPageClick}
					>
						<BellIcon
							bind:this={alertBellRef}
							size={15}
							strokeWidth={1.8}
							class="menu-action-icon"
						/>
						<span>알림함</span>
					</a>

					<button
						bind:this={itemEls[3]}
						type="button"
						role="menuitem"
						class="menu-action-btn logout-btn"
						tabindex={expanded ? 0 : -1}
						onpointerenter={() => hoverMenuItem(3)}
						onfocus={() => hoverMenuItem(3)}
						onclick={handleLogoutClick}
					>
						<LogOutIcon
							size={15}
							strokeWidth={1.8}
							hovered={hoveredMenuIdx === 3}
							class="menu-action-icon"
						/>
						<span>로그아웃</span>
					</button>
				</div>
			</div>
		</div>
	</FdDiv>
</div>

<style>
	/* 상단 높이를 고정하고 align-items: flex-start를 주어
	   가로는 일반 플로우에서 커져 옆의 BGM 플레이어를 자연스럽게 밀어내고,
	   세로는 상단 위치 고정 채 아래쪽으로만 자연스럽게 확장되도록 처리 */
	.fd-profile-anchor {
		position: relative;
		display: inline-flex;
		align-items: flex-start;
		justify-content: flex-end;
		flex-shrink: 0;
		z-index: 60;
	}

	:global(.fd-body.fd-profile-body) {
		padding: 0;
		display: inline-grid;
	}

	.profile-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		overflow: hidden;
		box-sizing: border-box;
		will-change: width, height;
	}

	.profile-btn {
		position: relative;
		z-index: 1;
		width: 100%;
		padding: 0;
		margin: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		flex-shrink: 0;
		border-radius: 19px;
		color: inherit;
		font: inherit;
		outline: none;
		box-sizing: border-box;
	}

	.profile-btn:focus-visible {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.55);
	}

	.profile-btn-inner {
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		padding: 0 1rem 0 0.75rem;
		width: max-content;
		box-sizing: border-box;
	}

	.profile-nickname {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--lq-text, #f4f4f5);
		line-height: 1;
		white-space: nowrap;
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.18s ease;
	}

	.profile-btn:hover .profile-nickname,
	.profile-card.is-expanded .profile-nickname {
		color: #ffffff;
	}

	/* ── 확장 메뉴 영역 (개별 항목은 Dynamic Menu 스프링 스태거로 구동) ── */
	.profile-menu {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 0.35rem 0.4rem;
		box-sizing: border-box;
		pointer-events: none;
	}

	.profile-card.is-expanded .profile-menu {
		pointer-events: auto;
	}

	.menu-divider {
		height: 1px;
		margin: 1px 0.35rem 3px;
		background: color-mix(in srgb, var(--white) 10%, transparent);
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.18s ease;
	}

	.profile-card.is-expanded .menu-divider {
		opacity: 1;
	}

	.profile-menu-list {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.menu-hl {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--white) 9%, transparent);
		opacity: 0;
		pointer-events: none;
		will-change: transform, height, opacity;
		transition: background-color 0.18s ease;
	}

	.menu-hl.is-danger {
		background: rgba(244, 63, 94, 0.14);
	}

	.menu-action-btn {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		height: 32px;
		padding: 0 0.55rem;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--fg);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		box-sizing: border-box;
		opacity: 0;
		will-change: transform, opacity;
		transition: color 0.18s ease;
	}

	.menu-action-btn:hover,
	.menu-action-btn:focus-visible {
		color: var(--white);
		outline: none;
	}

	.menu-action-btn.logout-btn:hover,
	.menu-action-btn.logout-btn:focus-visible {
		color: #fda4af;
	}

	.menu-action-btn :global(.menu-action-icon) {
		flex-shrink: 0;
		opacity: 0.85;
	}
</style>
