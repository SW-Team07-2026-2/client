import { bgm } from '#lib/common/logic';
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
import type { ChatAttachment, ChatMessage } from './types';

const RETRY_DELAYS_MS = [1000, 1000, 3000, 5000, 10000, 60000] as const;
const MAX_INPUT_LENGTH = 300;

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

	constructor(apiUrl = DEFAULT_CHAT_API_URL, callbacks: ChatBotControllerCallbacks = {}) {
		this.apiUrl = apiUrl;
		this.callbacks = callbacks;
	}

	get animatedDots(): string {
		return '.'.repeat(this.dotCount);
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
		if (this.isServiceUnavailable) return;
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

		const userMsgId = 'user-' + Date.now();
		this.messages = [
			...this.messages,
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
		this.messages = [
			...this.messages,
			{
				id: botMsgId,
				role: 'bot',
				text: '',
				time: '',
				isDone: false,
				action: null
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
		let pendingAction: ChatActionPayload | null = null;

		try {
			let uploadedAttachments: ChatUploadAttachment[] = [];

			if (currentAttachments.length > 0) {
				this.setStatus(
					currentAttachments.length === 1
						? '파일을 업로드하고 있어요...'
						: `${currentAttachments.length}개의 파일을 업로드하고 있어요...`
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
			}

			await streamAIChat({
				message: text,
				attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
				apiUrl: this.apiUrl,
				signal: this.abortCtrl.signal,
				onStatus: (msg) => {
					this.setBotState('thinking');
					this.setStatus(msg);
					void this.callbacks.onScrollToBottom?.();
				},
				onDelta: (chunk) => {
					if (this.currentStatus) this.setStatus(null);
					if (this.isServiceUnavailable) {
						this.isServiceUnavailable = false;
						this.serviceErrorStatus = null;
						this.clearRetryTimer();
						this.retryAttempt = 0;
					}
					this.setBotState('talking');
					accumulatedText += chunk;
					this.messages = this.messages.map((m) =>
						m.id === botMsgId ? { ...m, text: accumulatedText } : m
					);
					void this.callbacks.onScrollToBottom?.(false);
				},
				onAction: (action) => {
					if (this.applyBgmAction(action)) return;
					pendingAction = action;
				},
				onDone: () => {
					if (!this.isServiceUnavailable) {
						this.setBotState('idle');
					}
					this.isGenerating = false;
					this.setStatus(null);
					this.messages = this.messages.map((m) =>
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
					void this.callbacks.onScrollToBottom?.();
				},
				onError: (errMsg, errCode, status) => {
					console.error('[ChatBot] 백엔드 오류:', errMsg, errCode, status);
					this.handleServiceError(errMsg, errCode, status ?? null);
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
				}
			});
		} catch (networkErr: unknown) {
			const err = networkErr as { message?: string; code?: string; status?: number };
			console.error('[ChatBot] 처리 중 예외 발생:', networkErr);
			this.handleServiceError(
				err?.message,
				err?.code || 'SERVICE_UNAVAILABLE',
				typeof err?.status === 'number' ? err.status : null
			);
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
		} finally {
			this.isGenerating = false;
			this.setStatus(null);
			if (!this.isServiceUnavailable) {
				this.setBotState('idle');
			}
			await this.callbacks.onScrollToBottom?.();
		}

		return true;
	}

	cleanup() {
		this.clearRetryTimer();
		this.clearHappyTimer();
		this.stopDotAnimation();
		this.abortCtrl?.abort();
		this.abortCtrl = null;
	}
}
