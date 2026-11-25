<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { auth } from '#lib/auth';
	import { ChatBotController } from './logic/chatBot.svelte';
	import { DEFAULT_CHAT_API_URL } from './logic/chatStream';
	import Bot, { type BotState } from './design/Bot.svelte';
	import ChatMessages from './design/ChatMessages.svelte';
	import PcChatHeader from './design/PcChatHeader.svelte';
	import MbChatHeader from './design/MbChatHeader.svelte';
	import PcChatInput from './design/PcChatInput.svelte';
	import MbChatInput from './design/MbChatInput.svelte';

	export type { MediaCategory, ChatAttachment, ChatMessage } from './logic/types';

	interface Props {
		/** 채팅창 열림 여부 (양방향 바인딩 가능) */
		open?: boolean;
		/** 봇의 현재 상태 연동 (thinking, talking 등 자동 반영) */
		botState?: BotState;
		/** true면 모바일 MbShellStage 좌측 패널 전용으로 렌더링 */
		embedded?: boolean;
		/** 닫기 이벤트 핸들러 */
		onClose?: () => void;
		/** AI 챗봇 백엔드 스트리밍 엔드포인트 URL */
		apiUrl?: string;
		/** 봇 이름 */
		botName?: string;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		open = $bindable(false),
		botState = $bindable<BotState>('idle'),
		embedded = false,
		onClose,
		apiUrl = DEFAULT_CHAT_API_URL,
		botName = '딘디',
		class: className = ''
	}: Props = $props();

	const BOT_HOME_SIZE = 80;
	const BOT_DOCK_SIZE = 56;
	const BOT_SCALE_RATIO = BOT_DOCK_SIZE / BOT_HOME_SIZE;

	let botRef: { wink?: (side: 'left' | 'right') => void } | null = $state(null);
	let panelEl: HTMLDivElement | null = $state(null);
	let homeAnchorEl: HTMLDivElement | null = $state(null);
	let messageContainerEl: HTMLDivElement | null = $state(null);
	let chatInputEl: HTMLInputElement | undefined = $state(undefined);
	let botFlyTransform = $state('translate3d(0, 0, 0) scale(1)');

	async function scrollToBottom(smooth = true) {
		await tick();
		if (messageContainerEl) {
			messageContainerEl.scrollTo({
				top: messageContainerEl.scrollHeight + 99999,
				behavior: smooth ? 'smooth' : 'auto'
			});
			requestAnimationFrame(() => {
				if (messageContainerEl) {
					messageContainerEl.scrollTop = messageContainerEl.scrollHeight;
				}
			});
		}
	}

	const ctrl = new ChatBotController(untrack(() => apiUrl), {
		onScrollToBottom: scrollToBottom,
		onBotStateChange: (next) => {
			botState = next;
		}
	});

	$effect(() => {
		ctrl.setApiUrl(apiUrl);
	});

	function updatePcBotPosition() {
		if (embedded) return;
		if (!open) {
			botFlyTransform = 'translate3d(0, 0, 0) scale(1)';
			return;
		}
		const panelW = panelEl?.offsetWidth || 390;
		const panelH = panelEl?.offsetHeight || 610;
		const dx = 44 - (panelW - 40);
		const dy = 40 - (panelH - 40);
		botFlyTransform = `translate3d(${dx}px, ${dy}px, 0) scale(${BOT_SCALE_RATIO})`;
	}

	$effect(() => {
		void open;
		void embedded;
		if (!embedded) {
			tick().then(updatePcBotPosition);
		}
	});

	$effect(() => {
		if (open && !ctrl.hasInitiatedGreeting && !ctrl.isServiceUnavailable) {
			untrack(() => {
				void ctrl.loadChatHistory(true);
			});
		}
	});

	let prevAuthToken = untrack(() => auth.token);
	$effect(() => {
		const token = auth.token;
		if (token && token !== prevAuthToken) {
			prevAuthToken = token;
			if (untrack(() => ctrl.isServiceUnavailable)) {
				untrack(() => {
					void ctrl.loadChatHistory(open);
				});
			}
		} else if (!token) {
			prevAuthToken = null;
		}
	});

	$effect(() => {
		if (open && ctrl.messages.length > 0) {
			void scrollToBottom(false);
			const t1 = setTimeout(() => void scrollToBottom(false), 80);
			const t2 = setTimeout(() => void scrollToBottom(false), 260);
			const t3 = setTimeout(() => void scrollToBottom(false), 540);
			return () => {
				clearTimeout(t1);
				clearTimeout(t2);
				clearTimeout(t3);
			};
		}
	});

	onMount(() => {
		updatePcBotPosition();
		const handleResize = () => updatePcBotPosition();
		window.addEventListener('resize', handleResize);
		void ctrl.loadChatHistory(open);

		return () => {
			window.removeEventListener('resize', handleResize);
			ctrl.cleanup();
		};
	});

	export async function clearChatHistory(): Promise<boolean> {
		return ctrl.clearChatHistory(open);
	}

	export function triggerReaction() {
		ctrl.triggerHappy(1000);
	}

	export function openChat() {
		if (!open) {
			handlePcBotClick();
		}
	}

	function handlePcBotClick() {
		if (ctrl.isServiceUnavailable) {
			if (!open) {
				open = true;
				void scrollToBottom(false);
			}
			return;
		}

		if (!open) {
			open = true;
			botRef?.wink?.('right');
			ctrl.triggerHappy(1000);
			void scrollToBottom(false);
			setTimeout(() => void scrollToBottom(false), 120);
			setTimeout(() => void scrollToBottom(false), 450);
		} else {
			botRef?.wink?.('left');
			ctrl.triggerHappy(1000);
		}
	}

	async function handleSend(keepFocus = false) {
		const sent = await ctrl.sendMessage();
		if (sent && keepFocus) {
			await tick();
			chatInputEl?.focus();
			requestAnimationFrame(() => {
				chatInputEl?.focus();
			});
		}
	}

	function handleClose() {
		open = false;
		onClose?.();
	}
