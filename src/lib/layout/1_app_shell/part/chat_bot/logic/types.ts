import type { ChatActionPayload } from './chatStream';

export type MediaCategory = 'image' | 'audio' | 'video' | 'document' | 'code' | 'other';

export interface ChatAttachment {
	id: string;
	name: string;
	size: number;
	type: string;
	url: string;
	isImage: boolean;
	isAudio?: boolean;
	isVideo?: boolean;
	isDocument?: boolean;
	category: MediaCategory;
	rawFile?: File;
	file_uri?: string;
	media_type?: string;
}

export type AgentStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface AgentStep {
	id: string;
	label: string;
	status: AgentStepStatus;
	/** 실행 중인 단계 아래에 스크롤 표시할 세부 로그 라인 */
	detail?: string[];
	/** 단계 성격 (업로드 · 깊은 생각 · 도구 호출) */
	kind?: 'upload' | 'thinking' | 'tool_calling';
}

export interface ChatMessage {
	id: string;
	role: 'bot' | 'user' | 'system';
	text: string;
	attachments?: ChatAttachment[];
	time?: string;
	isDone?: boolean;
	action?: ChatActionPayload | null;
	/** 깊은 생각 / 도구 호출 시 누적되는 에이전트 단계 목록 */
	steps?: AgentStep[];
	/** true일 때 BotMessage 상단에 AILoadingState 단계 목록 표시 */
	showSteps?: boolean;
	/** 일시적 AI 응답 오류 안내 메시지 여부 (다음 대화 시도 시 자동 제거) */
	isTransientError?: boolean;
	/** 백엔드/딘디 서비스 장애 안내 메시지 여부 (서버 복구 시 자동 제거) */
	isServiceError?: boolean;
}

