<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '#lib/auth';
	import { isMobile } from '#lib/common/logic';
	import {
		CART_ROUTE_PATH,
		CHECKOUT_ROUTE_PATH,
		isAlertRoute,
		isPayFlowRoute
	} from '#lib/config/routes';
	import { AlertPage } from '#lib/dedicated/alert';
	import { PayFlowStage, type PayFlowStep } from '#lib/dedicated/pay';
	import { AppShell, mobileScrollVisibility } from '#lib/layout/1_app_shell';
	import {
		MainSection,
		MAIN_SECTION_KEYS,
		parseMainSectionDetailId,
		resolveMainSectionKey
	} from '#lib/layout/2_main_section';
	import {
		ContentSectionController,
		MbContentHeader,
		MbPullToRefreshIndicator,
		PcContentControl,
		PcContentHeader,
		attachMobilePullToRefresh,
		isFilterableCategory,
		setContentSectionContext,
		type PullToRefreshState
	} from '#lib/layout/3_content_section';

	let { children }: { children: Snippet } = $props();

	// 현재 세션에서 서버 검증(isVerified)이 완료되었는지 확인.
	// 최초 진입 시에는 서버 검증이 완료될 때까지 자식을 마운트하지 않아 깜빡임 및 크래시를 방지함.
	let isCheckingAuth = $state(!auth.isVerified);

	const contentCtrl = new ContentSectionController();
	setContentSectionContext(contentCtrl);

	const activeSectionKey = $derived(resolveMainSectionKey(page.url.pathname));
	const isDetailRoute = $derived(parseMainSectionDetailId(page.url.pathname) !== null);
	const isPayRoute = $derived(isPayFlowRoute(page.url.pathname));
	const isPcAlertRoute = $derived(!isMobile.current && isAlertRoute(page.url.pathname));
	const payFlowStep = $derived.by<PayFlowStep | null>(() => {
		const normalized = page.url.pathname.replace(/\/+$/, '') || '/';
		if (normalized === CART_ROUTE_PATH) return 'cart';
		if (normalized === CHECKOUT_ROUTE_PATH) return 'checkout';
		return null;
	});

	// Keep-Alive 장바구니/결제 · PC 알림함 스테이지: 첫 진입 전 유휴 시간에 백그라운드 프리마운트
	let payFlowMounted = $state(false);
	let alertFlowMounted = $state(false);
	let lastPayFlowStep = $state<PayFlowStep>('cart');

	$effect.pre(() => {
		if (payFlowStep !== null) {
			lastPayFlowStep = payFlowStep;
			payFlowMounted = true;
		}
		if (isPcAlertRoute) {
			alertFlowMounted = true;
		}
	});

	$effect(() => {
		if (isCheckingAuth || !auth.isLoggedIn || (payFlowMounted && (isMobile.current || alertFlowMounted))) {
			return;
		}
		const timer = setTimeout(() => {
			payFlowMounted = true;
			if (!isMobile.current) {
				alertFlowMounted = true;
			}
		}, 800);
		return () => clearTimeout(timer);
	});

	let ptrState = $state<PullToRefreshState>({
		pullPx: 0,
		progress: 0,
		ready: false,
		refreshing: false
	});

	$effect(() => {
		if (!isMobile.current) {
			ptrState = { pullPx: 0, progress: 0, ready: false, refreshing: false };
			return;
		}
		return attachMobilePullToRefresh({
			canStart: () =>
				!isCheckingAuth &&
				auth.isLoggedIn &&
				isFilterableCategory(activeSectionKey) &&
				!isDetailRoute &&
				!contentCtrl.isFilterOpen(activeSectionKey),
			onStateChange: (next) => {
				ptrState = next;
			},
			onRefresh: contentCtrl.triggerRefresh
		});
	});

	$effect.pre(() => {
		contentCtrl.syncActiveCategoryToFeed(activeSectionKey);
	});

	onMount(() => {
		(async () => {
			const isAuthed = await auth.checkAuth();
			if (!isAuthed || !auth.isLoggedIn) {
				await goto('/', { replaceState: true });
				return;
			}
			isCheckingAuth = false;
		})();
	});

	// 사용 중 세션이 만료/초기화되어 로그아웃 상태로 전환되면 검은 빈 화면에 머무르지 않고 메인으로 이동
	$effect(() => {
		if (!isCheckingAuth && !auth.isLoggedIn) {
			goto('/', { replaceState: true });
		}
	});
</script>

{#if !isCheckingAuth && auth.isLoggedIn}
	<AppShell
		mobileHeaderAlwaysVisible={isDetailRoute || isPayRoute}
		hideMobileBottomNav={isPayRoute}
	>
		<MainSection payFlowActive={payFlowStep !== null} alertFlowActive={isPcAlertRoute}>
			{#snippet pinnedHeader({ section })}
				{#if !isMobile.current && section}
					<PcContentHeader
						title={section.title}
						description={section.description}
						sectionIndex={MAIN_SECTION_KEYS.indexOf(section.key)}
					/>
				{/if}
			{/snippet}

			{#snippet pinnedControl({ section })}
				{#if isFilterableCategory(section.key)}
					{#if !isMobile.current}
						<PcContentControl
							searchQuery={contentCtrl.searchQuery}
							searchLabel="{section.label} 검색"
							searchPlaceholder={section.searchPlaceholder}
							filterOpen={contentCtrl.isFilterOpen(section.key)}
							hasActiveFilters={contentCtrl.hasActiveFilters(section.key)}
							feedMode={contentCtrl.feedMode}
							onSearchChange={contentCtrl.setSearchQuery}
							onSearchSubmit={contentCtrl.submitSearch}
							onFilterToggle={() => contentCtrl.toggleFilter(section.key)}
							onFilterReset={() => contentCtrl.resetCategoryFilter(section.key)}
							onFeedChange={(val) => contentCtrl.setFeedMode(val)}
							onRefresh={contentCtrl.triggerRefresh}
						/>
					{:else}
						<MbContentHeader
							searchQuery={contentCtrl.searchQuery}
							searchPlaceholder={section.searchPlaceholder}
							filterOpen={contentCtrl.isFilterOpen(section.key)}
							activeFilterCount={contentCtrl.getActiveFilterCount(section.key)}
							feedMode={contentCtrl.feedMode}
							hidden={mobileScrollVisibility.hidden}
							onSearchChange={contentCtrl.setSearchQuery}
							onSearchSubmit={contentCtrl.submitSearch}
							onFilterToggle={() => contentCtrl.toggleFilter(section.key)}
							onFeedChange={(val) => contentCtrl.setFeedMode(val)}
						/>
					{/if}
				{/if}
			{/snippet}

			{#snippet payFlow({ active })}
				{#if payFlowMounted}
					<PayFlowStage step={payFlowStep ?? lastPayFlowStep} {active} />
				{/if}
			{/snippet}

			{#snippet alertFlow({ active })}
				{#if alertFlowMounted && !isMobile.current}
					<AlertPage {active} />
				{/if}
			{/snippet}

			{@render children()}
		</MainSection>

		{#if isMobile.current}
			<MbPullToRefreshIndicator
				pullPx={ptrState.pullPx}
				progress={ptrState.progress}
				ready={ptrState.ready}
				refreshing={ptrState.refreshing}
			/>
		{/if}
	</AppShell>
{/if}
