<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { FdTitle } from '#lib/components';
	import { auth } from '#lib/auth';
	import BotArea from '#lib/ai/BotArea.svelte';

	let { children }: { children: Snippet } = $props();
	let avatarImgError = $state(false);

	// 모바일(640px 이하)에서는 hover/클릭 분리 효과 불필요 → 로고 인터랙션 비활성화
	let isMobile = $state(false);

	onMount(() => {
		const mq = window.matchMedia('(max-width: 640px)');
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	// 네비게이션 메뉴 목록 (아이콘 포함)
	const navItems = [
		{
			label: '아티스트',
			href: '/artist',
			icon: 'artist'
		},
		{
			label: '공연',
			href: '/concert',
			icon: 'concert'
		},
		{
			label: '음반∙LP',
			href: '/album',
			icon: 'album'
		},
		{
			label: '굿즈',
			href: '/goods',
			icon: 'goods'
		}
	];
</script>

<div class="user-layout">
	<!-- 상단 고정 블러 헤더 -->
	<header class="site-header">
		<!-- 좌측: 로고 (클릭 시 홈으로 SPA 이동) -->
		<div class="header-left">
			<div class="logo-wrap">
				<FdTitle
					height={28}
					href="/"
					lpPattern={false}
					disconnectOnHover={!isMobile}
					disconnectOnClick={false}
					ariaLabel="INDIG 홈"
				/>
			</div>
		</div>

		<!-- 중앙: 데스크톱 전용 4개 메뉴 -->
		<nav class="header-center" aria-label="메인 네비게이션">
			{#each navItems as item}
				<a href={item.href} class="nav-item">
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- 우측: 원형 프로필 사진 (모바일/데스크톱 공통 유지) -->
		<div class="header-right">
			<a href="/mypage" class="profile-btn" aria-label="내 프로필">
				<div class="avatar-ring">
					{#if auth.user?.profileImageUrl && !avatarImgError}
						<img
							src={auth.user.profileImageUrl}
							alt=""
							class="avatar-img"
							onerror={() => (avatarImgError = true)}
						/>
					{:else}
						<!-- 기본 인디 아카이브 아바타 실루엣 -->
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
				</div>
			</a>
		</div>
	</header>

	<!-- 메인 본문 컨텐츠 -->
	<main class="page-content">
		{@render children()}
	</main>

	<!-- 모바일 전용: 화면 아래쪽 고정 하단 네비게이션 바 -->
	<nav class="mobile-bottom-nav sm:hidden" aria-label="하단 네비게이션">
		{#each navItems as item}
			<a href={item.href} class="mobile-nav-item">
				<span class="mobile-icon">
					{#if item.icon === 'artist'}
						<!-- 마이크/아티스트 아이콘 -->
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 016 0v7.5a3 3 0 01-3 3z"
							/>
						</svg>
					{:else if item.icon === 'concert'}
						<!-- 티켓/공연 아이콘 -->
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"
							/>
						</svg>
					{:else if item.icon === 'album'}
						<!-- LP 바이닐 음반 아이콘 -->
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
							<circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-linejoin="round" />
							<circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" />
							<path stroke-linecap="round" d="M12 3a9 9 0 019 9" />
						</svg>
					{:else if item.icon === 'goods'}
						<!-- 굿즈 쇼핑백 아이콘 -->
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

	<!-- AI 어시스턴트 봇 & 대화창 (플로팅 봇 + 상단 도킹 모핑 + 말풍선 없는 마크다운 대화) -->
	<BotArea />
</div>

<style>
	.user-layout {
		min-height: 100dvh;
		width: 100%;
		display: flex;
		flex-direction: column;
		background-color: var(--bg, #070709);
		color: var(--fg, #f0f0f0);
	}

	/* 상단 헤더: 반투명 다크 & 백드롭 블러 */
	.site-header {
		position: sticky;
		top: 0;
		z-index: 50;
		height: 60px;
		width: 100%;
		display: grid;
		/* 좌/우 영역을 동일한 1fr로 두어 중앙 메뉴가 항상 정중앙에 오도록 함 */
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 1rem;
		box-sizing: border-box;
		background: rgba(7, 7, 9, 0.75);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	/* 좌측 영역 (로고) */
	.header-left {
		grid-column: 1;
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.logo-wrap {
		view-transition-name: indig-logo; /* 첫 페이지의 로고와 트랜지션 연결 */
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 28px;
		aspect-ratio: 38 / 10;
		flex-shrink: 0;
	}

	/* -------------------------------------------------------------
	   Mobile-First 기본 스타일:
	   기본이 모바일이므로 상단 중앙 버튼은 '기본 숨김(display: none)'으로 시작!
	   ➔ 모바일 새로고침 시 상단에 버튼이 잠깐 떴다가 사라지는 FOUC 완전 차단!
	   ------------------------------------------------------------- */
	.header-center {
		grid-column: 2;
		display: none;
		align-items: center;
		justify-content: center;
		gap: clamp(0.75rem, 2vw, 2rem);
	}

	.nav-item {
		color: #9e9ea7;
		font-size: 0.95rem;
		font-weight: 500;
		text-decoration: none;
		padding: 0.5rem 0.85rem;
		border-radius: 8px;
		transition: all 0.18s ease;
		white-space: nowrap;
	}

	.nav-item:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.06);
	}

	/* 우측 영역 (원형 프로필) */
	.header-right {
		grid-column: 3;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
	}

	.profile-btn {
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		outline: none;
	}

	.profile-btn:focus-visible {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
	}

	.avatar-ring {
		width: 36px;
		height: 36px;
		border-radius: 9999px;
		background: #17161f;
		border: 1px solid rgba(255, 255, 255, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			border-color 0.2s ease,
			transform 0.2s ease;
		overflow: hidden;
	}

	.profile-btn:hover .avatar-ring {
		border-color: rgba(255, 255, 255, 0.4);
		transform: scale(1.04);
	}

	.avatar-svg {
		width: 19px;
		height: 19px;
		color: #a1a1aa;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* 모바일 전용 하단 바 (기본 flex 활성화) */
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

	/* 본문 영역: 모바일에서는 하단 바 여백 확보 */
	.page-content {
		flex: 1;
		width: 100%;
		padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
	}

	/* -------------------------------------------------------------
	   데스크톱 화면 (641px 이상, sm:):
	   - 상단 중앙 네비게이션 flex 활성화
	   - 하단 바 숨김
	   - 본문 하단 여백 제거
	   ------------------------------------------------------------- */
	@media (min-width: 641px) {
		.site-header {
			padding: 0 1.5rem;
		}

		.header-center {
			display: flex;
		}

		.mobile-bottom-nav {
			display: none;
		}

		.page-content {
			padding-bottom: 0;
		}
	}
</style>
