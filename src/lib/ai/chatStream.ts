/**
 * INDIG AI 실시간 SSE(Server-Sent Events) 스트리밍 및 대화 기록 클라이언트
 * 
 * 백엔드 규약 (프론트엔드용.md 기준):
 * - 기본 URL: http://localhost:8000/chat
 * - GET  /chat : 대화 기록 복원 조회 (첫 방문 시 첫인사 자동 생성되어 반환)
 * - POST /chat : 사용자 질문 전송 및 실시간 SSE 스트리밍
 * 
 * 이벤트 목록:
 * - status     : {"status": "thinking" | "tool_calling", "message": string, "tool"?: string}
 * - text_delta : {"content": string}
 * - action     : {"action": string, ...} (팝업/버튼/BGM 제어 등 UI 액션 신호)
 * - done       : {"status": "completed"}
 * - error      : {"error": string, "code"?: string}
 */

import { auth } from '#lib/auth';

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

export const DEFAULT_CHAT_API_URL = 'http://localhost:8000/chat';

/**
 * 1. 대화 기록 복원 및 첫인사 조회 (GET /chat)
 * - 유저의 기존 대화 기록이 없으면 백엔드가 딘디의 첫인사를 1개 담아 즉시 반환합니다.
 */
export async function fetchChatHistory(
	apiUrl: string = DEFAULT_CHAT_API_URL
): Promise<ChatHistoryResponse> {
	// apiUrl이 /chat/stream 이나 /chat/history로 넘어올 경우 /chat으로 정규화
	const normalizedUrl = apiUrl.replace(/\/chat\/(stream|history)$/, '/chat');

	const headers: Record<string, string> = {};
	if (auth.token) {
		headers['Authorization'] = `Bearer ${auth.token}`;
	}

	const res = await fetch(normalizedUrl, {
		method: 'GET',
		headers,
		credentials: 'include'
	});

	if (res.status === 401) {
		const err = new Error('로그인이 필요하거나 인증 토큰이 만료되었습니다.');
		(err as any).code = 'UNAUTHORIZED';
		(err as any).status = 401;
		throw err;
	}

	if (res.status === 502) {
		const err = new Error('인증 서버 응답이 올바르지 않습니다.');
		(err as any).code = 'BAD_GATEWAY';
		(err as any).status = 502;
		throw err;
	}

	if (res.status === 503) {
		const err = new Error('세션 저장소(Redis) 또는 서비스에 연결할 수 없습니다.');
		(err as any).code = 'SERVICE_UNAVAILABLE';
		(err as any).status = 503;
		throw err;
	}

	if (!res.ok) {
		let detail = `대화 기록을 불러오지 못했습니다. (HTTP ${res.status})`;
		try {
			const data = await res.json();
			if (data.detail) detail = data.detail;
		} catch { }
		const err = new Error(detail);
		(err as any).status = res.status;
		throw err;
	}

	return await res.json();
}

/**
 * 2. 파일 업로드 (POST /chat/upload)
 * - 사용자 첨부파일(PDF, 이미지, 텍스트 등)을 백엔드를 통해 Gemini File API에 임시(48시간) 업로드합니다.
 * - 반환된 file_uri, file_name, media_type을 streamAIChat의 attachments에 담아 전송합니다.
 */
