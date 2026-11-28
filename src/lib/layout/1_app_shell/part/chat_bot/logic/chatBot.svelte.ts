import { bgm } from '#lib/common/logic';
import { prefersReducedMotion } from '#lib/common/type/spring';
import type { BotState } from '../design/Bot.svelte';
import {
	createAttachmentsFromFiles,
	detectMediaCategoryFromMeta
} from './attachment';
import {
	DEFAULT_CHAT_API_URL,
	fetchChatHistory,
	streamAIChat,
	uploadChatFile,
	type ChatActionPayload,
	type ChatUploadAttachment
} from './chatStream';
import type { AgentStep, ChatAttachment, ChatMessage } from './types';

function cleanStepLabel(text: string): string {
	return text.replace(/\.+$/, '').trim();
}

function normalizeDetailLines(detail?: string | string[], tool?: string): string[] {
	const lines: string[] = [];
	if (tool && tool.trim()) {
		lines.push(`tool: ${tool.trim()}`);
	}
	if (typeof detail === 'string') {
		const trimmed = detail.trim();
		if (trimmed) lines.push(trimmed);
	} else if (Array.isArray(detail)) {
		for (const item of detail) {
			const trimmed = String(item ?? '').trim();
			if (trimmed) lines.push(trimmed);
		}
	}
	return lines;
}

const RETRY_DELAYS_MS = [1000, 1000, 3000, 5000, 10000, 60000] as const;
const MAX_INPUT_LENGTH = 100;
const TRANSIENT_AI_ERROR_MESSAGE =
	'앗, 지금은 답변을 준비하는 데 잠시 문제가 생겼어요. 조금만 기다렸다가 다시 말씀해 주실래요?';
const SERVICE_UNAVAILABLE_MESSAGE =
	'지금 딘디 서비스에 잠시 문제가 생겼어요. 빠르게 확인하고 돌아올 테니 조금만 기다려 주세요!';

function isServerOutageError(errCode?: string, status?: number | null, isStreamError = false): boolean {
	// SSE 스트림이 이미 열려 서버 응답 중 발생한 에러(Gemini API 키·모델 오류 등)는 서버 장애로 취급하지 않음
	if (isStreamError) return false;
	if (status === 401 || status === 403 || status === 502 || status === 503 || status === 504) {
		return true;
	}
	if (
		errCode === 'SERVICE_UNAVAILABLE' ||
		errCode === 'BAD_GATEWAY' ||
		errCode === 'TOKEN_INVALID' ||
		errCode === 'CSRF_INVALID'
	) {
		return true;
	}
	return false;
}

function getCurrentTime(): string {
	const now = new Date();
	const hours = now.getHours();
	const minutes = now.getMinutes().toString().padStart(2, '0');
	const period = hours >= 12 ? '오후' : '오전';
	const formattedHours = hours % 12 || 12;
	return `${period} ${formattedHours}:${minutes}`;
}

export interface ChatBotControllerCallbacks {
	onScrollToBottom?: (smooth?: boolean) => void | Promise<void>;
	onBotStateChange?: (state: BotState) => void;
	onOpenChange?: (open: boolean) => void;
}

/**
 * 1_app_shell/part/chat_bot 비즈니스 로직 컨트롤러
 * - 대화 기록 복원/초기화, SSE 스트리밍, 첨부파일 업로드/관리, 자동 재시도, BGM 액션 제어 전담
 * - design/ 컴포넌트들은 이 컨트롤러의 상태와 액션 콜백만 받아 순수 렌더링합니다.
 */
export class ChatBotController {
	messages = $state<ChatMessage[]>([]);
	inputText = $state('');
	attachedFiles = $state<ChatAttachment[]>([]);
	hasInitiatedGreeting = $state(false);
	isHistoryLoaded = $state(false);
	hasTruncatedNotice = $state(false);
	isServiceUnavailable = $state(false);
	serviceErrorStatus = $state<number | null>(null);
	isRefreshing = $state(false);
	isGenerating = $state(false);
	currentStatus = $state<string | null>(null);
	botState = $state<BotState>('idle');
	dotCount = $state(1);

