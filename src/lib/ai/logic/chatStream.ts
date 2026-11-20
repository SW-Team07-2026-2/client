/**
 * INDIG AI 실시간 SSE(Server-Sent Events) 스트리밍 및 대화 기록 클라이언트
 * 
 * v2 API 명세서 (2026-11-13 기준 / §6 챗봇 · §0 공통 규약):
 * - Gateway 진입점: https://api.indig.co.kr
 * - 라우팅 경로: /api/chatbot/** (Gateway가 chatbot-service로 전달, 전부 로그인 필수)
 * - GET  /api/chatbot/chat        : 대화 기록 복원 조회 (로그인 필요 · 미로그인 401 · 기록 없으면 첫인사 생성)
 * - POST /api/chatbot/chat/upload : 대화 첨부 파일 임시 업로드 (🔒C: 로그인 + X-XSRF-TOKEN · Gateway 본문 1MB 한도)
 * - POST /api/chatbot/chat        : 사용자 질문 전송 및 실시간 SSE 스트리밍 (🔒C: 로그인 + X-XSRF-TOKEN · 분당 5회 한도)
 * 
 * 인증 및 예외 규약:
 * - 인증: 쿠키 기반(AT HttpOnly · RT HttpOnly · XSRF-TOKEN), credentials: 'include' 필수
 * - CSRF: POST 시 X-XSRF-TOKEN 헤더 필수 (GET /api/auth/me 응답의 xsrfToken)
 * - 401 수신 시: POST /api/auth/refresh 1회 호출 후 원본 요청 자동 재시도
 * - 403 CSRF_* 수신 시: GET /api/auth/me 호출 후 토큰 재동기화 및 1회 자동 재시도
 * - 에러 응답: Gateway 공통 봉투({ isSuccess: false, code, message }) 및 챗봇 오류({ detail }) 통합 처리
 */

import { auth } from '#lib/auth';
import { BASE_API_URL, CHAT_AI_API_URL } from '#lib/config/api';

export interface ChatActionPayload {
	action: string;
	[key: string]: any;
}

export interface ChatUploadAttachment {
	file_uri: string;
	file_name: string;
	media_type: string;
	url?: string;
	name?: string;
	type?: string;
}

export interface ChatHistoryMessage {
	id: string;
	role: 'bot' | 'user';
	text: string;
	time?: string;
	action?: ChatActionPayload | null;
	attachments?: ChatUploadAttachment[];
}

export interface ChatHistoryResponse {
	count: number;
	total_count: number;
	has_truncated: boolean;
	messages: ChatHistoryMessage[];
}

export interface StreamChatOptions {
	message: string;
	attachments?: ChatUploadAttachment[];
	apiUrl?: string;
	signal?: AbortSignal;
	onStatus?: (statusMessage: string, statusType?: 'thinking' | 'tool_calling', tool?: string) => void;
	onDelta?: (content: string) => void;
	onAction?: (action: ChatActionPayload) => void;
	onDone?: (payload?: any) => void;
	onError?: (errorMessage: string, errorCode?: string) => void;
}

export const DEFAULT_CHAT_API_URL = CHAT_AI_API_URL;

/** Gateway 요청 본문 크기 상한: 1 MiB (명세서 §0-5 · §6) */
export const GATEWAY_MAX_UPLOAD_BYTES = 1024 * 1024;

/**
 * 주어진 apiUrl로부터 Chat API 엔드포인트(GET/POST /api/chatbot/chat)와
 * 업로드 엔드포인트(POST /api/chatbot/chat/upload)를 정규화하여 반환합니다.
 */
