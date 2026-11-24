<script lang="ts">
	import { goto } from '$app/navigation';
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
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

	let avatarImgError = $state(false);
	let isHovered = $state(false);
	let isPinned = $state(false);

	let rootEl: HTMLDivElement | undefined = $state();
	let triggerEl: HTMLButtonElement | undefined = $state();
	let measureEl: HTMLSpanElement | undefined = $state();
	let menuEl: HTMLDivElement | undefined = $state();

	let collapsedWidth = $state(0);
	let menuHeight = $state(78);

	const expanded = $derived(isHovered || isPinned);

	const DEFAULT_PROFILE_SETTING: Partial<FluidSetting> = {
		radius: 19,
		bulge: 6,
		reach: 32,
		staticFrontWave: true,
		pressDeform: { x: 0, y: 0 },
		color: '#070709',
		hoverColor: '#070709',
		pressColor: '#0c0c10',
		waveColor: '#2a2a30',
		borderWidth: 1,
		borderColor: '#2a2a30',
		hoverBorderColor: '#2a2a30',
		textColor: '#f4f4f5'
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

	const cardWidthStyle = $derived(
		collapsedWidth > 0 ? `${expanded ? expandedWidth : collapsedWidth}px` : 'auto'
	);

	const cardHeight = $derived(expanded ? height + menuHeight : height);

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
	onpointerenter={handlePointerEnter}
	onpointerleave={handlePointerLeave}
	onfocusout={handleFocusOut}
>
	<FdDiv
		setting={resolvedSetting}
		staticFrontWave={resolvedSetting.staticFrontWave ?? true}
		bodyClass="fd-profile-body"
	>
		<div
			class="profile-card"
			class:is-expanded={expanded}
			style:width={cardWidthStyle}
			style:height="{cardHeight}px"
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
				<span bind:this={measureEl} class="profile-btn-inner">
					<span class="avatar-ring">
						{#if auth.user?.profileImageUrl && !avatarImgError}
							<img
								src={auth.user.profileImageUrl}
								alt=""
								class="avatar-img"
								onerror={() => (avatarImgError = true)}
							/>
						{:else}
							<svg
								class="avatar-svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
								/>
							</svg>
						{/if}
					</span>
					{#if showNickname}
						<span class="profile-nickname">{auth.user?.nickname || '로그인'}</span>
					{/if}
				</span>
			</button>

			<!-- 하단 확장 액션 메뉴 (마이페이지 / 로그아웃) -->
			<div bind:this={menuEl} class="profile-menu" role="menu" aria-hidden={!expanded}>
				<div class="menu-divider"></div>

				<a
					{href}
					role="menuitem"
					class="menu-action-btn mypage-btn"
					tabindex={expanded ? 0 : -1}
					data-sveltekit-noscroll
					onclick={handleMyPageClick}
				>
					<svg
						class="menu-action-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
						/>
					</svg>
					<span>마이페이지</span>
				</a>

				<button
					type="button"
					role="menuitem"
					class="menu-action-btn logout-btn"
					tabindex={expanded ? 0 : -1}
					onclick={handleLogoutClick}
				>
					<svg
						class="menu-action-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
						/>
					</svg>
					<span>로그아웃</span>
				</button>
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
		transition:
			width 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			height 0.34s cubic-bezier(0.22, 1, 0.36, 1);
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
		padding: 0 0.9rem 0 0.3rem;
		gap: 0.55rem;
		width: max-content;
		box-sizing: border-box;
	}

	.avatar-ring {
		width: 28px;
		height: 28px;
		border-radius: 9999px;
		background: #17161f;
		border: 1px solid #2a2a30;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}

	.profile-nickname {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--lq-text, #f4f4f5);
		line-height: 1;
		white-space: nowrap;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.18s ease;
	}

	.profile-btn:hover .profile-nickname,
	.profile-card.is-expanded .profile-nickname {
		color: #ffffff;
	}

	.avatar-svg {
		width: 18px;
		height: 18px;
		color: #e4e4e7;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ── 확장 메뉴 영역 (초기 투명도 0 -> 확장 시 부드럽게 페이드인) ── */
	.profile-menu {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 0.35rem 0.4rem;
		box-sizing: border-box;
		opacity: 0;
		transform: translateY(-6px);
		pointer-events: none;
		transition:
			opacity 0.15s ease 0s,
			transform 0.2s ease 0s;
	}

	.profile-card.is-expanded .profile-menu {
		opacity: 1;
		transform: translateY(0);
		pointer-events: auto;
		transition:
			opacity 0.26s ease 0.06s,
			transform 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.05s;
	}

	.menu-divider {
		height: 1px;
		margin: 1px 0.35rem 3px;
		background: rgba(255, 255, 255, 0.08);
		flex-shrink: 0;
	}

	.menu-action-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		height: 32px;
		padding: 0 0.55rem;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: #d4d4d8;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		box-sizing: border-box;
		opacity: 0;
		transform: translateY(-4px);
		transition:
			background-color 0.18s ease,
			color 0.18s ease,
			opacity 0.14s ease 0s,
			transform 0.18s ease 0s;
	}

	.profile-card.is-expanded .menu-action-btn.mypage-btn {
		opacity: 1;
		transform: translateY(0);
		transition:
			background-color 0.18s ease,
			color 0.18s ease,
			opacity 0.24s ease 0.07s,
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.07s;
	}

	.profile-card.is-expanded .menu-action-btn.logout-btn {
		opacity: 1;
		transform: translateY(0);
		transition:
			background-color 0.18s ease,
			color 0.18s ease,
			opacity 0.24s ease 0.11s,
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.11s;
	}

	.menu-action-btn:hover,
	.menu-action-btn:focus-visible {
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		outline: none;
	}

	.menu-action-btn.logout-btn:hover,
	.menu-action-btn.logout-btn:focus-visible {
		background: rgba(244, 63, 94, 0.14);
		color: #fda4af;
	}

	.menu-action-icon {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		opacity: 0.85;
	}
</style>