	readonly maxLength = MAX_INPUT_LENGTH;

	private apiUrl: string;
	private callbacks: ChatBotControllerCallbacks;
	private abortCtrl: AbortController | null = null;
	private isLoadingHistory = false;
	private retryAttempt = 0;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private happyTimer: ReturnType<typeof setTimeout> | null = null;
	private dotTimer: ReturnType<typeof setInterval> | null = null;
	private streamRafId: number | null = null;

	constructor(apiUrl = DEFAULT_CHAT_API_URL, callbacks: ChatBotControllerCallbacks = {}) {
		this.apiUrl = apiUrl;
		this.callbacks = callbacks;
	}

	get animatedDots(): string {
		return '.'.repeat(this.dotCount);
	}

	get hasErrorState(): boolean {
		return (
			this.isServiceUnavailable ||
			this.messages.some((m) => Boolean(m.isServiceError || m.isTransientError))
		);
	}

	get canSubmit(): boolean {
		return (
			(this.inputText.trim().length > 0 || this.attachedFiles.length > 0) &&
			!this.isGenerating &&
			!this.isServiceUnavailable
		);
	}

	setApiUrl(nextUrl: string) {
		this.apiUrl = nextUrl || DEFAULT_CHAT_API_URL;
	}

	setBotState(next: BotState) {
		this.botState = next;
		this.callbacks.onBotStateChange?.(next);
	}

	setInputText = (next: string): void => {
		this.inputText = next.length > this.maxLength ? next.slice(0, this.maxLength) : next;
	};

	addFiles = (files: FileList | File[]): void => {
		const created = createAttachmentsFromFiles(files);
		if (created.length > 0) {
			this.attachedFiles = [...this.attachedFiles, ...created];
		}
	};

	removeAttachment = (id: string): void => {
		const target = this.attachedFiles.find((a) => a.id === id);
		if (target) {
			URL.revokeObjectURL(target.url);
		}
		this.attachedFiles = this.attachedFiles.filter((a) => a.id !== id);
	};

	private startDotAnimation() {
		if (this.dotTimer) return;
		this.dotTimer = setInterval(() => {
			this.dotCount = (this.dotCount % 3) + 1;
		}, 400);
	}

	private stopDotAnimation() {
		if (this.dotTimer) {
			clearInterval(this.dotTimer);
			this.dotTimer = null;
		}
		this.dotCount = 1;
	}

	private setStatus(status: string | null) {
		this.currentStatus = status;
		if (this.isGenerating && status) {
			this.startDotAnimation();
		} else {
			this.stopDotAnimation();
		}
	}

	clearRetryTimer() {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
	}

	clearHappyTimer() {
		if (this.happyTimer) {
			clearTimeout(this.happyTimer);
			this.happyTimer = null;
		}
	}

	triggerHappy(durationMs = 1000) {
		if (
			this.isServiceUnavailable ||
			this.isGenerating ||
			this.botState === 'thinking' ||
			this.botState === 'talking'
		) {
			return;
		}
		this.clearHappyTimer();
		this.setBotState('happy');
		this.happyTimer = setTimeout(() => {
			this.happyTimer = null;
			if (this.botState === 'happy') {
				this.setBotState(this.isServiceUnavailable ? 'sleepy' : 'idle');
			}
		}, durationMs);
	}

