<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { FdBackground as FluidVinyl, FdTitle, FdButton, FdBgmPlayer } from '#lib/components';
	import { auth } from '#lib/auth';

	let { children }: { children?: Snippet } = $props();

	onMount(() => {
		auth.checkAuth();
	});

	function handleKakaoLogin() {
		auth.startKakaoLogin();
	}
</script>

<svelte:head>
	<title>INDIG</title>
</svelte:head>

<main>
	<div class="hero-brand">
		<div class="title-wrap">
			<FdTitle />
		</div>

		<p>당신을 위한 숨은 인디밴드, INDIG에서 발굴하세요</p>

		<div class="bgm-wrap">
			<FdBgmPlayer />
		</div>
	</div>

	<div class="actions">
		{#if auth.isLoggedIn && auth.user}
			<FdButton
				color="#ffffff"
				hoverColor="#f4f4f5"
				pressColor="#e4e4e7"
				textColor="#191919"
				onclick={() => goto('/welcome')}
			>
				<div class="btn-content">
					<span>{auth.user.nickname ?? '회원'}님으로 계속하기</span>
				</div>
			</FdButton>
		{:else}
			<FdButton
				color="#fee500"
				hoverColor="#ffec3d"
				pressColor="#edd500"
				textColor="#191919"
				disabled={auth.isLoading}
				onclick={handleKakaoLogin}
			>
				<div class="btn-content">
					<!-- Kakao SVG -->
					<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M12 3c-5.523 0-10 3.582-10 8 0 2.87 1.875 5.394 4.717 6.764l-1.189 4.382c-.114.421.36.757.702.502l5.132-3.41c.21.01.423.016.638.016 5.523 0 10-3.582 10-8s-4.477-8-10-8z"
						/>
					</svg>
					<span>
						{auth.isLoading ? '로그인 중...' : '카카오로 시작하기'}
					</span>
				</div>
			</FdButton>
		{/if}
	</div>
</main>

<!-- 모달 또는 오버레이 요소가 전달되었을 때 화면 위에 렌더링 -->
{#if children}
	{@render children()}
{/if}

<!-- 배경화면 -->
<div class="vinyl-bg">
	<FluidVinyl
		color="#ddd"
		lineCount={17}
		lineWidth={0.7}
		elevation={0.35}
		foreground={0.15}
		tilt={24}
		speed={0.35}
		direction="forward"
		glow={0.85}
		depthOfField={0}
		fog={0.06}
		hoverEffect="light"
		clickEffect="pulse"
		scale={0.85}
		detail={1}
		morph={0.35}
		brightness={1.5}
		opacity={0.87}
		mouseStrength={0.35}
		trail={0.16}
		parallax={1}
	/>
</div>

<style>
	.vinyl-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
	}

	main {
		height: 100dvh;
		max-height: 100dvh;
		width: 100%;
		overflow: hidden;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(0.75rem, 2vh, 1.5rem);
		padding: 1.5rem 1rem;
		text-align: center;
		animation: heroIntro 1s ease-in-out;
	}

	@keyframes heroIntro {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.hero-brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(0.75rem, 2vh, 1.5rem);
		width: 100%;
	}

	.title-wrap {
		view-transition-name: indig-logo;
		width: 100%;
		max-width: min(88vw, 31rem);
		aspect-ratio: 38 / 10;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		padding: 0;
	}

	.hero-brand p {
		margin: 0;
		color: #fff;
		font-size: clamp(0.95rem, 2.4vw + 0.4rem, 1.6rem);
		font-weight: 500;
		letter-spacing: -0.01em;
		word-break: keep-all;
		text-shadow: 0 0 10px #000;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
	}

	.actions :global(.lq button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.btn-content {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		user-select: none;
		padding: 2px;
	}

	.btn-content svg {
		width: 1.2rem;
		height: 1.2rem;
		flex-shrink: 0;
		display: block;
	}

	.btn-content span {
		font-size: 0.875rem;
		font-weight: 500;
		letter-spacing: -0.025em;
	}

	/* 640px 초과 : PC */
	@media (min-width: 641px) {
		main {
			display: grid;
			grid-template-columns: auto auto;
			grid-template-rows: auto auto auto;
			justify-content: center;
			align-content: center;
			row-gap: clamp(0.75rem, 2vh, 1.5rem);
			column-gap: 0.75rem;
		}

		.hero-brand {
			display: contents;
		}

		.title-wrap {
			grid-column: 1 / -1;
			justify-self: center;
		}

		.hero-brand p {
			grid-column: 1 / -1;
			justify-self: center;
		}

		.bgm-wrap {
			grid-column: 1;
			grid-row: 3;
			justify-self: end;
			align-self: center;
			display: flex;
			align-items: center;
		}

		.actions {
			grid-column: 2;
			grid-row: 3;
			justify-self: start;
			align-self: center;
			margin: 0;
			width: auto;
		}
	}

	/* 640px 이하 : 모바일 */
	@media (max-width: 640px) {
		main {
			justify-content: space-between;
			padding-top: max(1.5rem, env(safe-area-inset-top, 0px));
			padding-bottom: max(1.5rem, calc(1rem + env(safe-area-inset-bottom, 0px)));
			gap: 1rem;
		}

		.hero-brand {
			flex: 1;
			min-height: 0;
			justify-content: center;
		}

		.bgm-wrap {
			margin-top: 0.25rem;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.actions {
			flex-direction: column;
			max-width: 320px;
			gap: 0;
			margin-top: auto;
			margin-bottom: 0;
		}

		.actions :global(.lq) {
			width: 100%;
		}

		.actions :global(.lq button) {
			width: 100%;
		}

		.btn-content {
			min-width: 0;
			width: 100%;
		}
	}
</style>

