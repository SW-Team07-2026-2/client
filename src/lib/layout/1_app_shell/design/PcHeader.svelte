<script lang="ts">
	import FdTitle from '#lib/common/design/fluid/FdTitle.svelte';
	import FdBgmPlayer from '#lib/common/design/fluid/FdBgmPlayer.svelte';
	import FdProfileButton from '../part/FdProfileButton.svelte';
	import type { AppShellPcNavItem } from '../logic/appShell.svelte';

	interface Props {
		navItems: readonly AppShellPcNavItem[];
		isScrolled?: boolean;
		onNavClick?: (e: MouseEvent, href: string) => void;
	}

	let { navItems, isScrolled = false, onNavClick }: Props = $props();
</script>

<!-- 데스크톱 상단 고정 블러 헤더 (순수 렌더링) -->
<header class="main-header" class:is-scrolled={isScrolled}>
	<!-- 좌측: 로고 + 카테고리 네비게이션 -->
	<div class="header-left">
		<div class="logo-wrap">
			<FdTitle
				height={38}
				href="/"
				lpPattern={false}
				disconnectOnHover={true}
				disconnectOnClick={false}
				ariaLabel="INDIG 홈"
			/>
		</div>

		<nav class="header-nav" aria-label="메인 네비게이션" data-sveltekit-noscroll>
			{#each navItems as item (item.baseHref)}
				<a
					href={item.href}
					class="nav-item"
					class:is-active={item.active}
					onclick={(e) => onNavClick?.(e, item.href)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</div>

	<!-- 우측: BGM 플레이어 + 원형 프로필 사진 -->
	<div class="header-right">
		<div class="bgm-slot">
			<FdBgmPlayer size={36} />
		</div>

		<div class="profile-slot">
			<FdProfileButton />
		</div>
	</div>
</header>

<style>
	.main-header {
		position: sticky;
		top: 0;
		z-index: 50;
		height: var(--pc-header-height, 70px);
		width: 100%;
		max-width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 0 0.9rem 0 1.5rem;
		box-sizing: border-box;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
		overflow-x: clip;
		border-bottom: var(--thin-border);
		border-bottom-color: transparent;
		transition:
			border-bottom-color 0.24s ease,
			background-color 0.36s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.main-header.is-scrolled {
		border-bottom: var(--thin-border);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
		flex-shrink: 1;
	}

	.logo-wrap {
		view-transition-name: indig-logo;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		aspect-ratio: 38 / 10;
		flex-shrink: 0;
	}

	.header-nav {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.nav-item {
		color: var(--muted);
		font-size: 0.95rem;
		font-weight: 500;
		text-decoration: none;
		padding: 0.5rem 0.85rem;
		transition: color 0.18s ease;
		white-space: nowrap;
	}

	.nav-item:hover,
	.nav-item.is-active {
		color: var(--white);
	}

	.bgm-slot,
	.profile-slot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.bgm-slot {
		margin-right: -5px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-shrink: 0;
	}
</style>
