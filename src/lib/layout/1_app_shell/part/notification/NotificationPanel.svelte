<script lang="ts">
	import { NotificationController } from './logic/notification.svelte';
	import MbNotificationHeader from './design/MbNotificationHeader.svelte';

	interface Props {
		onClose?: () => void;
	}

	let { onClose }: Props = $props();

	const ctrl = new NotificationController();
</script>

<!-- 모바일 우측 알림 전용 페이지 -->
<section class="mb-notification-page" aria-label="알림">
	<MbNotificationHeader {onClose} />

	<div class="mb-notification-body">
		{#if ctrl.items.length === 0}
			<div class="empty-state">
				<p>새로운 알림이 없습니다.</p>
			</div>
		{:else}
			<ul class="notification-list">
				{#each ctrl.items as item (item.id)}
					<li class="notification-item" class:is-unread={!item.read}>
						<strong>{item.title}</strong>
						<p>{item.body}</p>
						<span>{item.createdAt}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

<style>
	.mb-notification-page {
		width: 100%;
		height: 100dvh;
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: var(--fg);
	}

	.mb-notification-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1.25rem var(--content-padding-x-mobile);
	}

	.empty-state {
		min-height: 50dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		font-size: 0.92rem;
	}

	.notification-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.notification-item {
		padding: 0.9rem 1rem;
		border-radius: 14px;
		background: var(--surface);
		border: var(--thin-border);
	}
</style>
