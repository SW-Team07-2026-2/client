<script lang="ts">
	interface Props {
		botName: string;
		onClose?: () => void;
	}

	let { botName, onClose }: Props = $props();
</script>

<!-- PC 채팅 영역 상단 헤더 (순수 렌더링) -->
<header class="pc-chat-header">
	<!-- 날아온 봇이 안착하는 56px 도크 자리 확보 -->
	<div class="bot-dock-slot" aria-hidden="true"></div>

	<div class="bot-header-info">
		<span class="bot-title">{botName}</span>
	</div>

	<button type="button" class="chat-close-btn" onclick={onClose} aria-label="대화창 닫기">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
		</svg>
	</button>
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

	.chat-close-btn {
		pointer-events: auto;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: transparent;
		border: none;
		color: #b9b9b9;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.chat-close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--white, #ffffff);
		transform: scale(1.05);
	}

	.chat-close-btn svg {
		width: 18px;
		height: 18px;
	}
</style>
