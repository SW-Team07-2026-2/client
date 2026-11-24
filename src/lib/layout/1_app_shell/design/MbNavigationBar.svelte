<script lang="ts">
	import { untrack } from 'svelte';
	import FdSegmentedControl from '#lib/common/design/fluid/FdSegmentedControl.svelte';
	import type { AppShellMobileNavItem } from '../logic/appShell.svelte';

	interface Props {
		items: readonly AppShellMobileNavItem[];
		selectedValue: string;
		profileImageUrl?: string;
		onSelect?: (nextValue: string) => void;
		onActiveReselect?: (currentValue: string) => void;
	}

	let {
		items,
		selectedValue,
		profileImageUrl = '',
		onSelect,
		onActiveReselect
	}: Props = $props();

	let currentValue = $state(untrack(() => selectedValue));
	let navigatedInClick = false;
	let avatarImgError = $state(false);

	$effect(() => {
		if (selectedValue !== currentValue) {
			currentValue = selectedValue;
		}
	});

	$effect(() => {
		void profileImageUrl;
		avatarImgError = false;
	});

	function handleNavChange(nextValue: string) {
		navigatedInClick = true;
		onSelect?.(nextValue);
	}

	function handleSegmentClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (e.detail > 0) {
			(target?.closest('button') as HTMLButtonElement | null)?.blur();
		}
		if (navigatedInClick) {
			navigatedInClick = false;
			return;
		}
		if (target?.closest('.fd-seg-btn.is-active')) {
			onActiveReselect?.(currentValue);
		}
	}
</script>

<!-- 모바일 플로팅 알약형 글래스 네비게이션 바 (순수 렌더링) -->
<nav class="mobile-floating-dock" aria-label="하단 네비게이션" data-sveltekit-noscroll>
	<div class="mobile-dock-pill">
		<FdSegmentedControl
			class="mobile-dock-seg"
			buttonClass="mobile-dock-btn"
			items={[...items]}
			bind:value={currentValue}
			rubberDock={false}
			pauseWhenIdle={false}
			radius={999}
			reach={0}
			bulge={0}
			bulgeReactive={false}
			layers={2}
			layerGap={2.3}
			waveAmp={2.4}
			color="var(--white-2)"
			waveColor="var(--white-3)"
			style="--fd-seg-active-color: var(--bg); --fd-seg-color: var(--muted); --fd-seg-hover-color: var(--muted); --fd-seg-btn-padding: 0;"
			onchange={handleNavChange}
			onclick={handleSegmentClick}
		>
			{#snippet itemContent({ item, isActive })}
				{#if item.value === '/mypage'}
					<span class="mobile-avatar-ring" class:is-active={isActive} aria-hidden="true">
						{#if profileImageUrl && !avatarImgError}
							<img
								src={profileImageUrl}
								alt=""
								class="mobile-avatar-img"
								onerror={() => (avatarImgError = true)}
							/>
						{:else}
							<svg
								class="mobile-avatar-svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.85"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
								/>
							</svg>
						{/if}
					</span>
				{:else}
					<span class="mobile-icon" aria-hidden="true">
						{#if item.value === '/artist'}
							{#if isActive}
								<svg viewBox="0 0 24 24" fill="none">
									<path
										fill="currentColor"
										stroke="currentColor"
										stroke-width="1"
										d="M12 15a3 3 0 01-3-3V4.5a3 3 0 016 0v7.5a3 3 0 01-3 3z"
									/>
									<path
										stroke="currentColor"
										stroke-width="1.9"
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5"
									/>
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 016 0v7.5a3 3 0 01-3 3z"
									/>
								</svg>
							{/if}
						{:else if item.value === '/concert'}
							{#if isActive}
								<svg viewBox="0 0 24 24" fill="none">
									<defs>
										<mask id="mobile-nav-ticket-mask">
											<path
												fill="white"
												stroke="white"
												stroke-width="1.2"
												stroke-linejoin="round"
												d="M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"
											/>
											<path
												fill="none"
												stroke="black"
												stroke-width="1.8"
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3"
											/>
										</mask>
									</defs>
									<rect
										width="24"
										height="24"
										fill="currentColor"
										mask="url(#mobile-nav-ticket-mask)"
									/>
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"
									/>
								</svg>
							{/if}
						{:else if item.value === '/album'}
							{#if isActive}
								<svg viewBox="0 0 24 24" fill="none">
									<defs>
										<mask id="mobile-nav-album-mask">
											<circle cx="12" cy="12" r="9.6" fill="white" />
											<circle cx="12" cy="12" r="3" fill="black" />
											<path
												fill="none"
												stroke="black"
												stroke-width="1.35"
												stroke-linecap="round"
												d="M12 5.7a6.3 6.3 0 016.3 6.3"
											/>
										</mask>
									</defs>
									<rect
										width="24"
										height="24"
										fill="currentColor"
										mask="url(#mobile-nav-album-mask)"
									/>
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
									<circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-linejoin="round" />
									<circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" />
									<path stroke-linecap="round" d="M12 3a9 9 0 019 9" />
								</svg>
							{/if}
						{:else if item.value === '/goods'}
							{#if isActive}
								<svg viewBox="0 0 24 24" fill="none">
									<defs>
										<mask id="mobile-nav-goods-mask">
											<path
												fill="white"
												stroke="white"
												stroke-width="1.1"
												stroke-linejoin="round"
												d="M19.606 8.507l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.669 0-1.189-.578-1.119-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
											/>
											<circle cx="8.625" cy="10.5" r="0.95" fill="black" />
											<circle cx="15.375" cy="10.5" r="0.95" fill="black" />
										</mask>
									</defs>
									<path
										fill="none"
										stroke="currentColor"
										stroke-width="1.9"
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5"
									/>
									<rect
										width="24"
										height="24"
										fill="currentColor"
										mask="url(#mobile-nav-goods-mask)"
									/>
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.669 0-1.189-.578-1.119-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
									/>
								</svg>
							{/if}
						{/if}
					</span>
				{/if}
			{/snippet}
		</FdSegmentedControl>
	</div>
</nav>

<style>
	.mobile-floating-dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: calc(14px + env(safe-area-inset-bottom, 0px));
		z-index: 50;
		padding: 0 var(--content-padding-x-mobile);
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.mobile-dock-pill {
		pointer-events: auto;
		width: min(100%, 340px);
		height: 56px;
		padding: 6px;
		box-sizing: border-box;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
		box-shadow: 0 12px 32px color-mix(in srgb, var(--bg) 55%, transparent);
	}

	:global(.fd-seg-control.mobile-dock-seg) {
		width: 100%;
		height: 100%;
		justify-content: space-between;
		--fd-seg-gap: 4px;
	}

	:global(.fd-seg-control .fd-seg-btn.mobile-dock-btn) {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition:
			color 0.2s ease,
			transform 0.16s ease;
	}

	:global(.fd-seg-control .fd-seg-btn.mobile-dock-btn:active) {
		transform: scale(0.94);
	}

	.mobile-icon {
		width: 21px;
		height: 21px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.mobile-icon svg {
		width: 100%;
		height: 100%;
	}

	.mobile-avatar-ring {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: var(--surface);
		border: 1.5px solid var(--line);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		pointer-events: none;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	.mobile-avatar-ring.is-active {
		background: transparent;
		border-color: transparent;
	}

	.mobile-avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 999px;
		object-fit: cover;
		display: block;
	}

	.mobile-avatar-svg {
		width: 18px;
		height: 18px;
	}
</style>
