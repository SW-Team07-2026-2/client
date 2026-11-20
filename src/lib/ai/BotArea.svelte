<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import Bot, { type BotState } from './part/Bot.svelte';
	import ChatHeader from './part/ChatHeader.svelte';
	import ChatMessages from './part/ChatMessages.svelte';
	import ChatInput from './part/ChatInput.svelte';
	import {
		streamAIChat,
		fetchChatHistory,
		uploadChatFile,
		DEFAULT_CHAT_API_URL,
		type ChatActionPayload,
		type ChatUploadAttachment
	} from './logic/chatStream';
	import type { ChatAttachment, ChatMessage } from './logic/types';
	import { detectMediaCategoryFromMeta } from './logic/attachment';
	import { auth } from '#lib/auth';
	import { bgm, isMobile as device } from '#lib/stores';

	export type { MediaCategory, ChatAttachment, ChatMessage } from './logic/types';

	interface Props {
		/** 채팅창 열림 여부 (양방향 바인딩 가능) */
		open?: boolean;
		/** 봇의 현재 상태 연동 (thinking, talking 등 자동 반영) */
		botState?: BotState;
		/** 닫기 이벤트 핸들러 */
		onClose?: () => void;
		/** AI 챗봇 백엔드 스트리밍 엔드포인트 URL (기본값: /api/chatbot/chat) */
		apiUrl?: string;
		/** 봇 이름 */
		botName?: string;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		open = $bindable(false),
		botState = $bindable('idle'),
		onClose,
		apiUrl = DEFAULT_CHAT_API_URL,
		botName = '딘디',
		class: className = ''
	}: Props = $props();

	// 봇 크기 상수: 닫혔을 때는 80px, 열렸을 때는 56px(0.70x)로 크고 선명하게 안착!
	const BOT_HOME_SIZE = 80;
	const BOT_DOCK_SIZE = 56;
	const BOT_SCALE_RATIO = BOT_DOCK_SIZE / BOT_HOME_SIZE; // 0.70

	// AI 서비스 장애 시 자동 재연결 시도 간격 (1, 1, 3, 5, 10, 60, 60, ...초)
	const RETRY_DELAYS_MS = [1000, 1000, 3000, 5000, 10000, 60000] as const;

	let botRef: any = $state(null);
	let panelEl: HTMLDivElement | null = $state(null);
	let messageContainerEl: HTMLDivElement | null = $state(null);
	let chatInputEl: HTMLInputElement | undefined = $state(undefined);

	// 봇 비행 위치 transform 상태 (CSS translate3d + scale)
	let botFlyTransform = $state('translate3d(0, 0, 0) scale(1)');

	// 기본 대화 내역
	let messages = $state<ChatMessage[]>([]);
	let hasInitiatedGreeting = $state(false);
	let isHistoryLoaded = $state(false);
	let hasTruncatedNotice = $state(false);
	let isServiceUnavailable = $state(false);
	let isAuthRequired = $state(false);

	let inputText = $state('');
	let attachedFiles = $state<ChatAttachment[]>([]);
	let isGenerating = $state(false);
	let currentStatus = $state<string | null>(null);
	let abortCtrl: AbortController | null = null;
	let isLoadingHistory = false;
	let retryAttempt = 0;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let happyTimer: ReturnType<typeof setTimeout> | null = null;

	// 봇 상태 문구 뒤의 점 개수 순환 (. -> .. -> ... -> .)
	let dotCount = $state(1);
	const animatedDots = $derived('.'.repeat(dotCount));

	$effect(() => {
		if (isGenerating && currentStatus) {
			const timer = setInterval(() => {
				dotCount = (dotCount % 3) + 1;
			}, 400);
			return () => clearInterval(timer);
		} else {
			dotCount = 1;
		}
	});

	// 시간 포맷 헬퍼 (오전/오후 HH:MM)
	function getCurrentTime(): string {
		const now = new Date();
		const hours = now.getHours();
		const minutes = now.getMinutes().toString().padStart(2, '0');
		const period = hours >= 12 ? '오후' : '오전';
		const formattedHours = hours % 12 || 12;
		return `${period} ${formattedHours}:${minutes}`;
	}

	const isMobile = $derived(device.current);

	// 봇 비행 위치 정밀 계산 (우측 하단 홈 <-> 상단 헤더 도크)
	function updateBotPosition() {
		if (!open) {
			botFlyTransform = 'translate3d(0, 0, 0) scale(1)';
			return;
		}

		if (!isMobile) {
			const panelW = panelEl?.offsetWidth || 390;
			const panelH = panelEl?.offsetHeight || 610;
			const dx = 44 - (panelW - 40);
			const dy = 40 - (panelH - 40);
			botFlyTransform = `translate3d(${dx}px, ${dy}px, 0) scale(${BOT_SCALE_RATIO})`;
		} else {
			const vh = window.innerHeight;
			const panelH = vh * 0.85;
			const dx = 44 - (window.innerWidth - 56);
			const dy = vh - panelH + 40 - (vh - 104);
			botFlyTransform = `translate3d(${dx}px, ${dy}px, 0) scale(${BOT_SCALE_RATIO})`;
		}
	}

	$effect(() => {
		void open;
		void isMobile;
		tick().then(updateBotPosition);
	});

	// 챗봇 창이 열렸을 때 대화 기록 및 첫인사 복원 (GET /api/chatbot/chat)
	$effect(() => {
		if (open && !hasInitiatedGreeting && !isAuthRequired && !isServiceUnavailable) {
			untrack(() => {
				loadChatHistory();
			});
		}
	});

	// 로그인 상태가 새로 변경되었을 때만 대화 기록 다시 로드
	let prevAuthToken = untrack(() => auth.token);
	$effect(() => {
		const token = auth.token;
		if (token && token !== prevAuthToken) {
			prevAuthToken = token;
			if (untrack(() => isAuthRequired)) {
				untrack(() => {
					loadChatHistory();
				});
			}
		} else if (!token) {
			prevAuthToken = null;
		}
	});

	// 대화창이 열리거나 대화 목록이 복원/추가될 때 최신 대화(최하단) 위치 보장
	$effect(() => {
		if (open && messages.length > 0) {
			scrollToBottom(false);
			const t1 = setTimeout(() => scrollToBottom(false), 80);
			const t2 = setTimeout(() => scrollToBottom(false), 260);
			const t3 = setTimeout(() => scrollToBottom(false), 540);
			return () => {
				clearTimeout(t1);
				clearTimeout(t2);
				clearTimeout(t3);
			};
		}
	});

	function clearRetryTimer() {
		if (retryTimer) {
			clearTimeout(retryTimer);
			retryTimer = null;
		}
	}

	function clearHappyTimer() {
		if (happyTimer) {
			clearTimeout(happyTimer);
			happyTimer = null;
		}
	}

	function scheduleAutoRetry() {
		if (!isServiceUnavailable || retryTimer) return;
		const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
		retryAttempt += 1;
		retryTimer = setTimeout(() => {
			retryTimer = null;
			if (!isServiceUnavailable) return;
			loadChatHistory();
		}, delay);
	}

	// 서비스 장애 상태에서는 어떤 경우에도 잠자는 표정 유지
	$effect(() => {
		if (isServiceUnavailable && botState !== 'sleepy') {
			botState = 'sleepy';
		}
	});

	function handleServiceError(_errMsg?: string, _errCode?: string) {
		clearHappyTimer();
		if (!isServiceUnavailable) {
			retryAttempt = 0;
		}
		isServiceUnavailable = true;
		botState = 'sleepy';
		isGenerating = false;
		currentStatus = null;
		scheduleAutoRetry();
		scrollToBottom();
	}

	/** 대화 기록 복원 및 첫인사 조회 (GET /api/chatbot/chat) */
	async function loadChatHistory() {
		if (isLoadingHistory) return;
		isLoadingHistory = true;
		try {
			const data = await fetchChatHistory(apiUrl);

			isServiceUnavailable = false;
			isAuthRequired = false;
			clearRetryTimer();
			retryAttempt = 0;
			if (!isGenerating && botState === 'sleepy') {
				botState = 'idle';
			}

			const rawMessages =
				data && Array.isArray((data as any).result?.messages)
					? (data as any).result.messages
					: data && Array.isArray(data.messages)
						? data.messages
						: [];

			if (rawMessages.length > 0 || (data && Array.isArray(data.messages))) {
				messages = rawMessages.map((m: any, mIdx: number) => {
					const rawAttachments = Array.isArray(m.attachments) ? m.attachments : [];
					const normalizedAttachments: ChatAttachment[] = rawAttachments.map(
						(att: any, aIdx: number) => {
							const fileName = att.name || att.file_name || '첨부파일';
							const mediaType = att.type || att.media_type || '';
							const fileUrl = att.url || att.file_uri || '';
							const fileSize = typeof att.size === 'number' ? att.size : 0;
							const media = detectMediaCategoryFromMeta(fileName, mediaType);

							return {
								id: att.id || `hist-att-${m.id || mIdx}-${aIdx}`,
								name: fileName,
								size: fileSize,
								type: mediaType,
								url: fileUrl,
								file_uri: att.file_uri || fileUrl,
								media_type: mediaType,
								category: media.category,
								isImage: media.isImage,
								isAudio: media.isAudio,
								isVideo: media.isVideo,
								isDocument: media.isDocument
							};
						}
					);

					const rawRole = String(m.role || 'bot').toLowerCase();
					const role: 'bot' | 'user' = rawRole === 'user' || rawRole === 'human' ? 'user' : 'bot';

					return {
						id: String(m.id || `hist-msg-${mIdx}`),
						role,
						text: m.text || m.content || '',
						action: m.action || null,
						attachments: normalizedAttachments,
						isDone: true,
						time: m.time || getCurrentTime()
					};
				});
				hasTruncatedNotice = !!data.has_truncated;
				hasInitiatedGreeting = true;
				if (open) {
					scrollToBottom(false);
					setTimeout(() => scrollToBottom(false), 80);
					setTimeout(() => scrollToBottom(false), 280);
				}
			}
		} catch (err: any) {
			console.warn('[BotArea] 대화 기록 조회 실패:', err?.message, err?.code);
			if (err?.code === 'UNAUTHORIZED' || err?.code === 'TOKEN_INVALID' || err?.status === 401) {
				isServiceUnavailable = false;
				clearRetryTimer();
				retryAttempt = 0;
				isAuthRequired = true;
				botState = 'idle';
			} else if (
				err?.code === 'SERVICE_UNAVAILABLE' ||
				err?.status === 503 ||
				err?.code === 'BAD_GATEWAY' ||
				err?.status === 502
			) {
				handleServiceError(err.message, err.code);
			} else {
				handleServiceError(
					'챗봇 서비스(Redis 또는 서버)에 연결할 수 없습니다. 서비스 상태를 확인해 주세요.',
					'SERVICE_UNAVAILABLE'
				);
			}
		} finally {
			isLoadingHistory = false;
			isHistoryLoaded = true;
		}
	}

	/** 대화 기록 초기화 (새 대화 시작) */
	export async function clearChatHistory(): Promise<boolean> {
		clearRetryTimer();
		retryAttempt = 0;
		messages = [];
		hasTruncatedNotice = false;
		hasInitiatedGreeting = false;
		if (open) {
			await loadChatHistory();
		}
		return true;
	}

	onMount(() => {
		updateBotPosition();
		const handleResize = () => updateBotPosition();
		window.addEventListener('resize', handleResize);

		loadChatHistory();

		return () => {
			window.removeEventListener('resize', handleResize);
			clearRetryTimer();
			clearHappyTimer();
		};
	});

	function handleBotClick() {
		// AI 서비스 장애 시 눌러도 웃거나 윙크하지 않고 잠자는 표정 유지
		if (isServiceUnavailable) {
			if (!open) {
				open = true;
				scrollToBottom(false);
			}
			return;
		}

		clearHappyTimer();
		if (!open) {
			open = true;
			botRef?.wink('right');
			botState = 'happy';
			happyTimer = setTimeout(() => {
				happyTimer = null;
				if (botState === 'happy') {
					botState = isServiceUnavailable ? 'sleepy' : 'idle';
				}
			}, 1000);
			scrollToBottom(false);
			setTimeout(() => scrollToBottom(false), 120);
			setTimeout(() => scrollToBottom(false), 450);
		} else {
			botRef?.wink('left');
			botState = 'happy';
			happyTimer = setTimeout(() => {
				happyTimer = null;
				if (botState === 'happy') {
					botState = isServiceUnavailable ? 'sleepy' : 'idle';
				}
			}, 1000);
		}
	}

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

	function handleKakaoLoginInChat() {
		auth.startKakaoLogin();
	}

	function applyBgmAction(action: ChatActionPayload): boolean {
		const actionName = String(action?.action ?? '').toLowerCase();
		if (actionName === 'stop_bgm') {
			bgm.pause();
			return true;
		}
		if (actionName === 'start_bgm') {
			bgm.play();
			return true;
		}
		return actionName.includes('bgm');
	}

	function handleActionClick(action: ChatActionPayload) {
		applyBgmAction(action);
	}

	async function handleSendMessage(textToSend?: string, keepFocus = false) {
		let text = (textToSend ?? inputText).trim();
		const currentAttachments = [...attachedFiles];

		if ((!text && currentAttachments.length === 0) || isGenerating) return;

		if (text.length > 300) text = text.slice(0, 300);

		inputText = '';
		attachedFiles = [];

		if (keepFocus) {
			await tick();
			chatInputEl?.focus();
			requestAnimationFrame(() => {
				chatInputEl?.focus();
			});
		}

		// 1. 유저 메시지 추가
		const userMsgId = 'user-' + Date.now();
		messages = [
			...messages,
			{
				id: userMsgId,
				role: 'user',
				text,
				attachments: currentAttachments,
				time: getCurrentTime(),
				isDone: true
			}
		];

		// 2. 봇 응답용 빈 말풍선 미리 생성
		const botMsgId = 'bot-' + Date.now();
		messages = [
			...messages,
			{
				id: botMsgId,
				role: 'bot',
				text: '',
				time: '',
				isDone: false,
				action: null
			}
		];

		// 3. 봇 상태 전환
		botState = 'thinking';
		isGenerating = true;
		currentStatus = '답변을 생각하고 있어요...';
		await scrollToBottom();

		if (abortCtrl) {
			abortCtrl.abort();
		}
		abortCtrl = new AbortController();

		let accumulatedText = '';
		let pendingAction: ChatActionPayload | null = null;

		try {
			let uploadedAttachments: ChatUploadAttachment[] = [];

			if (currentAttachments.length > 0) {
				currentStatus =
					currentAttachments.length === 1
						? '파일을 업로드하고 있어요...'
						: `${currentAttachments.length}개의 파일을 업로드하고 있어요...`;
				await scrollToBottom();

				const uploadPromises = currentAttachments.map(async (att) => {
					if (att.file_uri) {
						return {
							file_uri: att.file_uri,
							file_name: att.name,
							media_type: att.media_type || att.type
						};
					}
					if (att.rawFile) {
						const res = await uploadChatFile(att.rawFile, apiUrl);
						att.file_uri = res.file_uri;
						att.media_type = res.media_type;
						return res;
					}
					return null;
				});

				const results = await Promise.all(uploadPromises);
				uploadedAttachments = results.filter((item): item is ChatUploadAttachment => item !== null);
				currentStatus = '답변을 생각하고 있어요...';
			}

			await streamAIChat({
				message: text,
				attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
				apiUrl,
				signal: abortCtrl.signal,
				onStatus: (msg) => {
					botState = 'thinking';
					currentStatus = msg;
					scrollToBottom();
				},
				onDelta: (chunk) => {
					if (currentStatus) currentStatus = null;
					if (isServiceUnavailable) {
						isServiceUnavailable = false;
						clearRetryTimer();
						retryAttempt = 0;
					}
					botState = 'talking';
					accumulatedText += chunk;
					messages = messages.map((m) => (m.id === botMsgId ? { ...m, text: accumulatedText } : m));
					scrollToBottom(false);
				},
				onAction: (action) => {
					// BGM 제어는 백그라운드에서 즉시 반영하고 별도 팝업/버튼은 노출하지 않음
					if (applyBgmAction(action)) return;
					pendingAction = action;
				},
				onDone: () => {
					if (!isServiceUnavailable) {
						botState = 'idle';
					}
					currentStatus = null;
					isGenerating = false;
					messages = messages.map((m) =>
						m.id === botMsgId
							? {
									...m,
									text: accumulatedText || m.text,
									time: getCurrentTime(),
									isDone: true,
									action: pendingAction
								}
							: m
					);
					scrollToBottom();
				},
				onError: (errMsg, errCode) => {
					console.error('[BotArea] 백엔드 오류:', errMsg, errCode);
					currentStatus = null;
					if (
						errCode === 'UNAUTHORIZED' ||
						errCode === 'TOKEN_INVALID' ||
						errCode === 'TOKEN_EXPIRED' ||
						errCode === 'TOKEN_REVOKED'
					) {
						isAuthRequired = true;
						botState = 'idle';
						isGenerating = false;
					} else {
						handleServiceError(errMsg, errCode);
					}
					messages = messages.map((m) =>
						m.id === botMsgId
							? {
									...m,
									text: accumulatedText || `⚠️ **서비스 안내**: ${errMsg}`,
									time: getCurrentTime(),
									isDone: true
								}
							: m
					);
				}
			});
		} catch (networkErr: any) {
			if (
				networkErr?.status === 401 ||
				networkErr?.code === 'UNAUTHORIZED' ||
				networkErr?.code === 'TOKEN_INVALID'
			) {
				isAuthRequired = true;
				currentStatus = null;
				botState = 'idle';
				messages = messages.map((m) =>
					m.id === botMsgId
						? {
								...m,
								text: '🔒 로그인 후 이용하실 수 있습니다.',
								time: getCurrentTime(),
								isDone: true
							}
						: m
				);
				await scrollToBottom();
				return;
			}

			if (networkErr?.status && networkErr.status >= 400 && networkErr.status < 600) {
				currentStatus = null;
				if (networkErr.status === 502 || networkErr.status === 503) {
					handleServiceError(networkErr.message, networkErr.code);
				} else {
					botState = 'idle';
				}
				messages = messages.map((m) =>
					m.id === botMsgId
						? {
								...m,
								text: `⚠️ **업로드 실패**: ${networkErr.message}`,
								time: getCurrentTime(),
								isDone: true
							}
						: m
				);
				await scrollToBottom();
				return;
			}

			console.error('[BotArea] 처리 중 예외 발생:', networkErr);
			handleServiceError(
				'챗봇 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
				'SERVICE_UNAVAILABLE'
			);
			messages = messages.map((m) =>
				m.id === botMsgId
					? {
							...m,
							text:
								accumulatedText ||
								'⚠️ **서비스 안내**: 챗봇 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
							time: getCurrentTime(),
							isDone: true
						}
					: m
			);
		} finally {
			isGenerating = false;
			currentStatus = null;
			if (!isServiceUnavailable) {
				botState = 'idle';
			}
			await scrollToBottom();
		}
	}

	function handleClose() {
		open = false;
		onClose?.();
	}