export function resolveChatEndpoints(apiUrl: string = DEFAULT_CHAT_API_URL): {
	chatUrl: string;
	uploadUrl: string;
} {
	let base = (apiUrl && apiUrl.trim()) ? apiUrl.trim() : DEFAULT_CHAT_API_URL;

	// 상대 경로인 경우 BASE_API_URL과 결합
	if (base.startsWith('/')) {
		const host = BASE_API_URL.replace(/\/+$/, '');
		base = `${host}${base}`;
	}

	// 끝의 슬래시 제거
	base = base.replace(/\/+$/, '');

	// 호스트만 넘어왔거나 레거시 경로인 경우 정규화
	if (!base.includes('/api/chatbot') && !base.includes('/chat')) {
		base = `${base}/api/chatbot/chat`;
	} else if (base.endsWith('/api/chatbot')) {
		base = `${base}/chat`;
	} else if (base.includes('/chat') && !base.includes('/api/chatbot')) {
		// 레거시 .../chat 또는 .../chat/upload 변환
		base = base.replace(/\/chat(\/upload)?$/, '/api/chatbot/chat$1');
	}

	// 서브경로(stream/history/upload) 제거하여 기본 chatUrl 확정
	const chatUrl = base.replace(/\/api\/chatbot\/chat\/(stream|history|upload)$/, '/api/chatbot/chat');
	const uploadUrl = chatUrl.replace(/\/api\/chatbot\/chat$/, '/api/chatbot/chat/upload');

	return { chatUrl, uploadUrl };
}

/**
 * Gateway 공통 에러 봉투({ code, message }) 및 챗봇 오류({ detail }) 통합 파서
 */
async function parseChatError(
	response: Response
): Promise<{ message: string; code?: string }> {
	let message = `서버 응답 오류 (HTTP ${response.status})`;
	let code: string | undefined = undefined;

	try {
		const json = await response.json();
		if (json) {
			if (typeof json.message === 'string' && json.message.trim()) {
				message = json.message.trim();
			} else if (typeof json.detail === 'string' && json.detail.trim()) {
				message = json.detail.trim();
			}
			if (typeof json.code === 'string') {
				code = json.code;
			}
		}
	} catch {
		// Non-JSON 응답(HTML 등)
	}

	// 상태 코드별 기본 문구 및 에러 코드 보강
	if (response.status === 401) {
		message = message.startsWith('서버 응답 오류') ? '로그인이 필요하거나 세션이 만료되었습니다.' : message;
		code = code || 'TOKEN_INVALID';
	} else if (response.status === 403) {
		message = message.startsWith('서버 응답 오류') ? 'CSRF 검증에 실패했거나 접근 권한이 없습니다.' : message;
		code = code || 'CSRF_INVALID';
	} else if (response.status === 413) {
		message = '요청 또는 첨부 파일 크기가 너무 큽니다. (Gateway 최대 1MB)';
		code = code || 'PAYLOAD_TOO_LARGE';
	} else if (response.status === 429) {
		message = '요청 한도를 초과했습니다 (분당 5회). 잠시 후 다시 시도해 주세요.';
		code = code || 'RATE_LIMIT_EXCEEDED';
	} else if (response.status === 502) {
		message = message.startsWith('서버 응답 오류') ? '인증 서버 응답이 올바르지 않습니다.' : message;
		code = code || 'BAD_GATEWAY';
	} else if (response.status === 503) {
		message = message.startsWith('서버 응답 오류')
			? '챗봇 서비스를 일시적으로 사용할 수 없습니다 (서킷 브레이커 또는 점검 중).'
			: message;
		code = code || 'SERVICE_UNAVAILABLE';
	}

	return { message, code };
}

/**
 * 챗봇 API 전용 인증 및 자동 재시도 fetch 래퍼
 * - credentials: 'include' 필수
 * - POST 요청 시 X-XSRF-TOKEN 헤더 자동 주입
 * - 401 수신 시: POST /api/auth/refresh 1회 호출 후 재시도 (명세서 §6)
 * - 403 CSRF_* 수신 시: GET /api/auth/me로 CSRF 토큰 재동기화 후 1회 재시도
 */
