<script lang="ts">
	import DetailTopNav from '#lib/common/design/DetailTopNav.svelte';
	import { PulseDotsSpinner } from '#lib/common/design/icon/spinner';
	import { formatAlertTime, type AlertItem } from '../../logic/alert.svelte';

	interface Props {
		items: readonly AlertItem[];
		loading: boolean;
		loadingMore: boolean;
		hasNext: boolean;
		unreadCount: number;
		errorMessage: string | null;
		onBack: () => void;
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
		onBack,
		onItemClick,
		onMarkAllRead,
		onLoadMore
	}: Props = $props();
</script>

<!-- PC 전용 /alert 상단 열림 페이지 뷰 (순수 렌더링) -->
<div class="pc-alert-page">
	<div class="pc-alert-container">
		<DetailTopNav mobile={false} backLabel="이전" returnToPage={false} {onBack} />

		<header class="pc-alert-header">
			<div class="pc-alert-title-group">
				<h1 class="pc-alert-title">알림함</h1>
				{#if unreadCount > 0}
					<span class="pc-unread-pill">{unreadCount}</span>
				{/if}
			</div>

			{#if unreadCount > 0}
				<button type="button" class="pc-mark-all-btn" onclick={onMarkAllRead}>
					모두 읽음 처리
				</button>
			{/if}
		</header>

		{#if loading && items.length === 0}
			<div class="pc-alert-skeletons" role="status" aria-busy="true">
				{#each [0, 1, 2, 3, 4] as idx (idx)}
					<div class="pc-alert-skeleton skeleton-shimmer" style:--skeleton-delay="{idx * 65}ms"></div>
				{/each}
			</div>
		{:else if errorMessage && items.length === 0}
			<div class="pc-alert-empty" role="alert">
				<p>{errorMessage}</p>
			</div>
		{:else if items.length === 0}
			<div class="pc-alert-empty">
				<p>새로운 알림이 없습니다.</p>
			</div>
		{:else}
			<ul class="pc-alert-list">
				{#each items as item (item.id)}
					<li>
						<button
							type="button"
							class="pc-alert-card"
							class:is-unread={!item.isRead}
							onclick={() => onItemClick(item)}
						>
							<div class="pc-alert-card-main">
								{#if !item.isRead}
									<span class="pc-unread-dot" aria-label="읽지 않음"></span>
								{/if}
								<p class="pc-alert-msg">{item.message}</p>
							</div>
							<span class="pc-alert-time">{formatAlertTime(item.createdAt)}</span>
						</button>
					</li>
				{/each}
			</ul>

			{#if hasNext}
				<div class="pc-load-more">
					{#if loadingMore}
						<PulseDotsSpinner size={24} />
					{:else}
						<button type="button" class="pc-load-more-btn" onclick={onLoadMore}>
							이전 알림 더 보기
						</button>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.pc-alert-page {
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		background: var(--bg);
		color: var(--fg);
		animation: pc-alert-drop-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes pc-alert-drop-in {
		from {
			opacity: 0;
			transform: translate3d(0, -18px, 0);
		}
		to {
			opacity: 1;
			transform: translate3d(0, 0, 0);
		}
	}

	.pc-alert-container {
		width: 100%;
		max-width: 780px;
		margin: 0 auto;
		padding: 1.5rem var(--content-padding-x) 4.5rem;
		box-sizing: border-box;
	}

	.pc-alert-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.pc-alert-title-group {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
	}

	.pc-alert-title {
		margin: 0;
		font-size: 1.8rem;
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		color: var(--white);
	}

	.pc-unread-pill {
		padding: 0.16rem 0.55rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--white);
		font-size: 0.78rem;
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
	}

	.pc-mark-all-btn {
		height: 34px;
		padding: 0 0.85rem;
		border: var(--thin-border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.82rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			color 0.16s ease;
	}

	.pc-mark-all-btn:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.pc-alert-skeletons {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.pc-alert-skeleton {
		height: 76px;
		border-radius: 16px;
	}

	.pc-alert-empty {
		min-height: 320px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		font-size: 0.94rem;
	}

	.pc-alert-empty p {
		margin: 0;
	}

	.pc-alert-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.pc-alert-card {
		width: 100%;
		padding: 1.05rem 1.2rem;
		border-radius: 16px;
		border: var(--thin-border);
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		text-align: left;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			transform 0.14s ease;
	}

	.pc-alert-card.is-unread {
		background: var(--surface-3);
	}

	.pc-alert-card:hover {
		background: var(--surface-2);
	}

	.pc-alert-card-main {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		min-width: 0;
		flex: 1;
	}

	.pc-unread-dot {
		width: 7px;
		height: 7px;
		margin-top: 0.45rem;
		border-radius: 999px;
		background: var(--white);
		flex-shrink: 0;
	}

	.pc-alert-msg {
		margin: 0;
		font-size: 0.94rem;
		line-height: 1.48;
		color: var(--white-2);
		word-break: keep-all;
	}

	.pc-alert-time {
		flex-shrink: 0;
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.pc-load-more {
		margin-top: 1.5rem;
		display: flex;
		justify-content: center;
	}

	.pc-load-more-btn {
		height: 40px;
		padding: 0 1.25rem;
		border: var(--thin-border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.86rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background-color 0.16s ease;
	}

	.pc-load-more-btn:hover {
		background: var(--surface-2);
	}

	@media (prefers-reduced-motion: reduce) {
		.pc-alert-page {
			animation: none;
		}
	}
</style>
