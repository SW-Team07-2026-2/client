<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ChatActionPayload } from '../logic/chatStream';
	import type { ChatMessage } from '../logic/types';
	import MarkdownViewer from '#lib/common/design/MarkdownViewer.svelte';

	interface Props {
		message: ChatMessage;
		onAction?: (action: ChatActionPayload) => void;
	}

	let { message, onAction }: Props = $props();

	function isBgmAction(action?: ChatActionPayload | null): boolean {
		const name = String(action?.action ?? '').toLowerCase();
		return name === 'stop_bgm' || name === 'start_bgm' || name.includes('bgm');
	}

	const showActionPill = $derived(
		Boolean(message.isDone && message.action && !isBgmAction(message.action))
	);
</script>

<!-- AI 메시지: 말풍선 박스 없이 투명 글래스 바탕 위에 마크다운 -->
<div class="bot-ambient-message">
	<MarkdownViewer content={message.text} />

	{#if showActionPill && message.action}
		<div class="bot-action-wrap" in:fade={{ duration: 150 }}>
			<button
				type="button"
				class="bot-action-pill"
				onclick={() => onAction?.(message.action!)}
			>
				<span>✨ {message.action.label || '확인하기'}</span>
			</button>
		</div>
	{/if}

	{#if message.isDone && message.time}
		<span class="bot-time">{message.time}</span>
	{/if}
</div>

<style>
	.bot-ambient-message {
		width: 100%;
		max-width: 100%;
		background: transparent;
		border: none;
		padding: 0 0.15rem;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bot-time {
		font-size: 0.6875rem;
		color: rgba(255, 255, 255, 0.45);
		margin-top: 4px;
	}

	.bot-action-wrap {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.6rem;
		margin-bottom: 0.2rem;
	}

	.bot-action-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.45rem 0.95rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 9999px;
		color: #ffffff;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
			transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.bot-action-pill:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.5);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
</style>

