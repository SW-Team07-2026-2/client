<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { isMobile } from '#lib/common/logic';
	import PcAlertView from './design/pc/PcAlertView.svelte';
	import { AlertController } from './logic/alert.svelte';

	interface Props {
		/** Keep-Alive 파킹 중에는 false, 실제 /alert 활성 시 true */
		active?: boolean;
	}

	let { active = true }: Props = $props();

	const ctrl = new AlertController();
	const mobile = $derived(isMobile.current);
	let hasLoaded = false;
	let wasActive = untrack(() => active);

	$effect(() => {
		const isNowActive = active;
		const isMb = mobile;
		if (isMb) return;

		untrack(() => {
			if (!hasLoaded) {
				hasLoaded = true;
				void ctrl.load();
			} else if (isNowActive && !wasActive) {
				// Keep-Alive 재진입 시 기존 목록을 즉시 표시하면서 백그라운드 갱신
				void ctrl.load();
			}
			wasActive = isNowActive;
		});
	});

	function handleBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
			return;
		}
		void goto('/artist', { replace: true });
	}
</script>

<!-- /alert 라우트 진입점 (PC: 상단 열림 독립 페이지, 모바일: AppShell 우측 패널이 대신 표시됨) -->
{#if !mobile}
	<PcAlertView
		items={ctrl.items}
		loading={ctrl.isLoading}
		loadingMore={ctrl.isLoadingMore}
		hasNext={ctrl.hasNext}
		unreadCount={ctrl.unreadCount}
		errorMessage={ctrl.errorMessage}
		onBack={handleBack}
		onItemClick={ctrl.handleItemClick}
		onMarkAllRead={ctrl.markAllRead}
		onLoadMore={ctrl.loadMore}
	/>
{/if}
