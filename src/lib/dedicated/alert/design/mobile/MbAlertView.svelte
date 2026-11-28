<script lang="ts">
	import PullToRefreshIndicator from '#lib/common/design/PullToRefreshIndicator.svelte';
	import { PulseDotsSpinner } from '#lib/common/design/icon/spinner';
	import type { PullToRefreshState } from '#lib/common/logic/pullToRefresh';
	import { formatAlertTime, type AlertItem } from '../../logic/alert.svelte';
	import MbAlertHeader from './MbAlertHeader.svelte';

	interface Props {
		items: readonly AlertItem[];
		loading: boolean;
		loadingMore: boolean;
		hasNext: boolean;
		unreadCount: number;
		errorMessage: string | null;
		ptrState?: PullToRefreshState;
		scrollEl?: HTMLDivElement | null;
		onClose?: () => void;
		onItemClick: (item: AlertItem) => void;
		onMarkAllRead: () => void;
		onLoadMore: () => void;
	}

	let {
		items,
		loading,
		loadingMore,
		hasNext,
		unreadCount,
		errorMessage,
		ptrState,
		scrollEl = $bindable(null),
		onClose,
		onItemClick,
		onMarkAllRead,
		onLoadMore
	}: Props = $props();
</script>

<!-- 모바일 우측 알림 패널 뷰 (순수 렌더링) -->
<section class="mb-alert-page" aria-label="알림">
	<MbAlertHeader {onClose} />

	{#if ptrState}
		<PullToRefreshIndicator
			pullPx={ptrState.pullPx}
			progress={ptrState.progress}
			ready={ptrState.ready}
			refreshing={ptrState.refreshing}
			position="absolute"
			top="calc(62px + env(safe-area-inset-top, 0px))"
		/>
	{/if}

	<div bind:this={scrollEl} class="mb-alert-body">
		{#if unreadCount > 0}
			<div class="mb-alert-toolbar">
				<span class="unread-meta">읽지 않음 {unreadCount}</span>
				<button type="button" class="mark-all-btn" onclick={onMarkAllRead}>모두 읽음</button>
			</div>
		{/if}

		{#if loading && items.length === 0}
			<div class="alert-skeleton-list" role="status" aria-busy="true">
				{#each [0, 1, 2, 3] as idx (idx)}
					<div class="alert-skeleton-card skeleton-shimmer" style:--skeleton-delay="{idx * 65}ms"></div>
				{/each}
			</div>
		{:else if errorMessage && items.length === 0}
			<div class="empty-state" role="alert">
				<p>{errorMessage}</p>
			</div>
		{:else if items.length === 0}
			<div class="empty-state">
				<p>새로운 알림이 없습니다.</p>
			</div>
		{:else}
			<ul class="alert-list">
				{#each items as item (item.id)}
					<li>
						<button
							type="button"
							class="alert-card"
							class:is-unread={!item.isRead}
							onclick={() => onItemClick(item)}
						>
							<div class="alert-card-row">
								{#if !item.isRead}
									<span class="unread-dot" aria-label="읽지 않음"></span>
								{/if}
								<p class="alert-msg">{item.message}</p>
							</div>
							<span class="alert-time">{formatAlertTime(item.createdAt)}</span>
						</button>
					</li>
				{/each}
			</ul>

			{#if hasNext}
				<div class="load-more-wrap">
					{#if loadingMore}
						<PulseDotsSpinner size={24} />
					{:else}
						<button type="button" class="load-more-btn" onclick={onLoadMore}>더 보기</button>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</section>

<style>
	.mb-alert-page {
		position: relative;
		width: 100%;
		height: 100%;
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: var(--fg);
	}

	.mb-alert-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1rem var(--content-padding-x-mobile) 2rem;
	}

	.mb-alert-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.unread-meta {
		font-size: 0.8rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.mark-all-btn {
		border: none;
		background: transparent;
		padding: 0.25rem 0.4rem;
		color: var(--fg);
		font: inherit;
		font-size: 0.8rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.alert-skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.alert-skeleton-card {
		height: 74px;
		border-radius: 14px;
	}

	.empty-state {
		min-height: 50dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		font-size: 0.92rem;
	}

	.empty-state p {
		margin: 0;
	}

	.alert-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.alert-card {
		width: 100%;
		padding: 0.9rem 1rem;
		border-radius: 14px;
		border: var(--thin-border);
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		cursor: pointer;
		transition: background-color 0.16s ease;
	}

	.alert-card.is-unread {
		background: var(--surface-3);
	}

	.alert-card:active {
		background: var(--surface-2);
	}

	.alert-card-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.unread-dot {
		width: 7px;
		height: 7px;
		margin-top: 0.42rem;
		border-radius: 999px;
		background: var(--white);
		flex-shrink: 0;
	}

	.alert-msg {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--white-2);
		word-break: keep-all;
	}

	.alert-time {
		font-size: 0.76rem;
		color: var(--muted);
	}

	.load-more-wrap {
		margin-top: 1.25rem;
		display: flex;
		justify-content: center;
	}

	.load-more-btn {
		height: 38px;
		padding: 0 1.1rem;
		border: var(--thin-border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}
</style>
