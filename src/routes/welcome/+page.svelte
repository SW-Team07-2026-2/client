<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, SIGNUP_AGREEMENTS_KEY, clearSignupFlow, isSignupFlowActive } from '#lib/auth';
	import {
		FdButton,
		FdTitle,
		FdInput,
		FdWelcomeDisplay,
		FdBgmPlayer,
		type ArtistItem
	} from '#lib/components';

	let selectedIds = $state<string[]>([]);
	let selectedArtists = $state<ArtistItem[]>([]);
	let isSubmitting = $state(false);
	/** 인트로 오프닝이 완전히 끝났는지 여부 */
	let introDone = $state(false);
	/** 접근 검증 통과 여부 (기존 회원 로그인 또는 가입 진행 중) */
	let ready = $state(false);
	/** 가입 진행 중(약관 동의 완료)인지 */
	let isSignupMode = $state(false);

	onMount(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;

		(async () => {
			const hasAgreements = sessionStorage.getItem(SIGNUP_AGREEMENTS_KEY) !== null;
			if (hasAgreements && isSignupFlowActive()) {
				// 신규 가입자: 아직 회원이 아니라 로그인 검증 불가 → G13 에서 서버가 SIGNUP 쿠키를 검증
				isSignupMode = true;
			} else if (!(await auth.checkAuth())) {
				await goto('/', { replaceState: true });
				return;
			}
			ready = true;
			timer = setTimeout(() => {
				introDone = true;
			}, 2500);
		})();

		return () => clearTimeout(timer);
	});

	function handleSelectionChange(artists: ArtistItem[], ids: string[]) {
		selectedArtists = artists;
		selectedIds = ids;
	}

	async function submitSignup(artistIds: number[]) {
		if (isSignupMode) {
			try {
				const agreements = JSON.parse(sessionStorage.getItem(SIGNUP_AGREEMENTS_KEY) ?? '[]');
				await auth.signup(artistIds, agreements);
			} catch (err: any) {
				console.warn('G13 signup failed:', err);
				if (err?.code === 'TERMS_OUTDATED' || err?.code === 'REQUIRED_AGREEMENT_MISSING') {
					alert('약관이 변경되었어요. 다시 확인해 주세요.');
					sessionStorage.removeItem(SIGNUP_AGREEMENTS_KEY);
					await goto('/signup', { replaceState: true });
				} else if (err?.code === 'SIGNUP_EXPIRED' || err?.code === 'SIGNUP_INVALID') {
					alert(err?.message || '가입 시간이 지났어요. 다시 로그인해 주세요.');
					clearSignupFlow();
					await goto('/', { replaceState: true });
				} else {
					alert(err?.message || '가입에 실패했어요. 잠시 후 다시 시도해 주세요.');
				}
				return;
			}
		}
		await goto('/artist');
	}

	async function handleComplete() {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const numericIds = selectedIds
				.map((id) => parseInt(id, 10))
				.filter((n) => !isNaN(n));
			await submitSignup(numericIds);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSkip() {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			await submitSignup([]);
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#snippet actionButtons()}
	<div class="actions-group">
		<!-- BGM 재생/정지 버튼 (전역 싱글톤 연동) -->
		<!-- 검색 Input -->
		<FdInput>
			{#snippet prefix()}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 512 512"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						d="M416 208c0 45.9-14.9 88.3-40 122.7l126.6 126.7c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0s208 93.1 208 208M208 352a144 144 0 1 0 0-288a144 144 0 1 0 0 288"
					/>
				</svg>
			{/snippet}
		</FdInput>
		<FdBgmPlayer size={38} />

		{#if selectedIds.length > 0}
			<!-- 아티스트를 1명 이상 선택했을 때: 완료하기 버튼 (화이트 하이라이트) -->
			<FdButton
				class="action-main-btn"
				color="#ffffff"
				hoverColor="#f4f4f6"
				pressColor="#d4d4d8"
				waveColor="#ffffff"
				textColor="#070709"
				layers={2}
				bulge={9}
				disabled={isSubmitting}
				onclick={handleComplete}
			>
				{selectedIds.length}명 선택 완료하기
			</FdButton>
		{:else}
			<!-- 기본 상태 (선택 없음): 건너뛰기 버튼 (다크 스타일) -->
			<FdButton
				class="action-main-btn"
				color="#1c1c22"
				hoverColor="#2a2a33"
				pressColor="#141418"
				waveColor="#3a3a46"
				textColor="#d4d4d8"
				layers={1}
				bulge={6}
				onclick={handleSkip}
			>
				건너뛰기
			</FdButton>
		{/if}
	</div>
{/snippet}

<svelte:head>
	<title>INDIG - 취향 선택</title>
</svelte:head>

{#if ready}
<main class="welcome-page" class:intro-active={!introDone}>
	<!-- 1. 첫 진입 인트로 화면:
	     "Welcome to" (덜 밝은 색) + "INDIG" (화면 가득 찬 거대 로고, View Transition 연동)
	     잠시 머문 뒤 둘 다 같이 위로 올라가며 투명해져 사라짐 -->
	{#if !introDone}
		<div class="intro-overlay" aria-hidden="true">
			<p class="welcome-label">Welcome to</p>
			<div class="intro-logo-wrap">
				<FdTitle disconnectOnClick={false} lpPattern={false} />
			</div>
		</div>
	{/if}

	<!-- 2. 상단 고정 헤더 (Always Fixed):
	     - PC: 좌측에 타이틀, 우측에 액션 버튼 완벽 정렬
	     - 모바일: 화면 상단 중앙에 타이틀 고정 -->
	<header class="welcome-fixed-header">
		<div class="header-inner">
			<h1 class="welcome-title">좋아하는 아티스트를 골라주세요.</h1>

			<!-- PC 전용: 상단 우측 고정 버튼 -->
			<div class="pc-actions">
				{@render actionButtons()}
			</div>
		</div>
	</header>

	<!-- 3. 메인 인터랙션 콘텐츠 (WebGL 메타볼 아티스트 선택 디스플레이) -->
	<section class="display-section">
		<div class="display-inner">
			<FdWelcomeDisplay bind:selectedIds onChange={handleSelectionChange} />
		</div>
	</section>

	<!-- 4. 모바일 전용: 화면 하단 고정 액션 바 (가운데 정렬) -->
	<footer class="welcome-footer">
		<div class="footer-inner">
			{@render actionButtons()}
		</div>
	</footer>
</main>
{/if}

<style>
	.welcome-page {
		height: 100dvh;
		max-height: 100dvh;
		background-color: #070709;
		color: #ffffff;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		overflow: hidden; /* 전체 브라우저 창 스크롤바 원천 차단 */
		position: relative;
	}

	/* 인트로 환영 애니메이션이 재생되는 동안 터치 등 차단 */
	.welcome-page.intro-active {
		overflow: hidden !important;
		height: 100dvh !important;
		max-height: 100dvh !important;
	}

	/* -------------------------------------------------------------
	   1. 화면 전체를 채우는 웅장한 Welcome to INDIG 인트로 오버레이
	   ------------------------------------------------------------- */
	.intro-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		box-sizing: border-box;
		pointer-events: none;
		overflow: hidden; /* 내부 요소 애니메이션으로 인한 뷰포트 스크롤바 유발 차단 */
		/* 1.6s까지 화면 중앙에 머물다가 1.6s~2.1s 동안 둘 다 같이 위로 올라가며 퇴장 */
		animation: introExit 0.5s cubic-bezier(0.16, 1, 0.3, 1) 1.6s forwards;
	}

	@keyframes introExit {
		0% {
			opacity: 1;
			transform: translateY(0);
			visibility: visible;
		}
		100% {
			opacity: 0;
			transform: translateY(-80px);
			visibility: hidden;
		}
	}

	.welcome-label {
		margin: 0;
		font-size: clamp(1.2rem, 3.5vw, 2.2rem);
		font-weight: 500;
		color: #8c8c96; /* 덜 밝은 톤으로 세련된 밸런스 */
		letter-spacing: -0.02em;
		text-align: center;
		animation: labelFade 0.6s ease-out;
	}

	@keyframes labelFade {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.intro-logo-wrap {
		view-transition-name: indig-logo; /* 첫 화면 로고와 크기/위치 모핑 연결 */
		width: 100%;
		max-width: min(86vw, 42rem);
		aspect-ratio: 38 / 10;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		margin-top: clamp(0.5rem, 1.5vh, 1.25rem);
		animation: logoPop 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes logoPop {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* -------------------------------------------------------------
	   2. 상단 고정 헤더 (반투명 백드롭 블러)
	   ------------------------------------------------------------- */
	.welcome-fixed-header {
		flex-shrink: 0;
		position: sticky;
		top: 0;
		left: 0;
		right: 0;
		z-index: 30;
		width: 100%;
		background: rgba(7, 7, 9, 0.75);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		/* 인트로가 끝나기 전에는 헤더를 부드럽게 감춤 */
		opacity: 0;
		animation: headerReveal 0.5s ease-out 2s forwards;
	}

	@keyframes headerReveal {
		to {
			opacity: 1;
		}
	}

	.header-inner {
		max-width: 1320px;
		margin: 0 auto;
		height: 64px;
		padding: 0 1.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
	}

	.welcome-title {
		margin: 0;
		font-size: clamp(1.05rem, 2.2vw, 1.45rem);
		font-weight: 600;
		letter-spacing: -0.025em;
		color: #ffffff;
		white-space: nowrap;
	}

	.pc-actions {
		display: flex;
		align-items: center;
	}

	/* 공통 액션 그룹 (버튼들) */
	.actions-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.actions-group :global(.action-main-btn) {
		font-size: 0.875rem !important;
		font-weight: 600 !important;
		letter-spacing: -0.015em;
		white-space: nowrap;
		padding: 0 1.25rem !important;
		height: 38px !important;
	}

	/* -------------------------------------------------------------
	   3. 메인 인터랙션 콘텐츠 영역 (중앙 배치)
	   ------------------------------------------------------------- */
	.display-section {
		flex: 1;
		min-height: 0; /* flex 자식의 오버플로우 방지 필수 */
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none; /* Firefox 스크롤바 숨김 */
		-ms-overflow-style: none; /* IE/Edge */
		box-sizing: border-box;
		position: relative;
		/* 인트로가 끝날 무렵 부드럽게 페이드인 */
		opacity: 0;
		animation: contentReveal 0.6s ease-out 1.9s forwards;
	}

	.display-section::-webkit-scrollbar {
		display: none; /* Chrome/Safari/Edge 스크롤바 숨김 */
	}

	@keyframes contentReveal {
		to {
			opacity: 1;
		}
	}

	.display-inner {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	/* -------------------------------------------------------------
	   4. 모바일 전용 하단 고정 액션 바
	   ------------------------------------------------------------- */
	.welcome-footer {
		display: none; /* PC에서는 숨김 */
	}

	/* -------------------------------------------------------------
	   반응형 (모바일: 640px 이하)
	   ------------------------------------------------------------- */
	@media (max-width: 640px) {
		.header-inner {
			height: 56px;
			padding: 0 1rem;
			justify-content: center; /* 모바일에서는 중앙 타이틀 정렬 */
		}

		.pc-actions {
			display: none; /* 모바일 헤더에서는 액션 버튼 숨김 */
		}

		.welcome-title {
			font-size: 1.05rem;
			text-align: center;
		}

		.display-section {
			/* 모바일 상하단 바 공간 확보 및 유연한 뷰포트 내 배치 */
			min-height: 0;
			padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
		}

		.welcome-footer {
			display: block;
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			z-index: 30;
			background: rgba(7, 7, 9, 0.85);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			border-top: 1px solid rgba(255, 255, 255, 0.08);
			padding: 0.75rem 1rem max(0.75rem, env(safe-area-inset-bottom, 0px));
			opacity: 0;
			animation: footerReveal 0.5s ease-out 2s forwards;
		}

		@keyframes footerReveal {
			to {
				opacity: 1;
			}
		}

		.footer-inner {
			max-width: 420px;
			margin: 0 auto;
		}

		.footer-inner .actions-group {
			width: 100%;
			justify-content: space-between;
			gap: 0.5rem;
		}

		.footer-inner .actions-group :global(.action-main-btn) {
			flex: 1;
		}
	}
</style>