</script>

{#if embedded}
	<!-- 모바일 MbShellStage 좌측 패널 전용 (자체 MbChatHeader + 채팅 + MbChatInput 소유) -->
	<section class="embedded-chat-root {className}" aria-label="{botName} 대화창">
		<MbChatHeader {botName} onClose={handleClose} />

		<div class="embedded-chat-stage">
			<ChatMessages
				bind:containerEl={messageContainerEl}
				messages={ctrl.messages}
				hasTruncatedNotice={ctrl.hasTruncatedNotice}
				isGenerating={ctrl.isGenerating}
				currentStatus={ctrl.currentStatus}
				animatedDots={ctrl.animatedDots}
				isServiceUnavailable={ctrl.isServiceUnavailable}
				serviceErrorStatus={ctrl.serviceErrorStatus}
				hasAttachments={ctrl.attachedFiles.length > 0}
				onAction={ctrl.handleActionClick}
			/>

			{#if !ctrl.isServiceUnavailable}
				<MbChatInput
					value={ctrl.inputText}
					attachedFiles={ctrl.attachedFiles}
					canSubmit={ctrl.canSubmit}
					maxLength={ctrl.maxLength}
					bind:inputEl={chatInputEl}
					onChangeValue={ctrl.setInputText}
					onAddFiles={ctrl.addFiles}
					onRemoveAttachment={ctrl.removeAttachment}
					onSend={handleSend}
					onClose={handleClose}
				/>
			{/if}
		</div>
	</section>
{:else}
	<!-- PC 우측 하단 플로팅 + 정원→사각형 모핑 패널 모드 -->
	<div class="bot-area-root {className}" class:is-open={open}>
		<div
			bind:this={panelEl}
			class="morph-chat-panel"
			class:is-open={open}
			data-fd-barrier
			role="dialog"
			aria-label="{botName} 대화창"
			aria-modal="true"
		>
			<div class="panel-inner-content" class:visible={open}>
				<PcChatHeader {botName} onClose={handleClose} />

				<ChatMessages
					bind:containerEl={messageContainerEl}
					messages={ctrl.messages}
					hasTruncatedNotice={ctrl.hasTruncatedNotice}
					isGenerating={ctrl.isGenerating}
					currentStatus={ctrl.currentStatus}
					animatedDots={ctrl.animatedDots}
					isServiceUnavailable={ctrl.isServiceUnavailable}
					serviceErrorStatus={ctrl.serviceErrorStatus}
					hasAttachments={ctrl.attachedFiles.length > 0}
					onAction={ctrl.handleActionClick}
				/>

				{#if !ctrl.isServiceUnavailable}
					<PcChatInput
						value={ctrl.inputText}
						attachedFiles={ctrl.attachedFiles}
						canSubmit={ctrl.canSubmit}
						maxLength={ctrl.maxLength}
						bind:inputEl={chatInputEl}
						onChangeValue={ctrl.setInputText}
						onAddFiles={ctrl.addFiles}
						onRemoveAttachment={ctrl.removeAttachment}
						onSend={handleSend}
						onClose={handleClose}
					/>
				{/if}
			</div>
		</div>

		<div bind:this={homeAnchorEl} class="bot-home-anchor" aria-hidden="true"></div>

		<div
			class="flying-bot-actor"
			class:is-docked={open}
			style="transform: {botFlyTransform};"
		>
			<button
				type="button"
				class="bot-trigger-button"
				data-fd-barrier
				onclick={handlePcBotClick}
				aria-label={open ? 'AI 봇 표정 반응 보기' : 'AI 봇과 대화창 열기'}
			>
				<Bot
					bind:this={botRef}
					state={ctrl.isServiceUnavailable ? 'sleepy' : ctrl.botState}
					size={BOT_HOME_SIZE}
					disableHoverWave={open || ctrl.isServiceUnavailable}
					activeWave={!ctrl.isServiceUnavailable &&
						(ctrl.isGenerating || ctrl.botState === 'thinking' || ctrl.botState === 'talking')}
				/>
			</button>
		</div>
	</div>
{/if}

<style>
	.embedded-chat-root {
		position: relative;
		width: 100%;
		height: 100dvh;
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		overflow: hidden;
	}

	.embedded-chat-stage {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* MbChatHeader가 별도 높이를 가지므로 embedded 모드에서는 상단 과도한 패딩 보정 */
	.embedded-chat-stage :global(.chat-messages-area) {
		padding-top: 1rem;
	}

	.bot-area-root {
		position: fixed;
		right: var(--bot-area-gap);
		bottom: var(--bot-area-gap);
		z-index: 48;
		pointer-events: none;
	}

	.morph-chat-panel {
		position: fixed;
		top: calc(var(--pc-header-height, 70px) + var(--bot-area-gap));
		right: var(--bot-area-gap);
		bottom: var(--bot-area-gap);
		width: clamp(340px, 92vw, 410px);
		height: auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--glass-bg);
		-webkit-backdrop-filter: var(--glass-filter);
		backdrop-filter: var(--glass-filter);
		border: var(--detail-frame-border);
		border-radius: var(--bot-area-radius);
		overflow: hidden;
		z-index: 47;
		color: #f1f5f9;
		user-select: text;
		clip-path: inset(calc(100% - 80px) 0px 0px calc(100% - 80px) round 40px);
		opacity: 0;
		pointer-events: none;
		transition:
			clip-path 0.46s cubic-bezier(0.32, 0.72, 0, 1),
			opacity 0.2s ease 0.26s,
			box-shadow 0.35s ease;
		will-change: clip-path, opacity;
	}

	.morph-chat-panel.is-open {
		clip-path: inset(0px 0px 0px 0px round var(--bot-area-radius));
		opacity: 1;
		pointer-events: auto;
		transition:
			clip-path 0.52s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.22s ease 0s,
			box-shadow 0.4s ease;
	}

	.panel-inner-content {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.18s ease;
	}

	.panel-inner-content.visible {
		opacity: 1;
		pointer-events: auto;
		transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.22s;
	}

	.bot-home-anchor {
		width: 80px;
		height: 80px;
		pointer-events: none;
	}

	.flying-bot-actor {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		z-index: 60;
		transform-origin: center center;
		transition: transform 0.46s cubic-bezier(0.32, 0.72, 0, 1);
		will-change: transform;
	}

	.flying-bot-actor.is-docked {
		transition: transform 0.52s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.bot-trigger-button {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		outline: none;
		pointer-events: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		overflow: visible;
		transition:
			transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
			filter 0.22s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.bot-trigger-button :global(.bot-container) {
		pointer-events: none;
		flex-shrink: 0;
	}

	.bot-trigger-button:hover {
		transform: scale(1.08);
	}

	.bot-trigger-button:active {
		transform: scale(0.95);
	}
</style>
