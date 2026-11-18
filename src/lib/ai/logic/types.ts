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

export interface ChatMessage {
	id: string;
	role: 'bot' | 'user' | 'system';
	text: string;
	attachments?: ChatAttachment[];
	time?: string;
	isDone?: boolean;
	action?: ChatActionPayload | null;
}