async function fetchWithChatRetry(
	url: string,
	options: RequestInit = {},
	retried: boolean = false
): Promise<Response> {
	const method = (options.method || 'GET').toUpperCase();
	const headers = new Headers(options.headers || {});
	const normalizedBaseApi = BASE_API_URL.replace(/\/+$/, '');
	const isGatewayRequest = url.startsWith('/') || url.startsWith(normalizedBaseApi);

	// 쿠키 세션이 아닌 Bearer 토큰이 있을 경우 하위 호환 주입
	if (auth.token && auth.token !== 'cookie_session' && !headers.has('Authorization')) {
		headers.set('Authorization', `Bearer ${auth.token}`);
	}

	// POST 등 데이터 변경 요청 시 X-XSRF-TOKEN 주입 (🔒C)
	if (method !== 'GET') {
		const xsrf = auth.getXsrfToken();
		if (xsrf && !headers.has('X-XSRF-TOKEN')) {
			headers.set('X-XSRF-TOKEN', xsrf);
		}
	}

	const response = await fetch(url, {
		...options,
		method,
		headers,
		credentials: 'include'
	});

	// 1) Gateway 요청에서 401 수신 시: G5(POST /api/auth/refresh) 1회 시도 후 재요청
	// (로컬 AI 서버 직접 연결 시 401로 원격 Gateway RT를 소모/오염시키지 않도록 isGatewayRequest일 때만 수행)
	if (response.status === 401 && !retried && isGatewayRequest) {
		console.warn('[INDIG AI] 401 수신 - 세션 갱신 시도 (POST /api/auth/refresh)');
		const refreshResult = await auth.refresh();
		if (refreshResult === 'OK') {
			return fetchWithChatRetry(url, options, true);
		}
	}

	// 2) 403 CSRF_* 에러 수신 시: GET /api/auth/me로 토큰 재동기화 후 1회 재요청
	if (response.status === 403 && !retried) {
		let isCsrfError = false;
		try {
			const clone = response.clone();
			const errJson = await clone.json();
			if (typeof errJson?.code === 'string' && errJson.code.startsWith('CSRF_')) {
				isCsrfError = true;
			}
		} catch { }

		if (isCsrfError) {
			console.warn('[INDIG AI] 403 CSRF 오류 - CSRF 토큰 재동기화 후 재시도');
			await auth.checkAuth(false);
			return fetchWithChatRetry(url, options, true);
		}
	}

	return response;
}

/**
 * 1. 대화 기록 복원 및 첫인사 조회 (GET /api/chatbot/chat)
 * - 로그인 사용자 필수 (비로그인 시 401 TOKEN_INVALID)
 * - 유저의 기존 대화 기록이 없으면 백엔드가 딘디의 첫인사를 1개 담아 즉시 반환
 */
export async function fetchChatHistory(
	apiUrl: string = DEFAULT_CHAT_API_URL
): Promise<ChatHistoryResponse> {
	const { chatUrl } = resolveChatEndpoints(apiUrl);
	const res = await fetchWithChatRetry(chatUrl, { method: 'GET' });

	if (!res.ok) {
		const { message, code } = await parseChatError(res);
		const err = new Error(message);
		(err as any).code = code;
		(err as any).status = res.status;
		throw err;
	}

	const rawData = await res.json();
	// Gateway 공통 봉투({ isSuccess: true, result: { ... } }) 또는 직접 반환 객체 언래핑
	const data = (rawData && rawData.result && typeof rawData.result === 'object')
		? rawData.result
		: rawData;

	const messages = Array.isArray(data?.messages) ? data.messages : [];

	return {
		count: typeof data?.count === 'number' ? data.count : messages.length,
		total_count: typeof data?.total_count === 'number' ? data.total_count : messages.length,
		has_truncated: Boolean(data?.has_truncated),
		messages: messages.map((m: any, idx: number) => {
			const rawRole = String(m.role || 'bot').toLowerCase();
			const role: 'bot' | 'user' = (rawRole === 'user' || rawRole === 'human') ? 'user' : 'bot';
			return {
				id: String(m.id || `hist-${idx}`),
				role,
				text: String(m.text || m.content || ''),
				time: m.time || '',
				action: m.action || null,
				attachments: Array.isArray(m.attachments) ? m.attachments : undefined
			};
		})
	};
}

/**
 * 2. 파일 업로드 (POST /api/chatbot/chat/upload)
 * - 🔒C: 로그인 + X-XSRF-TOKEN
 * - Gateway 본문 한도: 1 MiB (초과 시 413)
 * - 반환된 file_uri, file_name, media_type을 streamAIChat attachments에 담아 전송
 */
