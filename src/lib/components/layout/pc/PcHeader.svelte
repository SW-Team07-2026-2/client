<script lang="ts">
	import { page } from '$app/state';
	import { handleSameRouteScrollTop } from '#lib/utils/scroll';
	import FdTitle from '../../ui/FdTitle.svelte';
	import FdBgmPlayer from '../../ui/FdBgmPlayer.svelte';
	import FdProfileButton from '../../feature/FdProfileButton.svelte';

	let scrollY = $state(0);
	const isScrolled = $derived(scrollY > 2);

	const navItems = [
		{ label: '아티스트', href: '/artist' },
		{ label: '공연', href: '/concert' },
		{ label: '앨범', href: '/album' },
		{ label: '굿즈', href: '/goods' }
	] as const;
</script>

<svelte:window bind:scrollY />

<!-- 데스크톱 상단 고정 블러 헤더 -->
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
			{#each navItems as item}
				<a
					href={item.href}
					class="nav-item"
					onclick={(e) => handleSameRouteScrollTop(e, item.href, page.url.pathname)}
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
		transition: border-bottom-color 0.2s ease;
	}

	.main-header.is-scrolled {
		border-bottom: var(--thin-border);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: clamp(0.75rem, 2vw, 1.25rem);
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
		gap: clamp(0.25rem, 1vw, 0.5rem);
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

	.nav-item:hover {
		color: #ffffff;
	}

	.bgm-slot,
	.profile-slot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.bgm-slot {
		margin-right: -15px;
	}

	.header-right {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-shrink: 0;
	}
</style>
