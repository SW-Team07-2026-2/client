import type { ChatAttachment, MediaCategory } from './types';

/** 최대 업로드 가능 파일 크기: 20MB (chat-ai 규약) */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export const CHAT_FILE_ACCEPT =
	'image/*,audio/*,video/*,.pdf,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.rtf,.py,.js,.ts,.html,.css,.sh';

/** 파일 크기 가독성 포맷팅 (KB, MB) */
export function formatFileSize(bytes?: number | null): string {
	if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 파일 확장자 추출 헬퍼 (대문자) */
export function getFileExtension(filename?: string | null): string {
	if (!filename || typeof filename !== 'string') return 'FILE';
	const parts = filename.split('.');
	return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
}

/** 백엔드(uploader.py) 규약에 맞춘 미디어 종류 판별 헬퍼 (메타데이터 및 파일명 지원) */
export function detectMediaCategoryFromMeta(
	filename?: string | null,
	mimeType?: string | null
): {
	category: MediaCategory;
	isAllowed: boolean;
	isImage: boolean;
	isAudio: boolean;
	isVideo: boolean;
	isDocument: boolean;
} {
	const name = (filename || '').toLowerCase();
	const type = (mimeType || '').toLowerCase();

	const isImage = type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name);
	const isAudio = type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(name);
	const isVideo = type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(name);

	const isCode =
		/\.(py|js|ts|html|css|sh)$/i.test(name) ||
		type.includes('javascript') ||
		type.includes('python') ||
		type === 'application/x-sh';

	const isDocument =
		type === 'application/pdf' ||
		type === 'application/rtf' ||
		type === 'application/xml' ||
		type === 'application/json' ||
		type.startsWith('text/') ||
		/\.(pdf|txt|md|markdown|csv|tsv|json|xml|rtf)$/i.test(name);

	let category: MediaCategory = 'other';
	if (isImage) category = 'image';
	else if (isAudio) category = 'audio';
	else if (isVideo) category = 'video';
	else if (isCode) category = 'code';
	else if (isDocument) category = 'document';

	const isAllowed = isImage || isAudio || isVideo || isCode || isDocument;

	return {
		category,
		isAllowed,
		isImage,
		isAudio,
		isVideo,
		isDocument: isDocument || isCode
	};
}

export function detectMediaCategory(file: File) {
	return detectMediaCategoryFromMeta(file.name, file.type);
}

/** FileList / File[]를 검증 후 ChatAttachment[]로 변환 */
export function createAttachmentsFromFiles(files: FileList | File[]): ChatAttachment[] {
	const newAttachments: ChatAttachment[] = [];
	for (const file of Array.from(files)) {
		if (file.size > MAX_FILE_SIZE) {
			alert(
				`'${file.name}' 파일의 크기(${formatFileSize(file.size)})가 20MB를 초과하여 첨부할 수 없습니다.`
			);
			continue;
		}

		const media = detectMediaCategory(file);
		if (!media.isAllowed) {
			alert(
				`'${file.name}'은(는) 지원하지 않는 파일 형식입니다.\n이미지, 음원(MP3/WAV/OGG 등), 영상(MP4/MOV/WEBM 등), 문서(PDF/TXT/JSON/코드 등) 파일만 첨부할 수 있습니다.`
			);
			continue;
		}

		const url = URL.createObjectURL(file);
		newAttachments.push({
			id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
			name: file.name,
			size: file.size,
			type: file.type,
			url,
			category: media.category,
			isImage: media.isImage,
			isAudio: media.isAudio,
			isVideo: media.isVideo,
			isDocument: media.isDocument,
			rawFile: file
		});
	}
	return newAttachments;
}

