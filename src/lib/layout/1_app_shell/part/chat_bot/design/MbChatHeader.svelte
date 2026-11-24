<script lang="ts">
	interface Props {
		botName: string;
		onClose?: () => void;
	}

	let { botName, onClose }: Props = $props();
</script>

<!-- 모바일 채팅 전용 상단 헤더 (좌측은 단일 Bot 액터 도착 도크 슬롯, 순수 렌더링) -->
<header class="mb-chat-header">
	<div class="mb-chat-bot-slot" data-shell-anchor="left-to" aria-hidden="true"></div>

	<div class="bot-header-info">
		<span class="bot-title">{botName}</span>
	</div>

	<button type="button" class="chat-close-btn" onclick={onClose} aria-label="대화창 닫기">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>
	</button>
</header>

<style>
	.mb-chat-header {
		flex-shrink: 0;
		height: 60px;
		padding: 0 var(--content-padding-x-mobile);
		display: flex;
		align-items: center;
		gap: 0.7rem;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
		border-bottom: var(--thin-border);
		z-index: 20;
	}

	.mb-chat-bot-slot {
		width: 34px;
		height: 34px;
		flex-shrink: 0;
	}

	.bot-header-info {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.bot-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--white);
		letter-spacing: -0.01em;
	}

	.chat-close-btn {
		width: 34px;
		height: 34px;
		padding: 0;
		border-radius: 999px;
		background: transparent;
		border: none;
		color: var(--white);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.chat-close-btn:active {
		transform: scale(0.92);
	}

	.chat-close-btn svg {
		width: 22px;
		height: 22px;
	}
</style>
