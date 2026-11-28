<script lang="ts">
	import {
		attachMobilePullToRefresh,
		type PullToRefreshState
	} from '#lib/common/logic/pullToRefresh';
	import MbAlertView from './design/mobile/MbAlertView.svelte';
	import { AlertController } from './logic/alert.svelte';

	interface Props {
		/** 패널이 실제로 열려 있는지 여부 (열릴 때 목록 자동 로드) */
		open?: boolean;
		onClose?: () => void;
	}

	let { open = false, onClose }: Props = $props();

	const ctrl = new AlertController();
	let scrollEl = $state<HTMLDivElement | null>(null);
	let ptrState = $state<PullToRefreshState>({
		pullPx: 0,
		progress: 0,
		ready: false,
		refreshing: false
	});

	$effect(() => {
		if (open) {
			void ctrl.load();
		}
	});

	$effect(() => {
		if (!open || !scrollEl) {
			ptrState = { pullPx: 0, progress: 0, ready: false, refreshing: false };
			return;
		}
		return attachMobilePullToRefresh({
			target: scrollEl,
			canStart: () => open && !ctrl.isLoading,
			onStateChange: (next) => {
				ptrState = next;
			},
			onRefresh: () => ctrl.load(true)
		});
	});
</script>

<!-- 모바일 AppShell 우측 패널 진입점 -->
<MbAlertView
	bind:scrollEl
	items={ctrl.items}
	loading={ctrl.isLoading}
	loadingMore={ctrl.isLoadingMore}
	hasNext={ctrl.hasNext}
	unreadCount={ctrl.unreadCount}
	errorMessage={ctrl.errorMessage}
	{ptrState}
	{onClose}
	onItemClick={ctrl.handleItemClick}
	onMarkAllRead={ctrl.markAllRead}
	onLoadMore={ctrl.loadMore}
/>