</script>

<!-- 모바일 배경 어두운 딤 (터치 시 닫기) -->
{#if open && isMobile}
	<div
		class="bot-area-backdrop"
		data-fd-barrier
		onclick={handleClose}
		transition:fade={{ duration: 250 }}
		role="presentation"
	></div>
{/if}

<div class="bot-area-root {className}" class:is-mobile={isMobile}>
	<!-- 1. 대화창 본체 (정원 -> 사각형 clip-path 모핑 패널) -->
	<div
		bind:this={panelEl}
		class="morph-chat-panel"
		class:is-open={open}
		class:is-mobile={isMobile}
		data-fd-barrier
		role="dialog"
		aria-label="{botName} 대화창"
		aria-modal="true"
	>
		<div class="panel-inner-content" class:visible={open}>
			<ChatHeader {botName} onClose={handleClose} />

			<ChatMessages
				bind:containerEl={messageContainerEl}
				{messages}
				{hasTruncatedNotice}
				{isGenerating}
				{currentStatus}
				{animatedDots}
				{isAuthRequired}
				{isServiceUnavailable}
				hasAttachments={attachedFiles.length > 0}
				onLogin={handleKakaoLoginInChat}
				onAction={handleActionClick}
			/>

			{#if !isServiceUnavailable}
				<ChatInput
					bind:value={inputText}
					bind:attachedFiles
					bind:inputEl={chatInputEl}
					{isGenerating}
					placeholder="음악 취향이나 궁금한 점을 물어보세요..."
					onSend={handleSendMessage}
					onClose={handleClose}
				/>
			{/if}
		</div>
	</div>

	<!-- 2. 우측 하단 봇 홈 앵커 -->
	<div class="bot-home-anchor" aria-hidden="true"></div>

	<!-- 3. 실시간 날아다니는 단일 봇 액터 (Bot.svelte) -->
	<div
		class="flying-bot-actor"
		class:is-docked={open}
		style="transform: {botFlyTransform};"
	>
		<button
			type="button"
			class="bot-trigger-button"
			data-fd-barrier
			onclick={handleBotClick}
			aria-label={open ? 'AI 봇 표정 반응 보기' : 'AI 봇과 대화창 열기'}
		>
			<Bot
				bind:this={botRef}
				state={isServiceUnavailable ? 'sleepy' : botState}
				size={BOT_HOME_SIZE}
				disableHoverWave={open || isServiceUnavailable}
				activeWave={!isServiceUnavailable &&
					(isGenerating || botState === 'thinking' || botState === 'talking')}
			/>
		</button>
	</div>
</div>

<style>
	/* 모바일 전용 배경 어두운 딤 */
	.bot-area-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		z-index: 46;
	}

	/* 루트 컨테이너: 우측 하단 고정 좌표 기준점 제공 (기존 1.75rem의 2/3 간격) */
	.bot-area-root {
		--bot-area-edge-gap: calc(1.75rem * 2 / 3);
		position: fixed;
		right: var(--bot-area-edge-gap);
		bottom: var(--bot-area-edge-gap);
		z-index: 48;
		pointer-events: none;
	}

	.bot-area-root.is-mobile {
		right: 1rem;
		bottom: calc(64px + env(safe-area-inset-bottom, 0px));
	}

	/* 1. 모핑 대화창 패널 (정원 -> 사각형 clip-path 모핑) */
	.morph-chat-panel {
		position: fixed;
		top: calc(var(--pc-header-height, 70px) + var(--bot-area-edge-gap));
		right: var(--bot-area-edge-gap);
		bottom: var(--bot-area-edge-gap);
		width: clamp(340px, 92vw, 410px);
		height: auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
		border-radius: 28px;

		overflow: hidden;
		z-index: 47;
		color: #f1f5f9;
		user-select: text;
		clip-path: inset(calc(100% - 80px) 0px 0px calc(100% - 80px) round 40px);
		opacity: 0;
		pointer-events: none;
		/* 닫힐 때: 패널이 80px 원으로 충분히 작아진 뒤 투명해지도록 opacity에 딜레이 부여 */
		transition:
			clip-path 0.46s cubic-bezier(0.32, 0.72, 0, 1),
			opacity 0.2s ease 0.26s,
			box-shadow 0.35s ease;
		will-change: clip-path, opacity;
	}

	.morph-chat-panel.is-open {
		clip-path: inset(0px 0px 0px 0px round 28px);
		opacity: 1;
		pointer-events: auto;
		transition:
			clip-path 0.52s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.22s ease 0s,
			box-shadow 0.4s ease;
	}

	.morph-chat-panel.is-mobile {
		top: auto;
		right: 0;
		left: 0;
		bottom: 0;
		width: 100%;
		height: 85dvh;
		border-radius: 28px 28px 0 0;
		border-bottom: none;
		border-left: none;
		border-right: none;
		clip-path: inset(calc(100% - 144px) 16px 64px calc(100% - 96px) round 40px 40px 40px 40px);
	}

	.morph-chat-panel.is-mobile.is-open {
		clip-path: inset(0px 0px 0px 0px round 28px 28px 0px 0px);
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

	/* 2. 우측 하단 봇 홈 앵커 */
	.bot-home-anchor {
		width: 80px;
		height: 80px;
		pointer-events: none;
	}

	/* 3. 독립 비행 봇 액터 (Bot.svelte) */
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
