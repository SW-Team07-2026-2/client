<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '#lib/auth';
	import { isMobile } from '#lib/common/logic';
	import { AppShell } from '#lib/layout/1_app_shell';
	import {
		MainSection,
		MAIN_SECTION_KEYS,
		resolveMainSectionKey
	} from '#lib/layout/2_main_section';
	import {
		ContentSectionController,
		PcContentControl,
		PcContentHeader,
		isFilterableCategory,
		setContentSectionContext
	} from '#lib/layout/3_content_section';

	let { children }: { children: Snippet } = $props();

	// 현재 세션에서 서버 검증(isVerified)이 완료되었는지 확인.
	// 최초 진입 시에는 서버 검증이 완료될 때까지 자식을 마운트하지 않아 깜빡임 및 크래시를 방지함.
	let isCheckingAuth = $state(!auth.isVerified);

	const contentCtrl = new ContentSectionController();
	setContentSectionContext(contentCtrl);

	$effect.pre(() => {
		const activeKey = resolveMainSectionKey(page.url.pathname);
		contentCtrl.syncActiveCategoryToFeed(activeKey);
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
	<AppShell>
		<MainSection>
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
				{#if !isMobile.current && isFilterableCategory(section.key)}
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
				{/if}
			{/snippet}

			{@render children()}
		</MainSection>
	</AppShell>
{/if}