	private scheduleAutoRetry() {
		if (!this.isServiceUnavailable || this.retryTimer) return;
		const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)];
		this.retryAttempt += 1;
		this.retryTimer = setTimeout(() => {
			this.retryTimer = null;
			if (!this.isServiceUnavailable) return;
			void this.loadChatHistory();
		}, delay);
	}

	private handleServiceError(_errMsg?: string, _errCode?: string, status?: number | null) {
		this.clearHappyTimer();
		if (!this.isServiceUnavailable) {
			this.retryAttempt = 0;
		}
		this.isServiceUnavailable = true;
		this.serviceErrorStatus = typeof status === 'number' && status > 0 ? status : null;
		this.setBotState('sleepy');
		this.isGenerating = false;
		this.setStatus(null);

		// 가운데 에러 화면 대신 딘디가 직접 인사하듯 안내 메시지를 1회 표시 (재시도 실패 시 시간 갱신)
		const nowTime = getCurrentTime();
		const hasNotice = this.messages.some((m) => m.isServiceError);
		if (hasNotice) {
			this.messages = this.messages.map((m) =>
				m.isServiceError ? { ...m, time: nowTime } : m
			);
		} else {
			this.messages = [
				...this.messages,
				{
					id: 'bot-service-error',
					role: 'bot',
					text: SERVICE_UNAVAILABLE_MESSAGE,
					time: nowTime,
					isDone: true,
					isServiceError: true
				}
			];
		}

		this.scheduleAutoRetry();
		void this.callbacks.onScrollToBottom?.();
	}

	async loadChatHistory(isOpen = false): Promise<void> {
		if (this.isLoadingHistory) return;
		this.isLoadingHistory = true;
		try {
			const data = await fetchChatHistory(this.apiUrl);

			this.isServiceUnavailable = false;
			this.serviceErrorStatus = null;
			this.clearRetryTimer();
			this.retryAttempt = 0;
			if (!this.isGenerating && this.botState === 'sleepy') {
				this.setBotState('idle');
			}

			const wrappedResult = (data as unknown as { result?: { messages?: unknown[] } })?.result;
			const rawMessages =
				wrappedResult && Array.isArray(wrappedResult.messages)
					? (wrappedResult.messages as Record<string, unknown>[])
					: data && Array.isArray(data.messages)
						? (data.messages as unknown as Record<string, unknown>[])
						: [];

			if (rawMessages.length > 0 || (data && Array.isArray(data.messages))) {
				this.messages = rawMessages.map((m, mIdx) => {
					const rawAttachments = Array.isArray(m.attachments) ? m.attachments : [];
					const normalizedAttachments: ChatAttachment[] = rawAttachments.map(
						(att: Record<string, unknown>, aIdx: number) => {
							const fileName = String(att.name || att.file_name || '첨부파일');
							const mediaType = String(att.type || att.media_type || '');
							const fileUrl = String(att.url || att.file_uri || '');
							const fileSize = typeof att.size === 'number' ? att.size : 0;
							const media = detectMediaCategoryFromMeta(fileName, mediaType);

							return {
								id: String(att.id || `hist-att-${m.id || mIdx}-${aIdx}`),
								name: fileName,
								size: fileSize,
								type: mediaType,
								url: fileUrl,
								file_uri: String(att.file_uri || fileUrl),
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
						text: String(m.text || m.content || ''),
						action: (m.action as ChatActionPayload | null) || null,
						attachments: normalizedAttachments,
						isDone: true,
						time: String(m.time || getCurrentTime())
					};
				});
				this.hasTruncatedNotice = !!data.has_truncated;
				this.hasInitiatedGreeting = true;
				if (isOpen) {
					void this.callbacks.onScrollToBottom?.(false);
					setTimeout(() => void this.callbacks.onScrollToBottom?.(false), 80);
					setTimeout(() => void this.callbacks.onScrollToBottom?.(false), 280);
				}
			}
		} catch (err: unknown) {
			const e = err as { message?: string; code?: string; status?: number };
			console.warn('[ChatBot] 대화 기록 조회 실패:', e?.message, e?.code, e?.status);
			this.handleServiceError(
				e?.message,
				e?.code,
				typeof e?.status === 'number' ? e.status : null
			);
		} finally {
			this.isLoadingHistory = false;
			this.isHistoryLoaded = true;
		}
	}

	/** 대화 내역 수동 새로고침 (모바일 당겨서 새로고침 · PC 헤더 새로고침 버튼) */
	refreshChatHistory = async (isOpen = false): Promise<void> => {
		if (this.isGenerating || this.isRefreshing) return;
		this.isRefreshing = true;
		const startedAt = Date.now();
		this.clearRetryTimer();
		this.retryAttempt = 0;
		try {
			await this.loadChatHistory(isOpen);
		} finally {
			const elapsed = Date.now() - startedAt;
			if (elapsed < 220) {
				await new Promise((resolve) => setTimeout(resolve, 220 - elapsed));
			}
			this.isRefreshing = false;
		}
	};

	async clearChatHistory(isOpen = false): Promise<boolean> {
		this.clearRetryTimer();
		this.retryAttempt = 0;
		this.messages = [];
		this.hasTruncatedNotice = false;
		this.hasInitiatedGreeting = false;
		if (isOpen) {
			await this.loadChatHistory(true);
		}
		return true;
	}

	applyBgmAction = (action: ChatActionPayload): boolean => {
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
	};

	handleActionClick = (action: ChatActionPayload): void => {
		this.applyBgmAction(action);
	};

	async sendMessage(textToSend?: string): Promise<boolean> {
		let text = (textToSend ?? this.inputText).trim();
		const currentAttachments = [...this.attachedFiles];

		if ((!text && currentAttachments.length === 0) || this.isGenerating) return false;

		if (text.length > this.maxLength) text = text.slice(0, this.maxLength);

		this.inputText = '';
		this.attachedFiles = [];

		// 이전 대화 시도에서 표시된 일시적 AI 시스템 오류 안내 메시지는 재시도 시 제거
		const cleanedMessages = this.messages.filter((m) => !m.isTransientError);

		const userMsgId = 'user-' + Date.now();
		this.messages = [
			...cleanedMessages,
			{
				id: userMsgId,
				role: 'user',
				text,
				attachments: currentAttachments,
				time: getCurrentTime(),
				isDone: true
			}
		];

		const botMsgId = 'bot-' + Date.now();
		let stepSeq = 0;

		const updateBotMessage = (updater: (m: ChatMessage) => ChatMessage) => {
			this.messages = this.messages.map((m) => (m.id === botMsgId ? updater(m) : m));
		};

		const pushBotStep = (
			rawLabel: string,
			kind: 'upload' | 'thinking' | 'tool_calling' = 'thinking',
			tool?: string,
			detail?: string | string[]
		) => {
			const label = cleanStepLabel(rawLabel) || '답변을 생각하고 있어요';
			const extraLines = normalizeDetailLines(detail, tool);

			updateBotMessage((m) => {
				const prevSteps: AgentStep[] = m.steps ? [...m.steps] : [];
				const last = prevSteps[prevSteps.length - 1];

				if (last && last.status === 'running' && last.label === label) {
					const mergedDetail = [...(last.detail ?? [])];
					for (const line of extraLines) {
						if (!mergedDetail.includes(line)) mergedDetail.push(line);
					}
					prevSteps[prevSteps.length - 1] = {
						...last,
						kind: kind === 'tool_calling' ? 'tool_calling' : last.kind,
						detail: mergedDetail.length > 0 ? mergedDetail : undefined
					};
				} else {
					const completed: AgentStep[] = prevSteps.map((s) =>
						s.status === 'running' ? { ...s, status: 'done' } : s
					);
					completed.push({
						id: `${botMsgId}-step-${++stepSeq}`,
						label,
						status: 'running',
						kind,
						detail: extraLines.length > 0 ? extraLines : undefined
					});
					prevSteps.length = 0;
					prevSteps.push(...completed);
				}

				const shouldShow =
					Boolean(m.showSteps) ||
					kind === 'tool_calling' ||
					prevSteps.length >= 2 ||
					extraLines.length > 0;

				return { ...m, steps: prevSteps, showSteps: shouldShow };
			});
		};

		const finalizeBotSteps = (endStatus: 'done' | 'error') => {
			updateBotMessage((m) => {
				if (!m.steps || m.steps.length === 0) return m;
				const hasRunning = m.steps.some((s) => s.status === 'running');
				if (!hasRunning) return m;
				return {
					...m,
					steps: m.steps.map((s) => (s.status === 'running' ? { ...s, status: endStatus } : s))
				};
			});
		};

		this.messages = [
			...this.messages,
			{
				id: botMsgId,
				role: 'bot',
				text: '',
				time: '',
				isDone: false,
				action: null,
				steps: [],
				showSteps: false
			}
		];

		this.setBotState('thinking');
		this.isGenerating = true;
		this.setStatus('답변을 생각하고 있어요...');
		await this.callbacks.onScrollToBottom?.();

		if (this.abortCtrl) {
			this.abortCtrl.abort();
		}
		this.abortCtrl = new AbortController();

		let accumulatedText = '';
		let displayedLen = 0;
		let streamDone = false;
		let streamErrored = false;
		let pendingAction: ChatActionPayload | null = null;
		let resolveDrain: (() => void) | null = null;

		const reducedMotion = prefersReducedMotion();

		const finishDisplayedMessage = () => {
			this.stopStreamPacer();
			if (!this.isServiceUnavailable) {
				this.setBotState('idle');
			}
			this.isGenerating = false;
			this.setStatus(null);
			finalizeBotSteps('done');
			updateBotMessage((m) => ({
				...m,
				text: accumulatedText || m.text,
				time: getCurrentTime(),
				isDone: true,
				action: pendingAction
			}));
			void this.callbacks.onScrollToBottom?.();
			resolveDrain?.();
			resolveDrain = null;
		};

		const stepReveal = () => {
			this.streamRafId = null;
			if (streamErrored) {
				resolveDrain?.();
				resolveDrain = null;
				return;
			}

			const remaining = accumulatedText.length - displayedLen;
			if (remaining > 0) {
				// 백로그 길이에 따라 자연스럽게 속도 조절 (짧으면 1~2자/프레임, 길면 부드럽게 가속)
				const step = reducedMotion
					? remaining
					: remaining > 90
						? Math.ceil(remaining * 0.14)
						: remaining > 32
							? 3
							: remaining > 12
								? 2
								: 1;
				displayedLen = Math.min(accumulatedText.length, displayedLen + step);
				updateBotMessage((m) => ({ ...m, text: accumulatedText.slice(0, displayedLen) }));
				void this.callbacks.onScrollToBottom?.(false);
			}

			if (displayedLen < accumulatedText.length) {
				this.streamRafId = requestAnimationFrame(stepReveal);
			} else if (streamDone) {
				finishDisplayedMessage();
			}
		};

		const scheduleReveal = () => {
			if (reducedMotion || typeof requestAnimationFrame === 'undefined') {
				displayedLen = accumulatedText.length;
				updateBotMessage((m) => ({ ...m, text: accumulatedText }));
				void this.callbacks.onScrollToBottom?.(false);
				if (streamDone) finishDisplayedMessage();
				return;
			}
			if (this.streamRafId === null) {
				this.streamRafId = requestAnimationFrame(stepReveal);
			}
		};

		try {
			let uploadedAttachments: ChatUploadAttachment[] = [];

			if (currentAttachments.length > 0) {
				const uploadLabel =
					currentAttachments.length === 1
						? '파일을 업로드하고 있어요...'
						: `${currentAttachments.length}개의 파일을 업로드하고 있어요...`;
				this.setStatus(uploadLabel);
				pushBotStep(
					uploadLabel,
					'upload',
					undefined,
					currentAttachments.map((a) => a.name).filter(Boolean)
				);
				await this.callbacks.onScrollToBottom?.();

				const uploadPromises = currentAttachments.map(async (att) => {
					if (att.file_uri) {
						return {
							file_uri: att.file_uri,
							file_name: att.name,
							media_type: att.media_type || att.type
						};
					}
					if (att.rawFile) {
						const res = await uploadChatFile(att.rawFile, this.apiUrl);
						att.file_uri = res.file_uri;
						att.media_type = res.media_type;
						return res;
					}
					return null;
				});

				const results = await Promise.all(uploadPromises);
				uploadedAttachments = results.filter((item): item is ChatUploadAttachment => item !== null);
				this.setStatus('답변을 생각하고 있어요...');
				pushBotStep('답변을 생각하고 있어요', 'thinking');
			}

			await streamAIChat({
				message: text,
				attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
				apiUrl: this.apiUrl,
				signal: this.abortCtrl.signal,
				onStatus: (msg, statusType, tool, detail) => {
					this.setBotState('thinking');
					this.setStatus(msg);
					pushBotStep(msg, statusType ?? 'thinking', tool, detail);
					void this.callbacks.onScrollToBottom?.();
				},
				onDelta: (chunk) => {
					if (this.currentStatus) this.setStatus(null);
					finalizeBotSteps('done');
					if (this.isServiceUnavailable) {
						this.isServiceUnavailable = false;
						this.serviceErrorStatus = null;
						this.clearRetryTimer();
						this.retryAttempt = 0;
					}
					this.setBotState('talking');
					accumulatedText += chunk;
					scheduleReveal();
				},
				onAction: (action) => {
					if (this.applyBgmAction(action)) return;
					pendingAction = action;
				},
				onDone: () => {
					streamDone = true;
					if (displayedLen >= accumulatedText.length || reducedMotion) {
						finishDisplayedMessage();
					} else {
						scheduleReveal();
					}
				},
				onError: (errMsg, errCode, status, isStreamError) => {
					streamErrored = true;
					this.stopStreamPacer();
					console.error('[ChatBot] 백엔드 오류:', errMsg, errCode, status, { isStreamError });
					finalizeBotSteps('error');
					if (isServerOutageError(errCode, status ?? null, Boolean(isStreamError))) {
						this.messages = accumulatedText
							? this.messages.map((m) =>
								m.id === botMsgId
									? {
										...m,
										text: accumulatedText,
										time: getCurrentTime(),
										isDone: true
									}
									: m
							)
							: this.messages.filter((m) => m.id !== botMsgId);
						this.handleServiceError(errMsg, errCode, status ?? null);
						return;
					}

					// 서버 자체는 정상이나 AI/Gemini API 키·모델 오류 등으로 대화가 실패한 경우:
					// 전체 에러 화면 대신 AI 발화 차례에만 안내 메시지를 표시하고,
					// 다음 대화 시도 시 실패한 사용자 발화와 AI 안내 메시지를 함께 제거하도록 표시
					this.isGenerating = false;
					this.setStatus(null);
					this.setBotState('idle');
					this.messages = this.messages.map((m) => {
						if (m.id === userMsgId) {
							return { ...m, isTransientError: true };
						}
						if (m.id === botMsgId) {
							return {
								...m,
								text: accumulatedText
									? `${accumulatedText}\n\n${TRANSIENT_AI_ERROR_MESSAGE}`
									: TRANSIENT_AI_ERROR_MESSAGE,
								time: getCurrentTime(),
								isDone: true,
								isTransientError: true
							};
						}
						return m;
					});
					void this.callbacks.onScrollToBottom?.();
				}
			});

			// SSE가 먼저 종료되었더라도 남은 글자 타이핑 페이싱이 끝날 때까지 자연스럽게 대기
			if (!streamErrored && displayedLen < accumulatedText.length && !reducedMotion) {
				streamDone = true;
				await new Promise<void>((resolve) => {
					resolveDrain = resolve;
					scheduleReveal();
				});
			}
		} catch (networkErr: unknown) {
			streamErrored = true;
			this.stopStreamPacer();
			const err = networkErr as { message?: string; code?: string; status?: number };
			console.error('[ChatBot] 처리 중 예외 발생:', networkErr);
			finalizeBotSteps('error');
			this.messages = accumulatedText
				? this.messages.map((m) =>
					m.id === botMsgId
						? {
							...m,
							text: accumulatedText,
							time: getCurrentTime(),
							isDone: true
						}
						: m
				)
				: this.messages.filter((m) => m.id !== botMsgId);
			this.handleServiceError(
				err?.message,
				err?.code || 'SERVICE_UNAVAILABLE',
				typeof err?.status === 'number' ? err.status : null
			);
		} finally {
			this.stopStreamPacer();
			this.isGenerating = false;
			this.setStatus(null);
			if (!this.isServiceUnavailable) {
				this.setBotState('idle');
			}
			await this.callbacks.onScrollToBottom?.();
		}

		return true;
	}

	private stopStreamPacer() {
		if (this.streamRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.streamRafId);
			this.streamRafId = null;
		}
	}

	cleanup() {
		this.clearRetryTimer();
		this.clearHappyTimer();
		this.stopDotAnimation();
		this.stopStreamPacer();
		this.abortCtrl?.abort();
		this.abortCtrl = null;
	}
}
