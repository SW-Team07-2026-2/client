<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ChatActionPayload } from '../logic/chatStream';
	import type { ChatMessage } from '../logic/types';
	import UserBubble from './UserBubble.svelte';
	import BotMessage from './BotMessage.svelte';
	import AiThinkingLoader from './AiThinkingLoader.svelte';

	interface Props {
		messages: ChatMessage[];
		hasTruncatedNotice?: boolean;
		isGenerating?: boolean;
		currentStatus?: string | null;
		animatedDots?: string;
		isServiceUnavailable?: boolean;
		serviceErrorStatus?: number | null;
		hasAttachments?: boolean;
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
		containerEl = $bindable(null),
		onAction
	}: Props = $props();

	/** 상태 문구 끝의 기존 온점(.)을 제거하여 동적 점(. -> .. -> ...)과 중복되지 않도록 함 */
	function cleanStatusText(text: string): string {
		return text.replace(/\.+$/, '').trim();
	}
</script>

<!-- 메시지 스크롤 영역 (AI는 말풍선 박스 없이 마크다운, 유저는 둥근 연회색 캡슐) -->
<div
	bind:this={containerEl}
	class="chat-messages-area"
	class:has-attachments={hasAttachments && !isServiceUnavailable}
	class:is-unavailable={isServiceUnavailable}
>
	{#if isServiceUnavailable}
		<div class="service-unavailable-state" in:fade={{ duration: 150 }}>
			<div class="service-unavailable-body">
				<p class="service-unavailable-text">
					딘디에게 문제가 생겼어요...<br />나중에 다시 시도해 주세요
				</p>
				{#if serviceErrorStatus !== null}
					<span class="service-unavailable-code">{serviceErrorStatus}</span>
				{/if}
			</div>
		</div>
	{:else}
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

	{#if isGenerating}
		<!-- 생각 중 로딩 펄스 & 백엔드 도구 호출 상태 안내 -->
		<div class="bot-ambient-message generating" in:fade={{ duration: 150 }}>
			<div class="thinking-status-row">
				<AiThinkingLoader size={20} label="답변 생성 중" />
				{#if currentStatus}
					<span class="thinking-status-text" in:fade={{ duration: 150 }}>
						{cleanStatusText(currentStatus)}<span class="animated-dots">{animatedDots}</span>
					</span>
				{/if}
			</div>
		</div>
	{/if}
	{/if}
</div>

<style>
	/* 메시지 리스트 영역: 상/하단 그라데이션 마스크 적용 */
	.chat-messages-area {
		flex: 1;
		overflow-y: auto;
		padding: 100px 1.25rem 115px 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		overscroll-behavior: contain;
		transition: padding-bottom 0.22s ease;

		mask-image: linear-gradient(
			to bottom,
			transparent 0px,
			transparent 65px,
			rgba(0, 0, 0, 0.35) 90px,
			black 120px,
			black calc(100% - 130px),
			rgba(0, 0, 0, 0.4) calc(100% - 60px),
			transparent calc(100% - 10px)
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0px,
			transparent 65px,
			rgba(0, 0, 0, 0.35) 90px,
			black 120px,
			black calc(100% - 130px),
			rgba(0, 0, 0, 0.4) calc(100% - 60px),
			transparent calc(100% - 10px)
		);
	}

	.chat-messages-area.is-unavailable {
		padding: 72px 1.5rem 40px;
		overflow-y: hidden;
		justify-content: center;
		align-items: center;
		mask-image: none;
		-webkit-mask-image: none;
	}

	.chat-messages-area.has-attachments {
		padding-bottom: 185px;
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
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
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

	/* AI 서비스 일시 장애 중앙 안내 문구 (블록/버튼 없이 텍스트만 정중앙 배치) */
	.service-unavailable-state {
		width: 100%;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.service-unavailable-body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}

	.service-unavailable-text {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.65;
		color: var(--muted, #acabad);
		letter-spacing: -0.015em;
		word-break: keep-all;
	}

	.service-unavailable-code {
		font-size: 0.72rem;
		line-height: 1;
		color: var(--muted, #acabad);
		opacity: 0.6;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}
</style>

