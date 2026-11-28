<script lang="ts">
	import { RefreshCcwIcon } from '#lib/common/design/icon';

	interface Props {
		botName: string;
		showRefresh?: boolean;
		onRefresh?: () => void;
		onClose?: () => void;
	}

	let { botName, showRefresh = false, onRefresh, onClose }: Props = $props();
	let refreshHovered = $state(false);
	let refreshIconRef = $state<{ rotate?: () => void } | null>(null);

	function handleRefreshClick() {
		refreshIconRef?.rotate?.();
		onRefresh?.();
	}
</script>

<!-- PC 채팅 영역 상단 헤더 (순수 렌더링) -->
<header class="pc-chat-header">
	<!-- 날아온 봇이 안착하는 56px 도크 자리 확보 -->
	<div class="bot-dock-slot" aria-hidden="true"></div>

	<div class="bot-header-info">
		<span class="bot-title">{botName}</span>
	</div>

	<div class="header-actions">
		{#if showRefresh}
			<button
				type="button"
				class="chat-action-btn"
				onclick={handleRefreshClick}
				onpointerenter={() => (refreshHovered = true)}
				onpointerleave={() => (refreshHovered = false)}
				aria-label="대화 새로고침"
				title="새로고침"
			>
				<RefreshCcwIcon bind:this={refreshIconRef} size={16} strokeWidth={2} hovered={refreshHovered} />
			</button>
		{/if}

		<button type="button" class="chat-action-btn" onclick={onClose} aria-label="대화창 닫기">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>
</header>

<style>
	.pc-chat-header {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		padding: 0.85rem 1.15rem;
		background: transparent;
		border: none;
		gap: 0.85rem;
		flex-shrink: 0;
		z-index: 20;
		pointer-events: none;
	}

	.bot-dock-slot {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
	}

	.bot-header-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
	}

	.bot-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--white, #ffffff);
		letter-spacing: -0.01em;
	}

	.header-actions {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.chat-action-btn {
		pointer-events: auto;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: transparent;
		border: none;
		color: var(--muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			transform 0.15s ease;
	}

	.chat-action-btn:hover {
		background: color-mix(in srgb, var(--white) 10%, transparent);
		color: var(--white);
		transform: scale(1.05);
	}

	.chat-action-btn svg {
		width: 18px;
		height: 18px;
	}
</style>
