<script lang="ts">
	import { page } from '$app/state';
	import { handleSameRouteScrollTop } from '#lib/utils/scroll';

	const navItems = [
		{ label: '아티스트', href: '/artist', icon: 'artist' },
		{ label: '공연', href: '/concert', icon: 'concert' },
		{ label: '음반∙LP', href: '/album', icon: 'album' },
		{ label: '굿즈', href: '/goods', icon: 'goods' }
	] as const;
</script>

<!-- 모바일 하단 고정 네비게이션 바 -->
<nav class="mobile-bottom-nav" aria-label="하단 네비게이션" data-sveltekit-noscroll>
	{#each navItems as item}
		<a
			href={item.href}
			class="mobile-nav-item"
			onclick={(e) => handleSameRouteScrollTop(e, item.href, page.url.pathname)}
		>
			<span class="mobile-icon">
				{#if item.icon === 'artist'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 016 0v7.5a3 3 0 01-3 3z"
						/>
					</svg>
				{:else if item.icon === 'concert'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"
						/>
					</svg>
				{:else if item.icon === 'album'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
						<circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-linejoin="round" />
						<circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" />
						<path stroke-linecap="round" d="M12 3a9 9 0 019 9" />
					</svg>
				{:else if item.icon === 'goods'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25c-.669 0-1.189-.578-1.119-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
						/>
					</svg>
				{/if}
			</span>
			<span class="mobile-label">{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.mobile-bottom-nav {
		display: flex;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		height: 56px;
		padding-bottom: env(safe-area-inset-bottom, 0px);
		box-sizing: content-box;
		align-items: center;
		justify-content: space-around;
		background: rgba(7, 7, 9, 0.82);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.mobile-nav-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		color: #8c8c96;
		text-decoration: none;
		padding: 6px 0;
		transition:
			color 0.15s ease,
			transform 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.mobile-nav-item:active {
		transform: scale(0.94);
	}

	.mobile-nav-item:hover {
		color: #ffffff;
	}

	.mobile-icon {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mobile-icon svg {
		width: 100%;
		height: 100%;
	}

	.mobile-label {
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: -0.01em;
	}
</style>