export async function uploadChatFile(
	file: File,
	apiUrl: string = DEFAULT_CHAT_API_URL
): Promise<ChatUploadAttachment> {
	if (file.size > GATEWAY_MAX_UPLOAD_BYTES) {
		const err = new Error('파일 크기가 1MB를 초과했습니다. Gateway 한도(1MB) 이하 파일만 업로드할 수 있습니다.');
		(err as any).code = 'PAYLOAD_TOO_LARGE';
		(err as any).status = 413;
		throw err;
	}

	const { uploadUrl } = resolveChatEndpoints(apiUrl);
	const formData = new FormData();
	formData.append('file', file);

	const res = await fetchWithChatRetry(uploadUrl, {
		method: 'POST',
		body: formData
	});

	if (!res.ok) {
		const { message, code } = await parseChatError(res);
		const err = new Error(message);
		(err as any).code = code;
		(err as any).status = res.status;
		throw err;
	}

	const rawData = await res.json();
	const data = (rawData && rawData.result && typeof rawData.result === 'object')
		? rawData.result
		: rawData;

	return {
		file_uri: data.file_uri || data.url || '',
		file_name: data.file_name || data.name || file.name,
		media_type: data.media_type || data.type || file.type,
		url: data.url,
		name: data.name,
		type: data.type
	};
}

/**
 * 3. 질문 전송 및 실시간 SSE 스트리밍 (POST /api/chatbot/chat)
 * - 🔒C: 로그인 + X-XSRF-TOKEN
 * - Gateway 한도: 분당 5회 (429) · 타임아웃 30초
 */
export async function streamAIChat({
	message,
	attachments,
	apiUrl = DEFAULT_CHAT_API_URL,
	signal,
	onStatus,
	onDelta,
	onAction,
	onDone,
	onError
}: StreamChatOptions): Promise<void> {
	const { chatUrl } = resolveChatEndpoints(apiUrl);

	try {
		const requestPayload: {
			message: string;
			attachments?: Array<{
				file_uri: string;
				file_name: string;
				media_type: string;
			}>;
		} = {
			message
		};

		if (attachments && attachments.length > 0) {
			requestPayload.attachments = attachments.map((att) => ({
				file_uri: att.file_uri || att.url || '',
				file_name: att.file_name || att.name || 'attachment',
				media_type: att.media_type || att.type || 'application/octet-stream'
			}));
		}

		const response = await fetchWithChatRetry(chatUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestPayload),
			signal
		});

		if (!response.ok) {
			const { message: errorMsg, code: errorCode } = await parseChatError(response);
			onError?.(errorMsg, errorCode);
			return;
		}

		if (!response.body) {
			onError?.('응답 스트림을 읽을 수 없습니다.');
			return;
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder('utf-8');
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || ''; // 아직 완성되지 않은 마지막 줄은 버퍼에 보관

			let currentEventType = 'message';

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim();
				if (!line) continue;

				if (line.startsWith('event:')) {
					currentEventType = line.slice(6).trim();
				} else if (line.startsWith('data:')) {
					const rawData = line.slice(5).trim();
					try {
						const payload = JSON.parse(rawData);

						switch (currentEventType) {
							case 'status':
								onStatus?.(
									payload.message || '답변을 생각하고 있어요...',
									payload.status,
									payload.tool
								);
								break;

							case 'text_delta': {
								const chunk = payload.content ?? payload.text ?? payload.delta;
								if (chunk !== undefined) {
									onDelta?.(String(chunk));
								}
								break;
							}

							case 'action':
								// 팝업 열기, BGM 제어 등 백엔드 스킬 실행 UI 액션
								onAction?.(payload);
								break;

							case 'done':
								onDone?.(payload);
								break;

							case 'error':
								onError?.(payload.error || payload.message || '답변 생성 중 문제가 발생했습니다.', payload.code);
								break;

							default: {
								// fallback data format
								const fallbackChunk = payload.content ?? payload.text ?? payload.delta;
								if (fallbackChunk !== undefined) {
									onDelta?.(String(fallbackChunk));
								}
								break;
							}
						}
					} catch {
						// JSON 형식이 아닌 일반 텍스트 데이터 청크인 경우
						if (rawData && currentEventType === 'text_delta') {
							onDelta?.(rawData);
						}
					}
					currentEventType = 'message';
				}
			}
		}

		onDone?.();
	} catch (err: any) {
		if (err.name === 'AbortError') {
			console.log('[INDIG AI] 사용자에 의해 스트리밍이 중단되었습니다.');
			return;
		}
		console.error('[INDIG AI] 스트리밍 통신 에러:', err);
		onError?.(
			err.message || '챗봇 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
			err.code || 'SERVICE_UNAVAILABLE'
		);
	}
}
