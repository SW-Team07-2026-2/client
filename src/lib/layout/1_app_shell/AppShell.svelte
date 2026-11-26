<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import BellIcon from '#lib/common/design/icon/BellIcon.svelte';
	import { isMobile } from '#lib/common/logic';
	import { getRootSplashContext } from '#lib/dedicated/loading';
	import {
		AppShellController,
		MOBILE_NAV_ITEMS,
		type MobileShellPane
	} from './logic/appShell.svelte';
	import { Bot, ChatBot, type BotState } from './part/chat_bot';
	import { NotificationPanel } from './part/notification';
	import PcHeader from './design/PcHeader.svelte';
	import MbHeader from './design/MbHeader.svelte';
	import MbNavigationBar from './design/MbNavigationBar.svelte';
	import MbShellStage from './design/MbShellStage.svelte';

	interface Props {
		/** 메인 레이아웃(2_main_section)이 들어오는 본문 슬롯 */
		children: Snippet;
		/** true면 모바일 상단 헤더를 스크롤 방향과 무관하게 항상 표시 (상세 페이지 · 결제 플로우 등) */
		mobileHeaderAlwaysVisible?: boolean;
		/** true면 모바일 하단 네비게이션 바를 숨김 (장바구니 · 결제 등 전용 CTA 바 사용 페이지) */
		hideMobileBottomNav?: boolean;
		/** 본문 외 추가 최상위 오버레이 슬롯 */
		overlay?: Snippet;
	}

	let {
		children,
		mobileHeaderAlwaysVisible = false,
		hideMobileBottomNav = false,
		overlay
	}: Props = $props();

	const ctrl = new AppShellController();
	const rootSplash = getRootSplashContext();

	let pcBotOpen = $state(false);
	let botState = $state<BotState>('idle');
	let mobileLogoSvgEl = $state<SVGSVGElement | undefined>(undefined);
	let mobileBotRef = $state<{ wink?: (side: 'left' | 'right') => void } | null>(null);
	let mobileBellRef = $state<{ ring?: () => void } | null>(null);
	let mobileChatRef = $state<{ triggerReaction?: () => void } | null>(null);

	const mobile = $derived(isMobile.current);
	const isMobileLogoHiddenForSplash = $derived(
		Boolean(rootSplash?.active && !rootSplash.revealed)
	);
	const isMobileHeaderHidden = $derived(
		!mobileHeaderAlwaysVisible && ctrl.isMobileHeaderHidden
	);

	// SvelteKit shallow routing state와 모바일 3-패널 동기화 (뒤로가기 닫힘)
	$effect(() => {
		ctrl.syncOverlayFromHistoryState(page.state.mobileOverlay);
	});

	$effect(() => {
		if (!mobile || !rootSplash || !mobileLogoSvgEl) return;
		const el = mobileLogoSvgEl;
		rootSplash.setTargetEl(el, 'exact');
		return () => {
			rootSplash.clearTargetEl(el);
		};
	});

	beforeNavigate((nav) => {
		ctrl.handleBeforeRouteNavigate(
			nav.type === 'popstate',
			nav.from?.url.pathname,
			nav.to?.url.pathname
		);
	});

	afterNavigate((nav) => {
		ctrl.syncAfterNavigate(nav.type === 'popstate');
	});

	onMount(() => {
		ctrl.clearStaleOverlayHistoryState();
		return ctrl.attachWindowListeners();
	});

	function handleMobileBotActorClick(pane: MobileShellPane) {
		if (pane === 'center') {
			mobileBotRef?.wink?.('right');
			mobileChatRef?.triggerReaction?.();
			ctrl.openMobileOverlay('chatbot');
		} else if (pane === 'left') {
			mobileBotRef?.wink?.('left');
			mobileChatRef?.triggerReaction?.();
		}
	}

	function handleMobileBellActorClick(pane: MobileShellPane) {
		mobileBellRef?.ring?.();
		if (pane === 'center') {
			ctrl.openMobileOverlay('notifications');
		}
	}
</script>

