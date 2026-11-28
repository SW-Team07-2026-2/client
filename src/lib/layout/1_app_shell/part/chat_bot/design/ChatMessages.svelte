<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ChatActionPayload } from '../logic/chatStream';
	import type { ChatMessage } from '../logic/types';
	import UserBubble from './UserBubble.svelte';
	import BotMessage from './BotMessage.svelte';
	import { ThreeBodySpinner } from '#lib/common/design/icon/spinner';

	interface Props {
		messages: ChatMessage[];
		hasTruncatedNotice?: boolean;
		isGenerating?: boolean;
		currentStatus?: string | null;
		animatedDots?: string;
		isServiceUnavailable?: boolean;
		serviceErrorStatus?: number | null;
		hasAttachments?: boolean;
		bottomInset?: number;
		disableTopFade?: boolean;
		isRefreshing?: boolean;
		containerEl?: HTMLDivElement | null;
		onAction?: (action: ChatActionPayload) => void;
	}

	let {
		messages,
		hasTruncatedNotice = false,
		isGenerating = false,
		currentStatus = null,
		animatedDots = '.',
		isServiceUnavailable = false,
		serviceErrorStatus = null,
		hasAttachments = false,
		bottomInset = 112,
		disableTopFade = false,
		isRefreshing = false,
		containerEl = $bindable(null),
		onAction
	}: Props = $props();

	/** 상태 문구 끝의 기존 온점(.)을 제거하여 동적 점(. -> .. -> ...)과 중복되지 않도록 함 */
	function cleanStatusText(text: string): string {
		return text.replace(/\.+$/, '').trim();
	}

	const activeBotShowsSteps = $derived.by(() => {
		const last = messages[messages.length - 1];
		return Boolean(last && last.role === 'bot' && !last.isDone && last.showSteps && last.steps?.length);
	});
</script>

<!-- 메시지 스크롤 영역 (AI는 말풍선 박스 없이 마크다운, 유저는 둥근 연회색 캡슐) -->
<div
	bind:this={containerEl}
	class="chat-messages-area"
	class:has-attachments={hasAttachments}
	class:no-top-fade={disableTopFade}
	class:is-refreshing={isRefreshing}
	style:--chat-bottom-inset="{bottomInset}px"
>
	{#if hasTruncatedNotice}
		<div class="truncated-history-notice" in:fade={{ duration: 150 }}>
			<span class="notice-text">최근 대화는 최대 20개까지 확인할 수 있습니다.</span>
		</div>
	{/if}

	{#each messages as msg (msg.id)}
		<div class="message-row {msg.role}">
			{#if msg.role === 'user'}
				<UserBubble message={msg} />
			{:else if msg.role === 'bot'}
				<BotMessage message={msg} {onAction} />
			{/if}
		</div>
	{/each}

	{#if isGenerating && !activeBotShowsSteps}
		<!-- 생각 중 로딩 펄스 & 백엔드 도구 호출 상태 안내 -->
		<div class="bot-ambient-message generating" in:fade={{ duration: 150 }}>
			<div class="thinking-status-row">
				<ThreeBodySpinner size={20} label="답변 생성 중" />
				{#if currentStatus}
					<span class="thinking-status-text" in:fade={{ duration: 150 }}>
						{cleanStatusText(currentStatus)}<span class="animated-dots">{animatedDots}</span>
					</span>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* 메시지 리스트 영역: 상/하단 그라데이션 마스크 적용 */
	.chat-messages-area {
		flex: 1;
		overflow-y: auto;
		padding: 100px 1.25rem calc(var(--chat-bottom-inset, 112px) + 22px) 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		overscroll-behavior: contain;
		opacity: 1;
		transition: opacity 0.16s ease;

		mask-image: linear-gradient(
			to bottom,
			transparent 0px,
			transparent 64px,
			rgba(0, 0, 0, 0.5) 82px,
			black 96px,
			black calc(100% - var(--chat-bottom-inset, 112px) - 18px),
			rgba(0, 0, 0, 0.35) calc(100% - var(--chat-bottom-inset, 112px) + 28px),
			transparent calc(100% - 10px)
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0px,
			transparent 64px,
			rgba(0, 0, 0, 0.5) 82px,
			black 96px,
			black calc(100% - var(--chat-bottom-inset, 112px) - 18px),
			rgba(0, 0, 0, 0.35) calc(100% - var(--chat-bottom-inset, 112px) + 28px),
			transparent calc(100% - 10px)
		);
	}

	.chat-messages-area.no-top-fade {
		mask-image: linear-gradient(
			to bottom,
			black 0px,
			black calc(100% - var(--chat-bottom-inset, 112px) - 18px),
			rgba(0, 0, 0, 0.35) calc(100% - var(--chat-bottom-inset, 112px) + 28px),
			transparent calc(100% - 10px)
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			black 0px,
			black calc(100% - var(--chat-bottom-inset, 112px) - 18px),
			rgba(0, 0, 0, 0.35) calc(100% - var(--chat-bottom-inset, 112px) + 28px),
			transparent calc(100% - 10px)
		);
	}

	.chat-messages-area.is-refreshing {
		opacity: 0.28;
	}

	.chat-messages-area::-webkit-scrollbar {
		width: 4px;
	}

	.chat-messages-area::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.12);
		border-radius: 4px;
	}

	.message-row {
		display: flex;
		width: 100%;
	}

	.message-row.user {
		justify-content: flex-end;
	}

	.message-row.bot {
		justify-content: flex-start;
	}

	/* 단기 기억 20개 초과 시 최상단 안내 문구 */
	.truncated-history-notice {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 14px;
		margin: 0 auto 0.25rem auto;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		color: #a7a7a7;
		font-size: 0.72rem;
		line-height: 1.4;
		text-align: center;
		max-width: 92%;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}

	.truncated-history-notice .notice-text {
		color: #a7a7a7;
		letter-spacing: -0.01em;
	}

	/* 생각 중 상태 및 스피너 */
	.bot-ambient-message.generating {
		width: 100%;
		padding: 0 0.15rem;
		display: flex;
		flex-direction: column;
	}

	.thinking-status-row {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		max-width: 100%;
	}

	.thinking-status-text {
		font-size: 0.8125rem;
		color: #e4e4e7;
		font-style: italic;
		letter-spacing: -0.01em;
		line-height: 1.4;
		animation: status-pulse 2s infinite ease-in-out;
	}

	.animated-dots {
		display: inline-block;
		min-width: 1.25em;
		text-align: left;
		font-style: normal;
	}

	@keyframes status-pulse {
		0%,
		100% {
			opacity: 0.7;
		}
		50% {
			opacity: 1;
		}
	}
</style>