export async function uploadChatFile(
	file: File,
	apiUrl: string = DEFAULT_CHAT_API_URL
): Promise<ChatUploadAttachment> {
	const uploadUrl = apiUrl.replace(/\/chat(\/(stream|history|upload))?$/, '/chat/upload');

	const formData = new FormData();
	formData.append('file', file);

	const headers: Record<string, string> = {};
	if (auth.token) {
		headers['Authorization'] = `Bearer ${auth.token}`;
	}

	const res = await fetch(uploadUrl, {
		method: 'POST',
		headers,
		credentials: 'include',
		body: formData
	});

	if (res.status === 401) {
		const err = new Error('로그인이 필요하거나 인증 토큰이 만료되었습니다.');
		(err as any).code = 'UNAUTHORIZED';
		(err as any).status = 401;
		throw err;
	}

	if (res.status === 422) {
		const err = new Error('업로드할 파일 형식이 올바르지 않거나 크기가 20MB를 초과했습니다.');
		(err as any).code = 'UNPROCESSABLE_ENTITY';
		(err as any).status = 422;
		throw err;
	}

	if (res.status === 502) {
		const err = new Error('인증 서버 응답이 올바르지 않습니다.');
		(err as any).code = 'BAD_GATEWAY';
		(err as any).status = 502;
		throw err;
	}

	if (res.status === 503) {
		const err = new Error('세션 저장소(Redis) 또는 서비스에 연결할 수 없습니다.');
		(err as any).code = 'SERVICE_UNAVAILABLE';
		(err as any).status = 503;
		throw err;
	}

	if (!res.ok) {
		let detail = `파일 업로드에 실패했습니다. (HTTP ${res.status})`;
		try {
			const data = await res.json();
			if (data.detail) detail = data.detail;
		} catch { }
		const err = new Error(detail);
		(err as any).status = res.status;
		throw err;
	}

	const data = await res.json();
	return {
		file_uri: data.file_uri || data.url,
		file_name: data.file_name || data.name || file.name,
		media_type: data.media_type || data.type || file.type,
		url: data.url,
		name: data.name,
		type: data.type
	};
}

/**
 * 3. 질문 전송 및 실시간 SSE 스트리밍 (POST /chat)
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
	const normalizedUrl = apiUrl.replace(/\/chat(\/(stream|history|upload))?$/, '/chat');

	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (auth.token) {
			headers['Authorization'] = `Bearer ${auth.token}`;
		}

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
				file_uri: att.file_uri,
				file_name: att.file_name,
				media_type: att.media_type
			}));
		}

		const response = await fetch(normalizedUrl, {
			method: 'POST',
			headers,
			credentials: 'include',
			body: JSON.stringify(requestPayload),
			signal
		});

		if (!response.ok) {
			let errorMsg = `서버 응답 오류 (HTTP ${response.status})`;
			let errorCode: string | undefined = undefined;

			try {
				const errJson = await response.json();
				if (errJson.detail) errorMsg = errJson.detail;
				if (errJson.code) errorCode = errJson.code;
			} catch { }

			if (response.status === 401) {
				errorMsg = '로그인이 필요하거나 인증 토큰이 만료되었습니다.';
				errorCode = 'UNAUTHORIZED';
			} else if (response.status === 422) {
				errorMsg = '요청 데이터 형식이 올바르지 않습니다.';
				errorCode = 'UNPROCESSABLE_ENTITY';
			} else if (response.status === 502) {
				errorMsg = '인증 서버 응답이 올바르지 않습니다.';
				errorCode = 'BAD_GATEWAY';
			} else if (response.status === 503) {
				errorMsg = errorMsg || '세션 저장소(Redis) 또는 서비스에 연결할 수 없습니다.';
				errorCode = errorCode || 'SERVICE_UNAVAILABLE';
			}

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

							case 'text_delta':
								if (payload.content !== undefined) {
									onDelta?.(payload.content);
								}
								break;

							case 'action':
								// 팝업 열기, BGM 제어 등 백엔드 스킬 실행 UI 액션
								onAction?.(payload);
								break;

							case 'done':
								onDone?.(payload);
								break;

							case 'error':
								onError?.(payload.error || '답변 생성 중 문제가 발생했습니다.', payload.code);
								break;

							default:
								// fallback data format
								if (payload.content) {
									onDelta?.(payload.content);
								}
								break;
						}
					} catch (parseErr) {
						console.warn('[INDIG AI] SSE JSON 파싱 오류:', rawData);
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
		onError?.(err.message || '네트워크 연결 상태를 확인해 주세요.');
		throw err;
	}
}
