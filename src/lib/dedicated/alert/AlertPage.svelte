<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isMobile } from '#lib/common/logic';
	import PcAlertView from './design/pc/PcAlertView.svelte';
	import { AlertController } from './logic/alert.svelte';

	const ctrl = new AlertController();
	const mobile = $derived(isMobile.current);

	onMount(() => {
		if (!mobile) {
			void ctrl.load();
		}
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