<div class="app-shell" class:is-pc={!mobile}>
	{#if mobile}
		<!-- 모바일: 3-패널 수평 슬라이드 무대 + 단일 공유 액터(Bot 1개, BellIcon 1개) -->
		<MbShellStage
			activePane={ctrl.activeMobilePane}
			centerHeaderHidden={isMobileHeaderHidden}
		>
			{#snippet left()}
				<ChatBot
					bind:this={mobileChatRef}
					embedded={true}
					open={ctrl.activeMobilePane === 'left'}
					bind:botState
					onClose={ctrl.closeMobileOverlay}
				/>
			{/snippet}

			{#snippet centerHeader()}
				<MbHeader
					hidden={isMobileHeaderHidden}
					scrolled={ctrl.isMobileHeaderScrolled}
					logoHiddenForSplash={isMobileLogoHiddenForSplash}
					bind:logoSvgEl={mobileLogoSvgEl}
					onLogoClick={ctrl.handleMobileLogoClick}
				/>
			{/snippet}

			{#snippet centerBody()}
				<main class="app-shell-body is-mobile" class:no-bottom-nav={hideMobileBottomNav}>
					{@render children()}
				</main>
			{/snippet}

			{#snippet centerFooter()}
				{#if !hideMobileBottomNav}
					<MbNavigationBar
						items={MOBILE_NAV_ITEMS}
						selectedValue={ctrl.selectedMobileRoute}
						onSelect={ctrl.handleMobileNavSelect}
						onActiveReselect={ctrl.handleMobileActiveReselect}
					/>
				{/if}
			{/snippet}

			{#snippet right()}
				<NotificationPanel onClose={ctrl.closeMobileOverlay} />
			{/snippet}

			{#snippet leftActor({ pane })}
				<button
					type="button"
					class="mb-actor-btn is-bot"
					onclick={() => handleMobileBotActorClick(pane)}
					aria-label={pane === 'left' ? 'AI 봇 표정 반응 보기' : 'AI 봇과 대화창 열기'}
				>
					<Bot
						bind:this={mobileBotRef}
						state={botState}
						size={44}
						trackMouse={false}
						disableHoverWave={true}
						activeWave={botState === 'thinking' || botState === 'talking'}
					/>
				</button>
			{/snippet}

			{#snippet rightActor({ pane })}
				<button
					type="button"
					class="mb-actor-btn"
					onclick={() => handleMobileBellActorClick(pane)}
					aria-label="알림"
				>
					<BellIcon bind:this={mobileBellRef} size={22} strokeWidth={2} />
				</button>
			{/snippet}
		</MbShellStage>
	{:else}
		<!-- PC: 상단 고정 헤더 + 본문 + 우측 하단 챗봇 -->
		<PcHeader
			navItems={ctrl.pcNavItems}
			isScrolled={ctrl.isPcHeaderScrolled}
			onNavClick={ctrl.handlePcNavClick}
		/>

		<main class="app-shell-body">
			{@render children()}
		</main>

		<ChatBot bind:open={pcBotOpen} bind:botState />
	{/if}

	{#if overlay}
		{@render overlay()}
	{/if}
</div>

<style>
	.app-shell {
		min-height: 100dvh;
		width: 100%;
		max-width: 100%;
		display: flex;
		flex-direction: column;
		background-color: var(--bg);
		color: var(--fg);
		overflow-x: clip;
	}

	.app-shell.is-pc {
		min-width: var(--pc-min-width, 630px);
	}

	.app-shell-body {
		flex: 1;
		width: 100%;
	}

	.app-shell-body.is-mobile {
		padding-bottom: calc(
			var(--mobile-bottom-bar-height, 72px) + 4px + env(safe-area-inset-bottom, 0px)
		);
	}

	.app-shell-body.is-mobile.no-bottom-nav {
		padding-bottom: 0;
	}

	.mb-actor-btn {
		width: 34px;
		height: 34px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--white);
		overflow: visible;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.mb-actor-btn:not(.is-bot):active {
		transform: scale(0.92);
	}

	.mb-actor-btn :global(.bot-container) {
		pointer-events: none;
		flex-shrink: 0;
	}
</style>
