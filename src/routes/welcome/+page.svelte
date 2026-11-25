<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { FdTitle, FdToast, type ToastType } from '#lib/common';
	import {
		WelcomeAgreeModal,
		WelcomeArtistSection,
		loadCatalogArtists,
		loadWelcomeTerms,
		checkSignupSession,
		submitWelcomeSignup,
		type WelcomeStep,
		type WelcomeAgreementsMap,
		type TermsItem,
		type ArtistItem
	} from '#lib/dedicated/welcome';
	import { auth, isSignupFlowActive, clearSignupFlow } from '#lib/auth';

	let allowed = $state(false);
	let artistsPassed = $state(false);
	let termsList = $state<TermsItem[]>([]);
	let agreements = $state<WelcomeAgreementsMap>({});

	let artists = $state<ArtistItem[]>([]);
	let catalogPage = $state(0);
	let hasNextCatalog = $state(false);

	let selectedIds = $state<string[]>([]);
	let searchQuery = $state('');
	let isLoadingMore = $state(false);
	let isSubmitting = $state(false);
	let isCompleting = $state(false);
	let introDone = $state(false);

	// FdToast 상태
	let toastOpen = $state(false);
	let toastType = $state<ToastType>('info');
	let toastMessage = $state('');
	let toastTrigger = $state(0);

	// URL 파라미터 기반 단계 판별 (기본: 'artists', ?step=terms 일 때 약관 모달 오픈)
	const step = $derived<WelcomeStep>(
		page.url.searchParams.get('step') === 'terms' ? 'terms' : 'artists'
	);

	// 검색어가 입력되면 이름·장르 기준으로 필터링
	const visibleArtists = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return artists;
		return artists.filter(
			(a) => a.name.toLowerCase().includes(q) || a.genre?.toLowerCase().includes(q)
		);
	});

	function showToast(message: string, type: ToastType = 'error') {
		toastMessage = message;
		toastType = type;
		toastOpen = true;
		toastTrigger += 1;
	}

	onMount(() => {
		(async () => {
			auth.captureXsrfFromUrl();

			// 1. 이미 가입된 로그인 상태(정식 회원)면 /artist로 이동
			if (await auth.checkAuth(false)) {
				await goto('/artist', { replaceState: true });
				return;
			}

			// 2. 카카오 로그인을 거쳐 발급된 가입 플로우가 없으면 /로 이동
			if (!isSignupFlowActive()) {
				clearSignupFlow();
				await goto('/', { replaceState: true });
				return;
			}

			// 3. v2 GET /api/auth/signup 으로 서버의 SIGNUP 쿠키 유효성 확인
			const sessionStatus = await checkSignupSession();
			if (sessionStatus === 'EXPIRED') {
				clearSignupFlow();
				await goto('/', { replaceState: true });
				return;
			}

			allowed = true;

			// 4. 카탈로그 아티스트 목록 & 최신 약관 목록 병렬 조회 (약관 응답 헤더에서 XSRF 토큰도 캡처)
			try {
				const [catalogRes, fetchedTerms] = await Promise.all([
					loadCatalogArtists({ page: 0, size: 20 }),
					loadWelcomeTerms()
				]);

				artists = catalogRes.items;
				catalogPage = catalogRes.page;
				hasNextCatalog = catalogRes.hasNext;
				termsList = fetchedTerms;
			} catch (err: any) {
				showToast(err?.message || '온보딩 데이터를 불러오지 못했습니다.');
			}
		})();
	});

	// 아티스트를 1명 이상 선택하지 않았거나 단계를 거치지 않고 ?step=terms 접근 시 ?step=artists로 되돌림
	$effect(() => {
		if (!allowed) return;
		if (step === 'terms' && (!artistsPassed || selectedIds.length === 0)) {
			goto('/welcome?step=artists', { replaceState: true });
		}
	});

	function handleToggleArtist(artist: ArtistItem, _index: number, nextSelected: boolean) {
		if (!nextSelected) {
			selectedIds = selectedIds.filter((id) => id !== artist.id);
			return;
		}

		if (!selectedIds.includes(artist.id)) {
			selectedIds = [...selectedIds, artist.id];
		}
	}

	async function handleAddMore() {
		if (isLoadingMore || !hasNextCatalog) return;
		isLoadingMore = true;
		try {
			const existingIds = new Set(artists.map((a) => a.id));
			const next = await loadCatalogArtists({
				page: catalogPage + 1,
				size: 12
			});
			const fresh = next.items.filter((item) => !existingIds.has(item.id));
			if (fresh.length > 0) {
				artists = [...artists, ...fresh];
			}
			catalogPage = next.page;
			hasNextCatalog = next.hasNext;
		} catch (err: any) {
			showToast(err?.message || '아티스트를 더 불러오지 못했습니다.');
		} finally {
			isLoadingMore = false;
		}
	}

	function handleArtistsNext() {
		if (selectedIds.length === 0) return;
		artistsPassed = true;
		goto('/welcome?step=terms');
	}

	function handleBackToArtists() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			goto('/welcome?step=artists');
		}
	}

	function handleCancel() {
		clearSignupFlow();
		goto('/', { replaceState: true });
	}

	async function handleSubmit() {
		if (isSubmitting) return;
		isSubmitting = true;
		isCompleting = true;

		try {
			// 모달이 자연스럽게 닫히고 "Welcome to INDIG" + 로딩 연출을 최소 1.3초간 보여주며 가입 처리
			await Promise.all([
				submitWelcomeSignup(selectedIds, termsList, agreements),
				new Promise((resolve) => setTimeout(resolve, 1300))
			]);

			// isCompleting(indig-logo)을 유지한 채 이동해야 헤더 로고로 자연스럽게 View Transition 모핑됨
			await goto('/artist', { replaceState: true });
		} catch (err: any) {
			console.warn('G13 signup failed:', err);
			isCompleting = false;
			isSubmitting = false;
			const code = err?.code;

			if (code === 'TERMS_OUTDATED' || code === 'REQUIRED_AGREEMENT_MISSING') {
				showToast(err?.message || '약관이 변경되었어요. 다시 확인하고 동의해 주세요.');
				termsList = await loadWelcomeTerms();
				agreements = {};
			} else if (code === 'SIGNUP_EXPIRED' || code === 'SIGNUP_INVALID') {
				showToast(err?.message || '가입 시간이 지났어요. 다시 로그인해 주세요.');
				clearSignupFlow();
				setTimeout(() => {
					goto('/', { replaceState: true });
				}, 1200);
			} else {
				showToast(err?.message || '가입 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
			}
		}
	}
</script>

<svelte:head>
	<title>{step === 'artists' ? 'INDIG - 취향 선택' : 'INDIG - 서비스 이용 동의'}</title>
</svelte:head>

<FdToast
	bind:open={toastOpen}
	type={toastType}
	message={toastMessage}
	trigger={toastTrigger}
/>

{#if allowed}
	<WelcomeArtistSection
		artists={visibleArtists}
		bind:selectedIds
		bind:searchQuery
		bind:introDone
		{isSubmitting}
		{isLoadingMore}
		onToggleArtist={handleToggleArtist}
		onAddMore={hasNextCatalog ? handleAddMore : undefined}
		onComplete={handleArtistsNext}
	/>

	{#if step === 'terms' && artistsPassed && selectedIds.length > 0 && !isCompleting}
		<WelcomeAgreeModal
			{termsList}
			bind:agreements
			{isSubmitting}
			onBack={handleBackToArtists}
			onSubmit={handleSubmit}
			onCancel={handleCancel}
		/>
	{/if}

	{#if isCompleting}
		<div
			class="welcome-finishing-overlay"
			in:fade={{ duration: 420, delay: 140, easing: cubicOut }}
			out:fade={{ duration: 220, easing: cubicOut }}
			role="status"
			aria-live="polite"
			aria-label="회원가입 처리 중"
		>
			<p class="finishing-label">Welcome to</p>
			<div class="finishing-logo-wrap">
				<FdTitle disconnectOnClick={false} lpPattern={false} />
			</div>
			<div class="finishing-loader" aria-hidden="true">
				<span class="spinner"></span>
			</div>
		</div>
	{/if}
{/if}

<style>
	.welcome-finishing-overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		box-sizing: border-box;
		background-color: #070709;
	}

	.finishing-label {
		margin: 0;
		font-size: clamp(1.2rem, 3.5vw, 2.2rem);
		font-weight: 500;
		color: #8c8c96;
		letter-spacing: -0.02em;
		text-align: center;
		animation: finishingFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
	}

	.finishing-logo-wrap {
		view-transition-name: indig-logo;
		width: 100%;
		max-width: min(86vw, 42rem);
		aspect-ratio: 38 / 10;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		margin-top: clamp(0.5rem, 1.5vh, 1.25rem);
		animation: finishingLogoPop 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
	}

	.finishing-loader {
		margin-top: clamp(1.75rem, 4vh, 2.75rem);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: finishingFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.38s both;
	}

	.spinner {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.16);
		border-top-color: #ffffff;
		animation: finishingSpin 0.8s linear infinite;
	}

	@keyframes finishingFadeUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes finishingLogoPop {
		from {
			opacity: 0;
			transform: scale(0.94);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes finishingSpin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
