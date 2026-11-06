<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import Bot, { type BotState } from './Bot.svelte';
	import FdInput from '#lib/components/FdInput.svelte';
	import {
		streamAIChat,
		fetchChatHistory,
		uploadChatFile,
		DEFAULT_CHAT_API_URL,
		type ChatActionPayload,
		type ChatUploadAttachment
	} from './chatStream';
	import { auth } from '#lib/auth';
	import { bgm } from '#lib/audio';

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

	interface Props {
		/** 채팅창 열림 여부 (양방향 바인딩 가능) */
		open?: boolean;
		/** 봇의 현재 상태 연동 (thinking, talking 등 자동 반영) */
		botState?: BotState;
		/** 닫기 이벤트 핸들러 */
		onClose?: () => void;
		/** 메시지 전송 시 비동기 응답 처리 핸들러 (생략 시 실시간 백엔드 SSE 스트리밍) */
		onSend?: (
			userMessage: string,
			attachments?: ChatAttachment[]
		) => Promise<string | void> | string | void;
		/** AI 챗봇 백엔드 스트리밍 엔드포인트 URL (기본값: http://localhost:8000/chat) */
		apiUrl?: string;
		/** 유저 식별자 (기본값: guest_user) */
		userId?: string;
		/** 봇 이름 */
		botName?: string;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		open = $bindable(false),
		botState = $bindable('idle'),
		onClose,
		onSend,
		apiUrl = DEFAULT_CHAT_API_URL,
		userId = 'guest_user',
		botName = '딘디 (Dindi)',
		class: className = ''
	}: Props = $props();

	// 봇 크기 상수: 닫혔을 때는 80px, 열렸을 때는 56px(0.70x)로 크고 선명하게 안착!
	const BOT_HOME_SIZE = 80;
	const BOT_DOCK_SIZE = 56;
	const BOT_SCALE_RATIO = BOT_DOCK_SIZE / BOT_HOME_SIZE; // 0.70

	let botRef: any = $state(null);
	let panelEl: HTMLDivElement | null = $state(null);
	let messageContainerEl: HTMLDivElement | null = $state(null);
	let chatInputEl: HTMLInputElement | undefined = $state(undefined);

	// 봇 비행 위치 transform 상태 (CSS translate3d + scale)
	let botFlyTransform = $state('translate3d(0, 0, 0) scale(1)');

	// 시간 포맷 헬퍼 (오전/오후 HH:MM)
	function getCurrentTime(): string {
		const now = new Date();
		const hours = now.getHours();
		const minutes = now.getMinutes().toString().padStart(2, '0');
		const period = hours >= 12 ? '오후' : '오전';
		const formattedHours = hours % 12 || 12;
		return `${period} ${formattedHours}:${minutes}`;
	}

	/**
	 * 안전하고 강력한 인라인/블록 마크다운 파서 (GFM 완벽 지원)
	 */
	function renderMarkdown(content: string): string {
		if (!content) return '';

		// 1. 코드 블록(```) 임시 보호 (코드 블록 안의 기호들이 마크다운으로 파싱되지 않도록)
		const codeBlocks: string[] = [];
		let html = content.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
			const idx = codeBlocks.length;
			const safeCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			codeBlocks.push(
				`<pre class="md-code-block" data-lang="${lang || ''}"><code>${safeCode.trim()}</code></pre>`
			);
			return `%%CODEBLOCK_${idx}%%`;
		});

		// 2. 인라인 코드(`...`) 임시 보호
		const inlineCodes: string[] = [];
		html = html.replace(/`([^`\n]+)`/g, (_, code) => {
			const idx = inlineCodes.length;
			const safeCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			inlineCodes.push(`<code class="md-inline-code">${safeCode}</code>`);
			return `%%INLINECODE_${idx}%%`;
		});

		// 3. HTML 특수문자 기본 이스케이프 (&, <만 이스케이프하여 > 인용구 지원)
		html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;');

		// 4. 테이블(Table) 파싱 (| th | th | \n | --- | --- | \n | td | td |)
		html = html.replace(/((?:^[ \t]*\|.+\|[ \t]*(?:\r?\n|$))+)/gm, (match) => {
			const lines = match
				.trim()
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter(Boolean);
			if (lines.length < 2) return match;

			// 2번째 줄이 구분선인지 확인
			const sep = lines[1];
			if (!/^[|:\-\s]+$/.test(sep) || !sep.includes('-')) {
				return match;
			}

			const parseRow = (line: string) =>
				line
					.replace(/^\|/, '')
					.replace(/\|$/, '')
					.split('|')
					.map((c) => c.trim());

			const headers = parseRow(lines[0]);
			const alignments = parseRow(sep).map((col) => {
				const left = col.startsWith(':');
				const right = col.endsWith(':');
				if (left && right) return 'center';
				if (right) return 'right';
				return 'left';
			});

			const thead = `<thead><tr>${headers
				.map((h, i) => `<th style="text-align: ${alignments[i] || 'left'}">${h}</th>`)
				.join('')}</tr></thead>`;

			const tbody = `<tbody>${lines
				.slice(2)
				.map((row) => {
					const cells = parseRow(row);
					return `<tr>${cells
						.map((c, i) => `<td style="text-align: ${alignments[i] || 'left'}">${c}</td>`)
						.join('')}</tr>`;
				})
				.join('')}</tbody>`;

			return `<div class="md-table-wrap"><table class="md-table">${thead}${tbody}</table></div>\n\n`;
		});

		// 5. 수평선 (---, ***, ___)
		html = html.replace(/^(?:[-*_]){3,}\s*$/gm, '<hr class="md-hr" />\n\n');

		// 6. 인용구 (> quote) - 다중 라인 연속 지원
		html = html.replace(/^(?:(?:>|&gt;)[ \t]*.+(?:\r?\n|$))+/gm, (match) => {
			const lines = match
				.trim()
				.split(/\r?\n/)
				.map((l) => l.replace(/^(?:>|&gt;)[ \t]*/, ''))
				.join('<br/>');
			return `<blockquote class="md-quote">${lines}</blockquote>\n\n`;
		});

		// 7. 헤딩 (#, ##, ###, ####)
		html = html.replace(/^####\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>\n\n');
		html = html.replace(/^###\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>\n\n');
		html = html.replace(/^##\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>\n\n');
		html = html.replace(/^#\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>\n\n');

		// 8. 태스크 리스트 (- [ ] 또는 - [x])
		html = html.replace(/^(?:[-*+]\s+\[([ xX])\]\s+(.+)(?:\r?\n|$))+/gm, (match) => {
			const items = match
				.trim()
				.split(/\r?\n/)
				.map((line) => {
					const checked = /\[[xX]\]/.test(line);
					const text = line.replace(/^[-*+]\s+\[([ xX])\]\s+/, '');
					return `<li class="md-task-item"><span class="md-checkbox ${checked ? 'checked' : ''}">${checked ? '✓' : ''}</span><span>${text}</span></li>`;
				})
				.join('');
			return `<ul class="md-list md-task-list">${items}</ul>\n\n`;
		});

		// 9. 불릿 리스트 (- item, * item, + item)
		html = html.replace(/^(?:[-*+]\s+(?!\[[ xX]\]).+(?:\r?\n|$))+/gm, (match) => {
			const items = match
				.trim()
				.split(/\r?\n/)
				.map((line) => `<li>${line.replace(/^[-*+]\s+/, '')}</li>`)
				.join('');
			return `<ul class="md-list">${items}</ul>\n\n`;
		});

		// 10. 순서 있는 리스트 (1. item)
		html = html.replace(/^(?:\d+\.\s+.+(?:\r?\n|$))+/gm, (match) => {
			const items = match
				.trim()
				.split(/\r?\n/)
				.map((line) => `<li>${line.replace(/^\d+\.\s+/, '')}</li>`)
				.join('');
			return `<ol class="md-ol">${items}</ol>\n\n`;
		});

		// 11. 인라인 스타일 (취소선, 볼드, 이탤릭, 링크)
		// 취소선: ~~text~~
		html = html.replace(/~~([^~]+)~~/g, '<del class="md-del">$1</del>');

		// 볼드: **text** 또는 __text__
		html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

		// 이탤릭: *text* 또는 _text_
		html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
		html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

		// 링크: [text](url)
		html = html.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2" class="md-link" target="_self">$1</a>'
		);

		// 12. 단락(Paragraphs) 처리
		const paragraphs = html.split(/\n\s*\n/);
		let finalHtml = paragraphs
			.map((p) => {
				const trimmed = p.trim();
				if (!trimmed) return '';
				if (
					trimmed.startsWith('<h') ||
					trimmed.startsWith('<pre') ||
					trimmed.startsWith('<ul') ||
					trimmed.startsWith('<ol') ||
					trimmed.startsWith('<blockquote') ||
					trimmed.startsWith('<hr') ||
					trimmed.startsWith('<div class="md-table-wrap"')
				) {
					return trimmed;
				}
				return `<p class="md-p">${trimmed.replace(/\n/g, '<br/>')}</p>`;
			})
			.filter(Boolean)
			.join('');

		// 13. 보호해 둔 코드 블록 및 인라인 코드 복원
		codeBlocks.forEach((cb, idx) => {
			finalHtml = finalHtml.replace(`%%CODEBLOCK_${idx}%%`, cb);
		});
		inlineCodes.forEach((ic, idx) => {
			finalHtml = finalHtml.replace(`%%INLINECODE_${idx}%%`, ic);
		});

		return finalHtml;
	}

	// 기본 대화 내역 (최초 진입 시 백엔드 동적 첫인사 수신 전 빈 배열로 시작)
	let messages = $state<ChatMessage[]>([]);
	let hasInitiatedGreeting = $state(false);
	let isHistoryLoaded = $state(false);
	let hasTruncatedNotice = $state(false); // 단기 기억 20개 초과 시 최상단 안내 여부
	let isServiceUnavailable = $state(false); // 서버 세션(Redis) 장애 또는 503 상태 감지 여부
	let serviceErrorMessage = $state<string | null>(null);
	let isAuthRequired = $state(false); // 401 로그인 인증 필요 상태
	let showTestPopup = $state(false); // 백엔드 action: "test_popup" 연동 모달
	let activeActionData = $state<ChatActionPayload | null>(null);

	let inputText = $state('');
	let isGenerating = $state(false);
	// 백엔드 실시간 SSE 스트리밍 상태 안내 텍스트 (예: "취향 정보를 확인하고 있어요... 💭")
	let currentStatus = $state<string | null>(null);
	let abortCtrl: AbortController | null = null;

	// 상태 문구 끝의 기존 온점(.)을 제거하여 동적 점(. -> .. -> ...)과 중복되지 않도록 함
	function cleanStatusText(text: string): string {
		return text.replace(/\.+$/, '').trim();
	}

	// 봇 상태 문구 뒤의 점 개수 순환 (. -> .. -> ... -> .)
	let dotCount = $state(1);
	const animatedDots = $derived('.'.repeat(dotCount));

	$effect(() => {
		if (isGenerating && currentStatus) {
			const timer = setInterval(() => {
				dotCount = (dotCount % 3) + 1; // 1 -> 2 -> 3 -> 1 ...
			}, 400);
			return () => clearInterval(timer);
		} else {
			dotCount = 1;
		}
	});

	// 파일/이미지 첨부 상태
	let attachedFiles = $state<ChatAttachment[]>([]);
	let isDraggingOver = $state(false);
	let fileInputEl: HTMLInputElement | undefined = $state(undefined);
	let dragCounter = 0;

	// 파일 크기 가독성 포맷팅 (KB, MB)
	function formatFileSize(bytes?: number | null): string {
		if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	// 파일 확장자 추출 헬퍼 (대문자)
	function getFileExtension(filename?: string | null): string {
		if (!filename || typeof filename !== 'string') return 'FILE';
		const parts = filename.split('.');
		return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
	}

	// 최대 업로드 가능 파일 크기: 20MB (chat-ai 규약)
	const MAX_FILE_SIZE = 20 * 1024 * 1024;

	// 백엔드(uploader.py) 규약에 맞춘 미디어 종류 판별 헬퍼 (메타데이터 및 파일명 지원)
	function detectMediaCategoryFromMeta(filename?: string | null, mimeType?: string | null): {
		category: MediaCategory;
		isAllowed: boolean;
		isImage: boolean;
		isAudio: boolean;
		isVideo: boolean;
		isDocument: boolean;
	} {
		const name = (filename || '').toLowerCase();
		const type = (mimeType || '').toLowerCase();

		const isImage =
			type.startsWith('image/') ||
			/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name);

		const isAudio =
			type.startsWith('audio/') ||
			/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(name);

		const isVideo =
			type.startsWith('video/') ||
			/\.(mp4|webm|mov|avi)$/i.test(name);

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

	function detectMediaCategory(file: File) {
		return detectMediaCategoryFromMeta(file.name, file.type);
	}

	// 파일 목록 추가 처리
	function handleFiles(files: FileList | File[]) {
		const newAttachments: ChatAttachment[] = [];
		for (const file of Array.from(files)) {
			if (file.size > MAX_FILE_SIZE) {
				alert(`'${file.name}' 파일의 크기(${formatFileSize(file.size)})가 20MB를 초과하여 첨부할 수 없습니다.`);
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
		attachedFiles = [...attachedFiles, ...newAttachments];
	}

	// 첨부 파일 개별 삭제
	function removeAttachment(id: string) {
		const target = attachedFiles.find((a) => a.id === id);
		if (target) {
			URL.revokeObjectURL(target.url);
		}
		attachedFiles = attachedFiles.filter((a) => a.id !== id);
	}

	// 파일 인풋 change 이벤트 핸들러
	function handleFileInputChange(e: Event & { currentTarget: HTMLInputElement }) {
		if (e.currentTarget.files && e.currentTarget.files.length > 0) {
			handleFiles(e.currentTarget.files);
			e.currentTarget.value = '';
		}
	}

	// 드래그 앤 드롭 핸들러 (드래그 카운터 패턴으로 자식 깜빡임 방지)
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
			isDraggingOver = true;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
		isDraggingOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter <= 0) {
			dragCounter = 0;
			isDraggingOver = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter = 0;
		isDraggingOver = false;

		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			handleFiles(e.dataTransfer.files);
		}
	}

	// 클립보드 붙여넣기 (스크린샷 이미지 Ctrl+V 지원)
	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];
		for (let i = 0; i < items.length; i++) {
			if (items[i].kind === 'file') {
				const file = items[i].getAsFile();
				if (file) files.push(file);
			}
		}

		if (files.length > 0) {
			e.preventDefault();
			handleFiles(files);
		}
	}

	// 최대 300자 입력 제한
	$effect(() => {
		if (inputText.length > 300) {
			inputText = inputText.slice(0, 300);
		}
	});

	// 빠른 질문 추천 칩 목록 (백엔드 스킬 및 인디 추천 연동)
	const quickSuggestions = [
		'🎸 이번 주 홍대 인디 공연 추천해줘',
		'🔇 BGM 꺼줘',
		'🎫 테스트 팝업 띄워줘',
		'💭 내 음악 취향 검색해줘'
	];

	// 봇 비행 위치 정밀 계산 (우측 하단 홈 <-> 상단 헤더 도크)
	function updateBotPosition() {
		if (!open) {
			// 닫힌 상태: 우측 하단 홈 자리에 80px(scale 1.0)로 안착
			botFlyTransform = 'translate3d(0, 0, 0) scale(1)';
			return;
		}

		const isMobile = window.innerWidth <= 640;

		if (!isMobile) {
			// 데스크톱:
			const panelW = panelEl?.offsetWidth || 390;
			const panelH = panelEl?.offsetHeight || 610;

			// 도크 중심: (left 16 + 28 = 44px, top 12 + 28 = 40px)
			// 홈 중심: (panelW - 40px, panelH - 40px)
			const dx = 44 - (panelW - 40);
			const dy = 40 - (panelH - 40);

			botFlyTransform = `translate3d(${dx}px, ${dy}px, 0) scale(${BOT_SCALE_RATIO})`;
		} else {
			// 모바일: 하단 바텀 시트 (height: 85dvh)
			const vh = window.innerHeight;
			const panelH = vh * 0.85;

			const dx = 44 - (window.innerWidth - 56);
			const dy = vh - panelH + 40 - (vh - 104);

			botFlyTransform = `translate3d(${dx}px, ${dy}px, 0) scale(${BOT_SCALE_RATIO})`;
		}
	}

	$effect(() => {
		const isOpen = open;
		tick().then(updateBotPosition);
	});

	// 챗봇 창이 열렸을 때 대화 기록 및 첫인사 복원 (GET /chat)
	$effect(() => {
		if (open && !hasInitiatedGreeting) {
			loadChatHistory();
		}
	});

	// 로그인 상태가 변경되었을 때 대화 기록 다시 로드
	$effect(() => {
		const token = auth.token;
		if (token && isAuthRequired) {
			loadChatHistory();
		}
	});

	// 대화창이 열리거나 대화 목록이 복원/추가될 때 최신 대화(최하단) 위치 보장
	$effect(() => {
		if (open && messages.length > 0) {
			// 모핑 트랜지션(0.52s)과 마크다운 렌더링에 맞춰 다단계로 바닥 스크롤 보정
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

	// 서버 서비스 장애(Redis 연결 실패 또는 503 등) 처리
	function handleServiceError(errMsg?: string, errCode?: string) {
		isServiceUnavailable = true;
		serviceErrorMessage =
			errMsg ||
			(errCode === 'REDIS_UNAVAILABLE'
				? '세션 저장소(Redis)에 연결할 수 없습니다. 서비스 상태를 확인해 주세요.'
				: '챗봇 서비스(Redis 또는 서버)가 일시적으로 불안정합니다.');
		botState = 'sleepy'; // 시무룩한 표정으로 멈춤
		isGenerating = false;
		currentStatus = null;
		scrollToBottom();
	}

	// 서비스 장애 상태에서 수동 재연결 시도
	async function handleRetryConnection() {
		isServiceUnavailable = false;
		serviceErrorMessage = null;
		hasInitiatedGreeting = false;
		botState = 'thinking';
		await loadChatHistory();
	}

	/** 대화 기록 복원 및 첫인사 조회 (GET /chat) */
	async function loadChatHistory() {
		try {
			isServiceUnavailable = false;
			serviceErrorMessage = null;
			isAuthRequired = false;

			const data = await fetchChatHistory(apiUrl);

			if (data && Array.isArray(data.messages)) {
				messages = data.messages.map((m: any, mIdx: number) => {
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

					return {
						...m,
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
			if (err?.code === 'UNAUTHORIZED' || err?.status === 401) {
				isAuthRequired = true;
			} else if (
				err?.code === 'SERVICE_UNAVAILABLE' ||
				err?.status === 503 ||
				err?.code === 'BAD_GATEWAY' ||
				err?.status === 502
			) {
				handleServiceError(err.message, err.code);
			} else {
				// 백엔드 연결 불가
				handleServiceError(
					'챗봇 서비스(Redis 또는 서버)에 연결할 수 없습니다. 서비스 상태를 확인해 주세요.',
					'SERVICE_UNAVAILABLE'
				);
			}
		} finally {
			isHistoryLoaded = true;
		}
	}

	/** 대화 기록 초기화 (새 대화 시작) */
	export async function clearChatHistory(): Promise<boolean> {
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

		// 초기 마운트 시 대화 기록 로드
		loadChatHistory();

		return () => window.removeEventListener('resize', handleResize);
	});

	// 봇 클릭 인터랙션
	function handleBotClick() {
		if (!open) {
			// 닫혀 있을 때 클릭: 윙크하며 원에서 사각형으로 촥 펼쳐짐!
			open = true;
			botRef?.wink('right');
			botState = 'happy';
			setTimeout(() => {
				if (botState === 'happy') botState = 'idle';
			}, 1000);
			// 창 열릴 때 최신 대화(바닥)로 확실하게 이동
			scrollToBottom(false);
			setTimeout(() => scrollToBottom(false), 120);
			setTimeout(() => scrollToBottom(false), 450);
		} else {
			// 열려 있을 때 상단 헤더의 봇 클릭: 반갑게 윙크 & 미소 반응!
			botRef?.wink('left');
			botState = 'happy';
			setTimeout(() => {
				if (botState === 'happy') botState = 'idle';
			}, 1000);
		}
	}

	// 스크롤 최하단 이동 (부드러운 스크롤 or 즉시 이동)
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

	// 챗봇 내부 카카오 로그인 유도 핸들러
	async function handleKakaoLoginInChat() {
		const success = await auth.login();
		if (success) {
			isAuthRequired = false;
			await loadChatHistory();
		} else {
			alert('로그인에 실패했습니다. Mock 서버 상태를 확인해 주세요.');
		}
	}

	// AI 액션 이벤트 클릭 핸들러 (팝업, BGM 등)
	function handleActionClick(action: ChatActionPayload) {
		activeActionData = action;
		if (action.action === 'test_popup') {
			showTestPopup = true;
		} else if (action.action === 'stop_bgm') {
			bgm.pause();
		} else if (action.action === 'start_bgm') {
			bgm.play();
		}
	}

	// 텍스트 및 파일 전송 처리 (실시간 SSE 스트리밍 연동)
	async function handleSendMessage(textToSend?: string, keepFocus = false) {
		let text = (textToSend ?? inputText).trim();
		const currentAttachments = [...attachedFiles];

		// 텍스트와 첨부파일이 모두 없거나 생성 중이면 전송 안 함
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

		// 3. 봇 상태를 'thinking'으로 전환 및 초기 안내 텍스트 세팅
		botState = 'thinking';
		isGenerating = true;
		currentStatus = '답변을 생각하고 있어요...';
		await scrollToBottom();

		// 이전 스트리밍 요청 취소 후 새 컨트롤러 생성
		if (abortCtrl) {
			abortCtrl.abort();
		}
		abortCtrl = new AbortController();

		let accumulatedText = '';
		let pendingAction: ChatActionPayload | null = null;

		try {
			if (onSend) {
				// 외부 커스텀 핸들러가 제공된 경우 우선 실행
				const replyText = await onSend(text, currentAttachments);
				if (replyText) {
					botState = 'talking';
					currentStatus = null;
					messages = messages.map((m) =>
						m.id === botMsgId
							? {
									...m,
									text: replyText,
									time: getCurrentTime(),
									isDone: true
								}
							: m
					);
					await scrollToBottom();
					await new Promise((r) => setTimeout(r, 2600));
				} else {
					botState = 'idle';
				}
			} else {
				// 실시간 백엔드 SSE 스트리밍 실행 (POST http://localhost:8000/chat)
				try {
					let uploadedAttachments: ChatUploadAttachment[] = [];

					// 1) 첨부 파일이 있을 경우 백엔드 임시 보관 업로드 (POST /chat/upload)
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
						uploadedAttachments = results.filter(
							(item): item is ChatUploadAttachment => item !== null
						);

						// 업로드 완료 후 상태 안내 문구 복원
						currentStatus = '답변을 생각하고 있어요...';
					}

					// 2) 실시간 SSE 질문 전송 및 스트리밍 (POST /chat)
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
							// 첫 텍스트 청크가 오면 생각 중 문구를 숨기고 실시간 말하기 모드로 전환!
							if (currentStatus) currentStatus = null;
							if (isServiceUnavailable) {
								isServiceUnavailable = false;
								serviceErrorMessage = null;
							}
							botState = 'talking';
							accumulatedText += chunk;

							messages = messages.map((m) =>
								m.id === botMsgId ? { ...m, text: accumulatedText } : m
							);
							scrollToBottom(false);
						},
						onAction: (action) => {
							// BGM 즉시 제어 및 액션 보관
							if (action.action === 'stop_bgm') {
								bgm.pause();
							} else if (action.action === 'start_bgm') {
								bgm.play();
							}
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
							if (errCode === 'UNAUTHORIZED') {
								isAuthRequired = true;
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
					// 업로드 또는 통신 중 인증 오류 발생 시
					if (networkErr?.status === 401 || networkErr?.code === 'UNAUTHORIZED') {
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

					// 업로드 중 422, 502, 503 등 명시적 HTTP 오류 발생 시
					if (networkErr?.status && networkErr.status >= 400 && networkErr.status < 600) {
						currentStatus = null;
						botState = 'idle';
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

					// 백엔드 서버(http://localhost:8000)가 아직 켜져 있지 않을 경우 로컬 모의 가이드로 부드럽게 폴백
					// 백엔드 서버(http://localhost:8000)가 아직 켜져 있지 않을 경우 로컬 모의 가이드로 부드럽게 폴백
					console.warn(
						'[BotArea] 백엔드 서버(localhost:8000) 연결 불가. 모의 응답 모드로 폴백합니다:',
						networkErr?.message
					);
					currentStatus = '인디 가이드 응답을 준비하고 있어요...';
					await new Promise((r) => setTimeout(r, 900));

					let fallbackText = '';
					if (currentAttachments.some((a) => a.isAudio)) {
						const audioAtt = currentAttachments.find((a) => a.isAudio)!;
						fallbackText = `보내주신 음원 **${audioAtt.name}**을 확인했습니다! 🎵\n\n데모 곡의 편곡 방향, 멜로디 톤앤매너, 사운드 믹스, 또는 이 곡과 결이 닮은 인디 아티스트 추천이 필요하시면 편하게 물어보세요! 🎧`;
					} else if (currentAttachments.some((a) => a.isVideo)) {
						const videoAtt = currentAttachments.find((a) => a.isVideo)!;
						fallbackText = `보내주신 영상 **${videoAtt.name}**을 확인했습니다! 🎬\n\n라이브 클럽 공연, 합주실 연주 클립의 사운드와 무대 분위기에 대해 궁금하신 점이 있다면 언제든 편하게 말씀해 주세요! 🎸`;
					} else if (currentAttachments.some((a) => a.isImage)) {
						fallbackText = `보내주신 이미지를 확인했습니다! 🎨\n\n앨범 커버 아트워크나 바이닐 음반, 라이브 공연 포스터와 관련된 내용이 궁금하시면 편하게 말씀해 주세요. 이미지 속 분위기에 어울리는 인디 밴드와 대표곡도 추천해 드릴 수 있어요! 🎧`;
					} else if (currentAttachments.length > 0) {
						fallbackText = `**${currentAttachments[0].name}** 파일을 확인했습니다. 📁\n\n해당 파일과 관련된 궁금한 점이나 추천받고 싶은 인디 음악이 있다면 언제든 편하게 물어보세요! 😊`;
					} else if (text.includes('밴드') || text.includes('아티스트') || text.includes('추천')) {
						fallbackText = `요즘 인디 씬에서 독보적인 사운드로 주목받는 아티스트들을 추천해 드릴게요!\n\n- **실리카겔 (Silica Gel)**: 실험적이면서도 폭발적인 사이키델릭 록 사운드\n- **검정치마 (The Black Skirts)**: 가슴을 울리는 특유의 멜로디와 독보적인 감성 노랫말\n- **우효 (OOHYO)**: 맑고 몽환적인 신스팝의 정수\n\n더 많은 밴드의 바이오그래피와 대표곡은 [아티스트 탭](/artist)에서 바로 감상하실 수 있어요. 🎧`;
					} else if (text.includes('공연') || text.includes('주말') || text.includes('라이브')) {
						fallbackText = `이번 주말에는 홍대 라이브 클럽 데이와 소극장에서 특별한 무대들이 준비되어 있어요!\n\n1. **클럽 롤링홀**: 인디 록 루키 스테이지 (토요일 18:00)\n2. **KT&amp;G 상상마당 라이브홀**: 어쿠스틱 나이트 기획 공연\n3. **벨로주 홍대**: 싱어송라이터 특별 기획전\n\n상세 타임테이블과 티켓 예매 일정은 [공연 탭](/concert)에서 실시간으로 확인해보세요! 🎪`;
					} else if (
						text.includes('LP') ||
						text.includes('음반') ||
						text.includes('새벽') ||
						text.includes('비')
					) {
						fallbackText = `비 내리는 잔잔한 새벽엔 아날로그 바이닐 특유의 따뜻한 사운드가 제격이죠. 💿\n\n> "어둠이 내리면 음악은 더욱 짙어진다."\n\n- **잔나비 - [전설]** LP (노스텔지어 가득한 빈티지 록 발라드)\n- **백예린 - [Every letter I sent you.]** 바이닐 (깊고 우아한 재즈 &amp; R&amp;B 무드)\n- **빛과 소금 - [Re:Issue]** 리마스터 LP\n\n[음반∙LP 탭](/album)에서 컬렉터 한정판 바이닐 소식도 둘러보세요! ✨`;
					} else {
						fallbackText = `흥미로운 이야기네요! **INDIG**는 아티스트와 음악 팬이 함께 숨 쉬고 아카이빙하는 공간입니다.\n\n취향에 맞는 아티스트, 공연 정보, 바이닐 음반 등 궁금한 점이 있다면 언제든 편하게 물어보세요! 😊`;
					}

					currentStatus = null;
					botState = 'talking';
					messages = [
						...messages,
						{
							id: 'bot-' + Date.now(),
							role: 'bot',
							text: fallbackText,
							time: getCurrentTime()
						}
					];
					await scrollToBottom();
					await new Promise((r) => setTimeout(r, 2600));
				}
			}
		} catch (err: any) {
			console.error('[BotArea] 처리 중 예외 발생:', err);
			messages = [
				...messages,
				{
					id: 'error-' + Date.now(),
					role: 'bot',
					text: '일시적인 오류가 발생했습니다. 잠시 후 다시 말씀해 주세요.',
					time: getCurrentTime()
				}
			];
		} finally {
			isGenerating = false;
			currentStatus = null;
			if (!isServiceUnavailable) {
				botState = 'idle';
			}
			await scrollToBottom();
		}
	}

	// 입력창 전용 키다운 핸들러 (입력창에서 엔터 눌렀을 때만 포커스 유지)
	function handleInputKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			if (e.isComposing) return;
			e.preventDefault();
			handleSendMessage(undefined, true);
		} else if (e.key === 'Escape') {
			handleClose();
		}
	}

	function handleClose() {
		open = false;
		onClose?.();
	}
</script>

<!-- 모바일 배경 어두운 딤 (터치 시 닫기) -->
{#if open}
	<div
		class="bot-area-backdrop sm:hidden"
		onclick={handleClose}
		transition:fade={{ duration: 250 }}
		role="presentation"
	></div>
{/if}

<!--
  BotArea 루트 컨테이너:
  - 1. 모핑 패널: CSS clip-path inset을 사용하여 우측 하단 정확한 80px 정원(Circle)에서
       사방/위/왼쪽으로 펼쳐지며 둥근 사각형(Rounded Rect)으로 진짜 형태 변형(Morphing) 구현!
  - 2. 내부 내용물: 창이 펼쳐지는 동안 투명(opacity: 0)을 유지하다가, 둥근 사각형이 거의 완성된 시점에
       부드럽게 페이드인되어 가장자리 내용물이 잘리는 현상 100% 원천 차단!
  - 3. 독립 봇 액터(Bot.svelte): 항상 최상단 레이어(z-index: 60)에서 스르륵 비행하여 단 1프레임도 가려지지 않음!
-->
<div class="bot-area-root {className}">
	<!-- 1. 대화창 본체 (정원 -> 사각형 clip-path 모핑 패널) -->
	<div
		bind:this={panelEl}
		class="morph-chat-panel"
		class:is-open={open}
		role="dialog"
		aria-label="{botName} 대화창"
		aria-modal="true"
	>
		<!-- 
		  내부 내용물 래퍼:
		  - 닫혀 있거나 창이 펼쳐지는 동안 완전 투명(opacity: 0) 유지!
		  - 창이 둥근 사각형으로 다 펼쳐질 때 부드럽게 페이드인되어 잘림 현상 완전 방지!
		  - 닫힐 때는 먼저 빠르게 슉 사라진 후 빈 글래스 껍질이 정원으로 축소!
		-->
		<div class="panel-inner-content" class:visible={open}>
			<!-- (1) 상단 헤더 -->
			<header class="chat-header">
				<!-- 날아온 봇이 안착하는 56px 도크 자리 확보 -->
				<div class="bot-dock-slot" aria-hidden="true"></div>

				<!-- 봇 이름 -->
				<div class="bot-header-info">
					<span class="bot-title">{botName}</span>
				</div>

				<!-- 닫기 버튼 -->
				<button type="button" class="chat-close-btn" onclick={handleClose} aria-label="대화창 닫기">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</header>

			<!-- (2) 메시지 스크롤 영역 (AI는 말풍선 박스 없이 마크다운, 유저는 둥근 연회색 캡슐) -->
			<div bind:this={messageContainerEl} class="chat-messages-area">
				{#if hasTruncatedNotice}
					<div class="truncated-history-notice" in:fade={{ duration: 150 }}>
						<span class="notice-text">최근 대화는 최대 20개까지확인할 수 있습니다.</span>
					</div>
				{/if}

				{#each messages as msg (msg.id)}
					<div class="message-row {msg.role}">
						{#if msg.role === 'user'}
							<!-- 유저 메시지: 참고 이미지 스타일의 알약 캡슐 말풍선 (#e5e7eb 배경 + 다크 텍스트) -->
							<div class="user-bubble-wrap">
								{#if msg.attachments && msg.attachments.length > 0}
									<div class="user-attachments-grid">
										{#each msg.attachments as att, attIdx (att.id || `att-${attIdx}`)}
											{#if att.isImage}
												<div class="user-attached-img-wrap">
													<img src={att.url || att.file_uri} alt={att.name || '첨부 이미지'} class="user-attached-img" />
												</div>
											{:else if att.isAudio}
												<div class="user-attached-audio-card">
													<div class="audio-card-top">
														<svg
															class="audio-icon"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
														>
															<path d="M9 18V5l12-2v13"></path>
															<circle cx="6" cy="18" r="3"></circle>
															<circle cx="18" cy="16" r="3"></circle>
														</svg>
														<div class="file-info">
															<span class="file-name">{att.name || '음원 파일'}</span>
															{#if att.size && formatFileSize(att.size)}
																<span class="file-size">{formatFileSize(att.size)}</span>
															{/if}
														</div>
													</div>
													{#if att.url}
														<audio controls src={att.url} class="user-inline-audio" preload="metadata"></audio>
													{/if}
												</div>
											{:else if att.isVideo}
												<div class="user-attached-video-wrap">
													{#if att.url}
														<video controls src={att.url} preload="metadata" class="user-inline-video">
															<track kind="captions" />
														</video>
													{/if}
													<div class="video-meta">
														<span class="file-name">{att.name || '영상 파일'}</span>
														{#if att.size && formatFileSize(att.size)}
															<span class="file-size">{formatFileSize(att.size)}</span>
														{/if}
													</div>
												</div>
											{:else}
												<div class="user-attached-file-card">
													<div class="file-ext-badge">{getFileExtension(att.name)}</div>
													<div class="file-info">
														<span class="file-name">{att.name || '첨부 파일'}</span>
														{#if att.size && formatFileSize(att.size)}
															<span class="file-size">{formatFileSize(att.size)}</span>
														{/if}
													</div>
												</div>
											{/if}
										{/each}
									</div>
								{/if}
								{#if msg.text}
									<div class="user-bubble">
										<p class="user-text">{msg.text}</p>
									</div>
								{/if}
							</div>
						{:else if msg.role === 'bot'}
							<!-- AI 메시지: 말풍선 박스 없이 투명 글래스 바탕 위에 시원하게 펼쳐지는 마크다운 에디토리얼! -->
							<div class="bot-ambient-message">
								<div class="bot-md-content">
									{@html renderMarkdown(msg.text)}
								</div>

								<!-- AI 답변 완료 후 도구(스킬) 실행 결과 액션 버튼 (팝업/티켓/콘서트 등) -->
								{#if msg.isDone && msg.action}
									<div class="bot-action-wrap" in:fade={{ duration: 150 }}>
										{#if msg.action.action === 'test_popup'}
											<button
												type="button"
												class="bot-action-pill"
												onclick={() => handleActionClick(msg.action!)}
											>
												<svg
													class="pill-icon"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
												>
													<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
													<line x1="9" y1="9" x2="15" y2="9" />
													<line x1="9" y1="13" x2="15" y2="13" />
												</svg>
												<span>🎫 테스트 팝업 열기</span>
											</button>
										{:else if msg.action.action === 'stop_bgm'}
											<button
												type="button"
												class="bot-action-pill"
												onclick={() => handleActionClick(msg.action!)}
											>
												<span>🔇 BGM 일시정지됨</span>
											</button>
										{:else if msg.action.action === 'start_bgm'}
											<button
												type="button"
												class="bot-action-pill"
												onclick={() => handleActionClick(msg.action!)}
											>
												<span>🎵 BGM 재생 중</span>
											</button>
										{:else}
											<button
												type="button"
												class="bot-action-pill"
												onclick={() => handleActionClick(msg.action!)}
											>
												<span>✨ {msg.action.label || '확인하기'}</span>
											</button>
										{/if}
									</div>
								{/if}

								{#if msg.isDone && msg.time}
									<span class="bot-time">{msg.time}</span>
								{/if}
							</div>
						{/if}
					</div>
				{/each}

				{#if isGenerating}
					<!-- 생각 중 로딩 펄스 & 백엔드 도구 호출 상태 안내 -->
					<div class="bot-ambient-message generating" in:fade={{ duration: 150 }}>
						<div class="thinking-status-row">
							<svg
								class="thinking-spinner"
								xmlns="http://www.w3.org/2000/svg"
								width="18"
								height="18"
								viewBox="0 0 24 24"
								aria-label="답변 생성 중"
							>
								<g>
									<circle cx="12" cy="3" r="1" fill="currentColor">
										<animate
											id="SVGelgoqhuA"
											attributeName="r"
											begin="0;SVGSRzJybSJ.end-0.5s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="16.5" cy="4.21" r="1" fill="currentColor">
										<animate
											id="SVGBcQu6cCi"
											attributeName="r"
											begin="SVGelgoqhuA.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="7.5" cy="4.21" r="1" fill="currentColor">
										<animate
											id="SVGSRzJybSJ"
											attributeName="r"
											begin="SVGeZGzNdVZ.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="19.79" cy="7.5" r="1" fill="currentColor">
										<animate
											id="SVGG5Q0fe0M"
											attributeName="r"
											begin="SVGBcQu6cCi.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="4.21" cy="7.5" r="1" fill="currentColor">
										<animate
											id="SVGeZGzNdVZ"
											attributeName="r"
											begin="SVGUTnihcal.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="21" cy="12" r="1" fill="currentColor">
										<animate
											id="SVG8aQG8dpc"
											attributeName="r"
											begin="SVGG5Q0fe0M.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="3" cy="12" r="1" fill="currentColor">
										<animate
											id="SVGUTnihcal"
											attributeName="r"
											begin="SVGHktsvT5Q.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="19.79" cy="16.5" r="1" fill="currentColor">
										<animate
											id="SVGqCF3Scrd"
											attributeName="r"
											begin="SVG8aQG8dpc.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="4.21" cy="16.5" r="1" fill="currentColor">
										<animate
											id="SVGHktsvT5Q"
											attributeName="r"
											begin="SVGSFNCBbxb.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="16.5" cy="19.79" r="1" fill="currentColor">
										<animate
											id="SVGMFYo1cJN"
											attributeName="r"
											begin="SVGqCF3Scrd.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="7.5" cy="19.79" r="1" fill="currentColor">
										<animate
											id="SVGSFNCBbxb"
											attributeName="r"
											begin="SVGLSoLpdOI.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<circle cx="12" cy="21" r="1" fill="currentColor">
										<animate
											id="SVGLSoLpdOI"
											attributeName="r"
											begin="SVGMFYo1cJN.begin+0.1s"
											calcMode="spline"
											dur="0.6s"
											keySplines=".27,.42,.37,.99;.53,0,.61,.73"
											values="1;2;1"
										/>
									</circle>
									<animateTransform
										attributeName="transform"
										dur="6s"
										repeatCount="indefinite"
										type="rotate"
										values="360 12 12;0 12 12"
									/>
								</g>
							</svg>
							{#if currentStatus}
								<span class="thinking-status-text" in:fade={{ duration: 150 }}>
									{cleanStatusText(currentStatus)}<span class="animated-dots">{animatedDots}</span>
								</span>
							{/if}
						</div>
					</div>
				{/if}

				{#if isAuthRequired}
					<!-- 로그인 필요 안내 카드 -->
					<div class="auth-required-banner" in:fade={{ duration: 150 }}>
						<div class="auth-required-header">
							<svg
								class="auth-icon"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
								<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
							</svg>
							<span class="auth-title">로그인이 필요한 서비스입니다</span>
						</div>
						<p class="auth-desc">
							취향 맞춤 인디 밴드 추천 및 실시간 AI 챗봇을 이용하시려면 먼저 로그인을 진행해 주세요.
						</p>
						<button type="button" class="auth-login-btn" onclick={handleKakaoLoginInChat}>
							<svg class="kakao-symbol" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M12 3c-5.523 0-10 3.582-10 8 0 2.87 1.875 5.394 4.717 6.764l-1.189 4.382c-.114.421.36.757.702.502l5.132-3.41c.21.01.423.016.638.016 5.523 0 10-3.582 10-8s-4.477-8-10-8z"
								/>
							</svg>
							<span>카카오로 로그인</span>
						</button>
					</div>
				{/if}

				{#if isServiceUnavailable}
					<!-- 서버 세션(Redis) 연결 불가 등 서비스 일시 장애 안내 카드 -->
					<div class="service-error-banner" in:fade={{ duration: 150 }}>
						<div class="service-error-header">
							<svg
								class="service-error-icon"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
								></path>
								<line x1="12" y1="9" x2="12" y2="13"></line>
								<line x1="12" y1="17" x2="12.01" y2="17"></line>
							</svg>
							<span class="service-error-title">AI 서비스 일시 장애</span>
						</div>
						<p class="service-error-desc">
							{serviceErrorMessage ||
								'세션 저장소(Redis)에 연결할 수 없습니다. 서비스 상태를 확인해 주세요.'}
						</p>
						<button type="button" class="service-retry-btn" onclick={handleRetryConnection}>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<polyline points="23 4 23 10 17 10"></polyline>
								<polyline points="1 20 1 14 7 14"></polyline>
								<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
								></path>
							</svg>
							다시 연결 시도
						</button>
					</div>
				{/if}
			</div>

			<!-- (3) 플로팅 입력 덱: 상단 경계선과 배경 영역을 완전히 없애고, 인풋창이 메시지 위에 둥둥 뜨도록 배치 -->
			<footer class="chat-floating-deck">
				<!-- 숨겨진 파일 첨부 인풋 -->
				<input
					bind:this={fileInputEl}
					type="file"
					multiple
					accept="image/*,audio/*,video/*,.pdf,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.rtf,.py,.js,.ts,.html,.css,.sh"
					style="display: none;"
					onchange={handleFileInputChange}
				/>

				<!-- 추천 질문 칩 -->
				{#if messages.length <= 2 && !isGenerating && attachedFiles.length === 0}
					<div class="quick-suggestions-wrap">
						<div class="suggestions-list">
							{#each quickSuggestions as suggestion}
								<button
									type="button"
									class="suggestion-chip"
									onclick={() => handleSendMessage(suggestion)}
								>
									{suggestion}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 첨부된 파일/이미지/음원/영상 프리뷰 바 -->
				{#if attachedFiles.length > 0}
					<div class="attached-previews-wrap" transition:fade={{ duration: 150 }}>
						<div class="attached-previews-scroll">
							{#each attachedFiles as att, attIdx (att.id || `preview-${attIdx}`)}
								<div class="preview-chip" class:is-img={att.isImage}>
									{#if att.isImage}
										<img src={att.url} alt={att.name || '첨부 이미지'} class="preview-thumb" />
									{:else if att.isAudio}
										<div class="preview-file-icon audio">
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<path d="M9 18V5l12-2v13"></path>
												<circle cx="6" cy="18" r="3"></circle>
												<circle cx="18" cy="16" r="3"></circle>
											</svg>
										</div>
										<span class="preview-file-name">{att.name || '음원'}</span>
									{:else if att.isVideo}
										<div class="preview-file-icon video">
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<polygon points="23 7 16 12 23 17 23 7"></polygon>
												<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
											</svg>
										</div>
										<span class="preview-file-name">{att.name || '영상'}</span>
									{:else}
										<div class="preview-file-badge">{getFileExtension(att.name)}</div>
										<span class="preview-file-name">{att.name || '파일'}</span>
									{/if}
									<button
										type="button"
										class="preview-remove-btn"
										onclick={() => removeAttachment(att.id)}
										aria-label="첨부파일 삭제"
									>
										<svg
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
										>
											<line x1="18" y1="6" x2="6" y2="18"></line>
											<line x1="6" y1="6" x2="18" y2="18"></line>
										</svg>
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 플로팅 인풋창 (드래그 앤 드롭 지원 + FdInput 내부에 첨부 & 전송 버튼 내장) -->
				<form
					class="chat-input-form"
					class:is-dragover={isDraggingOver}
					ondragenter={handleDragEnter}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
					onpaste={handlePaste}
					onsubmit={(e) => {
						e.preventDefault();
						handleSendMessage();
					}}
				>
					<div class="input-fluid-wrap" class:drag-active={isDraggingOver}>
						{#if isDraggingOver}
							<div class="drag-drop-overlay" transition:fade={{ duration: 120 }}>
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
									<polyline points="17 8 12 3 7 8"></polyline>
									<line x1="12" y1="3" x2="12" y2="15"></line>
								</svg>
								<span>이미지, 음원, 영상, 문서를 놓으세요</span>
							</div>
						{/if}
						<FdInput
							bind:inputRef={chatInputEl}
							bind:value={inputText}
							placeholder={isServiceUnavailable
								? '세션 저장소(Redis) 연결 대기 중...'
								: '음악 취향이나 궁금한 점을 물어보세요...'}
							disabled={isServiceUnavailable}
							maxlength={300}
							fullWidth={true}
							size="md"
							radius={20}
							color="#1a1a1a"
							hoverColor="#202020"
							pressColor="#202020"
							focusColor="#303030"
							textColor="#eee"
							placeholderColor="#808080"
							waveColor="#202020"
							focusWaveColor="#303030"
							onkeydown={handleInputKeyDown}
						>
							{#snippet prefix()}
								<button
									type="button"
									class="inline-attach-btn"
									onclick={() => fileInputEl?.click()}
									disabled={isServiceUnavailable}
									aria-label="파일 첨부 (이미지, 음원, 영상, 문서)"
									title="파일 첨부 (이미지, 음원, 영상, 문서 / 최대 20MB)"
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
										></path>
									</svg>
								</button>
							{/snippet}

							{#snippet suffix()}
								<button
									type="submit"
									class="inline-send-btn"
									class:visible={inputText.trim().length > 0 || attachedFiles.length > 0}
									disabled={(!inputText.trim() && attachedFiles.length === 0) ||
										isGenerating ||
										isServiceUnavailable}
									aria-label="메시지 전송"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="21"
										height="24"
										viewBox="0 0 448 512"
										><path
											fill="currentColor"
											d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h306.7L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"
										/></svg
									>
								</button>
							{/snippet}
						</FdInput>
					</div>
				</form>
			</footer>
		</div>
	</div>

	<!-- 2. 우측 하단 봇 홈 앵커 (닫혀 있을 때 위치 확보용) -->
	<div class="bot-home-anchor" aria-hidden="true"></div>

	<!-- 3. 실시간 날아다니는 유일한 단일 봇 액터 (Bot.svelte) -->
	<!-- 항상 최상단 레이어(z-index: 60)에 위치하여 어떤 상황에서도 캐릭터가 가려지지 않습니다! -->
	<div class="flying-bot-actor" class:is-docked={open} style="transform: {botFlyTransform};">
		<button
			type="button"
			class="bot-trigger-button"
			onclick={handleBotClick}
			aria-label={open ? 'AI 봇 표정 반응 보기' : 'AI 봇과 대화창 열기'}
		>
			<Bot
				bind:this={botRef}
				state={botState}
				size={BOT_HOME_SIZE}
				disableHoverWave={open}
				activeWave={isGenerating || botState === 'thinking' || botState === 'talking'}
			/>
		</button>
	</div>
</div>

{#if showTestPopup}
	<div
		class="test-popup-backdrop"
		role="presentation"
		onclick={() => (showTestPopup = false)}
		onkeydown={(e) => {
			if (e.key === 'Escape') showTestPopup = false;
		}}
		in:fade={{ duration: 150 }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="test-popup-card"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="test-popup-header">
				<div class="test-popup-badge-group">
					<span class="test-popup-badge">INDIG AI</span>
					<span class="test-popup-chip">ACTION TRIGGERED</span>
				</div>
				<button
					type="button"
					class="test-popup-close-btn"
					onclick={() => (showTestPopup = false)}
					aria-label="팝업 닫기"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="test-popup-content">
				<h3 class="test-popup-title">🎉 백엔드 스킬 팝업 연동 성공!</h3>
				<p class="test-popup-desc">
					백엔드 <code>open_test_popup</code> 스킬의 <code>event: action</code> 신호가 정상적으로 감지되어
					실시간 UI 팝업이 활성화되었습니다.
				</p>

				<div class="test-popup-info-box">
					<div class="info-row">
						<span class="info-label">실행 액션</span>
						<span class="info-val">test_popup</span>
					</div>
					<div class="info-row">
						<span class="info-label">담당 AI 캐릭터</span>
						<span class="info-val">{botName}</span>
					</div>
					<div class="info-row">
						<span class="info-label">상태</span>
						<span class="info-val ok">연결 및 렌더링 정상</span>
					</div>
				</div>
			</div>

			<div class="test-popup-footer">
				<button
					type="button"
					class="test-popup-confirm-btn"
					onclick={() => (showTestPopup = false)}
				>
					확인했습니다
				</button>
			</div>
		</div>
	</div>
{/if}

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

	/* -------------------------------------------------------------
	   루트 컨테이너: 우측 하단 고정 좌표 기준점 제공
	   ------------------------------------------------------------- */
	.bot-area-root {
		position: fixed;
		right: 1.75rem;
		bottom: 1.75rem;
		z-index: 48;
		pointer-events: none;
	}

	@media (max-width: 640px) {
		.bot-area-root {
			right: 1rem;
			bottom: calc(64px + env(safe-area-inset-bottom, 0px));
		}
	}

	/* -------------------------------------------------------------
	   1. 모핑 대화창 패널 (진짜 원형 -> 사각형 clip-path 모핑):
	   - 우측 하단 정확한 80px 정원(Circle, round 40px)에서부터
	     좌측 상단으로 촥 퍼지며 둥근 사각형(round 28px)으로 모양이 유기적으로 변형됨!
	   - 타원 왜곡 없이 정확한 80px 원형에서 시작
	   - 0.52s 실크 스프링 트랜지션
	   ------------------------------------------------------------- */
	.morph-chat-panel {
		position: fixed;
		right: 1.75rem;
		bottom: 1.75rem;
		width: clamp(340px, 92vw, 410px);
		height: min(620px, 80dvh);
		display: flex;
		flex-direction: column;

		/* 투명 다크 글래스 (#070709, 30% 투명도) + 깊이감 있는 백드롭 블러 */
		background: rgba(7, 7, 9, 0.3);
		backdrop-filter: blur(28px) saturate(180%);
		-webkit-backdrop-filter: blur(28px) saturate(180%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 28px;
		box-shadow:
			0 24px 64px -12px rgba(0, 0, 0, 0.65),
			0 0 32px rgba(233, 233, 233, 0.05);
		overflow: hidden;
		z-index: 47;
		color: #f1f5f9;
		user-select: text;

		/* 
		  닫혀 있을 때:
		  우측 하단 80px x 80px 영역만 완벽한 원형(round 40px)으로 남김!
		*/
		clip-path: inset(calc(100% - 80px) 0 0 calc(100% - 80px) round 40px);
		opacity: 0;
		pointer-events: none;

		/* 
		  실크 스프링 트랜지션:
		  clip-path의 top, left 마진과 round 반경이 매끄럽게 보간되어
		  정원(Circle)에서 위/왼쪽으로 퍼지며 둥근 사각형(Rounded Rect)으로 변형!
		*/
		transition:
			clip-path 0.52s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.28s ease,
			box-shadow 0.4s ease;
		will-change: clip-path, opacity;
	}

	/* 열린 상태: 전체 둥근 사각형으로 촥 펼쳐짐 */
	.morph-chat-panel.is-open {
		clip-path: inset(0 0 0 0 round 28px);
		opacity: 1;
		pointer-events: auto;
	}

	/* 모바일 화면에서는 하단 바텀 시트로 모핑 */
	@media (max-width: 640px) {
		.morph-chat-panel {
			right: 0;
			left: 0;
			bottom: 0;
			width: 100%;
			height: 85dvh;
			border-radius: 28px 28px 0 0;
			border-bottom: none;
			border-left: none;
			border-right: none;
			box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.75);

			/* 모바일 봇 위치: right 16px, bottom 64px, 크기 80px */
			clip-path: inset(calc(100% - 144px) 16px 64px calc(100% - 96px) round 40px);
		}

		.morph-chat-panel.is-open {
			clip-path: inset(0 0 0 0 round 28px 28px 0 0);
		}
	}

	/* -------------------------------------------------------------
	   내부 내용물 래퍼 (가장자리 내용물 잘림 완전 해결):
	   - 닫혀 있거나 창이 펴지는 중에는 완전 투명(opacity: 0)을 유지!
	   - 창이 거의 다 펴진 후(0.22초 딜레이) 스르륵 부드럽게 페이드인!
	   - 닫힐 때는 내용물이 먼저 0.15초 만에 슉 사라진 뒤 빈 껍질이 원으로 축소!
	   ------------------------------------------------------------- */
	.panel-inner-content {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s ease; /* 닫힐 때 빠르게 사라짐 */
	}

	.panel-inner-content.visible {
		opacity: 1;
		pointer-events: auto;
		/* 창이 원에서 사각형으로 펴진 후 우아하게 등장! */
		transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.22s;
	}

	/* -------------------------------------------------------------
	   상단 헤더
	   ------------------------------------------------------------- */
	.chat-header {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		padding: 0.85rem 1.15rem;
		background: transparent;
		border: none;
		border-bottom: none;
		gap: 0.85rem;
		flex-shrink: 0;
		z-index: 20;
		pointer-events: none;
	}

	/* 날아온 봇이 안착하는 56px 도크 자리 */
	.bot-dock-slot {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
	}

	.bot-header-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
	}

	.header-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.bot-title {
		font-size: 1rem;
		font-weight: 600;
		color: #ffffff;
		letter-spacing: -0.01em;
	}

	.state-badge {
		font-size: 0.65rem;
		padding: 1px 6px;
		border-radius: 9999px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.state-badge.thinking {
		background: rgba(99, 102, 241, 0.2);
		color: #a5b4fc;
		border: 1px solid rgba(99, 102, 241, 0.4);
	}

	.state-badge.talking {
		background: rgba(236, 72, 153, 0.2);
		color: #f472b6;
		border: 1px solid rgba(236, 72, 153, 0.4);
	}

	.bot-status-tag {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.status-online-dot {
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		background: #10b981;
		box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
	}

	.status-pulse-dot {
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		animation: pulse-glow 1s infinite alternate ease-in-out;
	}

	.status-pulse-dot.thinking {
		background: #818cf8;
		box-shadow: 0 0 8px rgba(129, 140, 248, 0.8);
	}

	.status-pulse-dot.talking {
		background: #ec4899;
		box-shadow: 0 0 8px rgba(236, 72, 153, 0.8);
	}

	@keyframes pulse-glow {
		0% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		100% {
			transform: scale(1.35);
			opacity: 1;
		}
	}

	.chat-close-btn {
		pointer-events: auto;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: transparent;
		border: none;
		color: #b9b9b9;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.chat-close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		transform: scale(1.05);
	}

	.chat-close-btn svg {
		width: 18px;
		height: 18px;
	}

	/* AI 서비스 일시 장애 안내 카드 스타일 */
	.service-error-banner {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 13px 15px;
		margin: 0.5rem 0;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.28);
		border-radius: 18px;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.service-error-header {
		display: flex;
		align-items: center;
		gap: 7px;
	}

	.service-error-icon {
		width: 17px;
		height: 17px;
		color: #f87171;
		flex-shrink: 0;
	}

	.service-error-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: #fca5a5;
		letter-spacing: -0.01em;
	}

	.service-error-desc {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.5;
		color: #cbd5e1;
		word-break: break-word;
	}

	.service-retry-btn {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 13px;
		margin-top: 3px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 9999px;
		color: #ffffff;
		font-size: 0.74rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.service-retry-btn:hover {
		background: rgba(255, 255, 255, 0.18);
		border-color: rgba(255, 255, 255, 0.35);
		transform: scale(1.02);
	}

	/* -------------------------------------------------------------
	   AI 액션 버튼 (스킬 실행 완료 후 말풍선 밑에 등장)
	   ------------------------------------------------------------- */
	.bot-action-wrap {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.6rem;
		margin-bottom: 0.2rem;
	}

	.bot-action-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.45rem 0.95rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 9999px;
		color: #ffffff;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.bot-action-pill:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.5);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.bot-action-pill .pill-icon {
		width: 14px;
		height: 14px;
		color: #34d399;
	}

	/* -------------------------------------------------------------
	   401 인증 필요 안내 카드 (카카오 로그인 유도)
	   ------------------------------------------------------------- */
	.auth-required-banner {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.9rem 1.1rem;
		margin-bottom: 0.5rem;
		background: rgba(254, 229, 0, 0.08);
		border: 1px solid rgba(254, 229, 0, 0.3);
		border-radius: 1rem;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.auth-required-header {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: #fee500;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.auth-required-header .auth-icon {
		width: 16px;
		height: 16px;
	}

	.auth-desc {
		margin: 0;
		color: rgba(255, 255, 255, 0.8);
		font-size: 0.78rem;
		line-height: 1.45;
	}

	.auth-login-btn {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.45rem 0.9rem;
		margin-top: 0.25rem;
		background: #fee500;
		border: none;
		border-radius: 9999px;
		color: #191919;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.auth-login-btn:hover {
		background: #ffec3d;
		transform: scale(1.02);
	}

	.auth-login-btn .kakao-symbol {
		width: 14px;
		height: 14px;
	}

	/* -------------------------------------------------------------
	   테스트 팝업 모달
	   ------------------------------------------------------------- */
	.test-popup-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		pointer-events: auto;
	}

	.test-popup-card {
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 1.25rem;
		width: 100%;
		max-width: 420px;
		padding: 1.5rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
		color: #fff;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		animation: popupEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes popupEnter {
		from {
			opacity: 0;
			transform: scale(0.94) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.test-popup-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.test-popup-badge-group {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.test-popup-badge {
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 9999px;
		color: #e4e4e7;
	}

	.test-popup-chip {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 0.15rem 0.45rem;
		background: rgba(16, 185, 129, 0.2);
		border: 1px solid rgba(16, 185, 129, 0.4);
		border-radius: 9999px;
		color: #34d399;
	}

	.test-popup-close-btn {
		background: none;
		border: none;
		color: #a1a1aa;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: 9999px;
		transition: all 0.15s ease;
	}

	.test-popup-close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.test-popup-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.test-popup-desc {
		margin: 0.35rem 0 0 0;
		font-size: 0.85rem;
		color: #a1a1aa;
		line-height: 1.5;
	}

	.test-popup-desc code {
		background: rgba(255, 255, 255, 0.08);
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		color: #fbbf24;
		font-family: monospace;
	}

	.test-popup-info-box {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.8rem;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.info-label {
		color: #71717a;
	}

	.info-val {
		color: #e4e4e7;
		font-weight: 500;
	}

	.info-val.ok {
		color: #34d399;
	}

	.test-popup-footer {
		display: flex;
		justify-content: flex-end;
	}

	.test-popup-confirm-btn {
		padding: 0.55rem 1.25rem;
		background: #ffffff;
		border: none;
		border-radius: 9999px;
		color: #18181b;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.test-popup-confirm-btn:hover {
		background: #f4f4f5;
		transform: scale(1.02);
	}

	/* 단기 기억 20개 초과 시 최상단 안내 문구 (최대 20개 대화 보관 알림) */
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

	.truncated-history-notice .notice-icon {
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.truncated-history-notice .notice-text {
		color: #a7a7a7;
		letter-spacing: -0.01em;
	}

	/* -------------------------------------------------------------
	   메시지 리스트 영역:
	   - 상단 헤더 및 하단 인풋창 뒤로 들어간 텍스트는 위/아래로 갈수록 점차 투명해지는 마스크 적용!
	   - 상단 100px 헤더 여백 및 하단 115px 인풋 여백 확보
	   ------------------------------------------------------------- */
	.chat-messages-area {
		flex: 1;
		overflow-y: auto;
		padding: 100px 1.25rem 115px 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		overscroll-behavior: contain;

		/* 헤더 글자와 겹치지 않도록 65px까지 완전 투명, 120px부터 선명해지는 상단 마스크 */
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

	/* 유저 메시지 디자인 (참고 이미지 완벽 반영): 둥근 알약 캡슐 */
	.message-row.user {
		justify-content: flex-end;
	}

	.user-bubble-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		max-width: 82%;
	}

	.user-bubble {
		background: #e5e5e5;
		color: #171717;
		padding: 0.7rem 1rem;
		border-radius: 18px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.user-text {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 500;
		line-height: 1.45;
		color: #111827;
		word-break: break-word;
		white-space: pre-wrap;
	}

	.user-time {
		font-size: 0.6875rem;
		color: rgba(255, 255, 255, 0.45);
		padding-right: 0.5rem;
	}

	/* AI 메시지: 말풍선 박스 없이 투명 글래스 바탕 위에 마크다운 */
	.message-row.bot {
		justify-content: flex-start;
	}

	.bot-ambient-message {
		width: 100%;
		max-width: 100%;
		background: transparent;
		border: none;
		padding: 0 0.15rem;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bot-time {
		font-size: 0.6875rem;
		color: rgba(255, 255, 255, 0.45);
		margin-top: 4px;
	}

	/* 마크다운 스타일링 */
	:global(.bot-md-content) {
		color: #f1f5f9;
		font-size: 0.9375rem;
		line-height: 1.7;
		letter-spacing: -0.015em;
		word-break: break-word;
	}

	:global(.bot-md-content .md-p) {
		margin: 0 0 0.75rem 0;
	}

	:global(.bot-md-content .md-p:last-child) {
		margin-bottom: 0;
	}

	:global(.bot-md-content strong) {
		color: #ffffff;
		font-weight: 600;
	}

	:global(.bot-md-content em) {
		color: #dddddd;
		font-style: italic;
	}

	:global(.bot-md-content .md-h2) {
		font-size: 1.18rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0.9rem 0 0.45rem 0;
		letter-spacing: -0.02em;
	}

	:global(.bot-md-content .md-h3) {
		font-size: 1.05rem;
		font-weight: 600;
		color: #f8fafc;
		margin: 0.8rem 0 0.4rem 0;
	}

	:global(.bot-md-content .md-h4) {
		font-size: 0.95rem;
		font-weight: 600;
		color: #f0f0f0;
		margin: 0.65rem 0 0.35rem 0;
	}

	:global(.bot-md-content .md-del) {
		text-decoration: line-through;
		color: rgba(255, 255, 255, 0.45);
	}

	/* 마크다운 링크 (파란색 복구) */
	:global(.bot-md-content .md-link) {
		color: #3b82f6;
		text-decoration: underline;
		text-underline-offset: 3px;
		font-weight: 500;
		transition:
			color 0.15s ease,
			text-shadow 0.15s ease;
	}

	:global(.bot-md-content .md-link:hover) {
		color: #60a5fa;
		text-shadow: 0 0 8px rgba(96, 165, 250, 0.45);
	}

	:global(.bot-md-content .md-hr) {
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.14);
		margin: 1.2rem 0;
	}

	/* 목록 아이콘 및 인덴트 완벽 보정 */
	:global(.bot-md-content .md-list) {
		list-style-type: disc !important;
		list-style-position: outside;
		margin: 0.5rem 0 0.85rem 0;
		padding-left: 1.35rem;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.bot-md-content .md-ol) {
		list-style-type: decimal !important;
		list-style-position: outside;
		margin: 0.5rem 0 0.85rem 0;
		padding-left: 1.35rem;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.bot-md-content li) {
		display: list-item;
		line-height: 1.6;
	}

	:global(.bot-md-content .md-list li::marker) {
		color: #e4e4e4;
	}

	:global(.bot-md-content .md-ol li::marker) {
		color: #e4e4e4;
		font-weight: 600;
	}

	/* 태스크 체크박스 리스트 */
	:global(.bot-md-content .md-task-list) {
		list-style: none !important;
		padding-left: 0.2rem;
		margin: 0.5rem 0 0.85rem 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.bot-md-content .md-task-item) {
		display: flex;
		align-items: center;
		gap: 8px;
		line-height: 1.5;
	}

	:global(.bot-md-content .md-checkbox) {
		width: 15px;
		height: 15px;
		border-radius: 4px;
		border: 1.5px solid rgba(255, 255, 255, 0.35);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		color: #ffffff;
		flex-shrink: 0;
	}

	:global(.bot-md-content .md-checkbox.checked) {
		background: #333333;
		border-color: #a5a5a5;
	}

	/* 인용구 (블록쿼트) */
	:global(.bot-md-content .md-quote) {
		margin: 0.75rem 0;
		padding: 0.6rem 1rem;
		border-left: 3px solid #c5c5c5;
		background: rgba(238, 238, 238, 0.08);
		border-radius: 0 10px 10px 0;
		color: #dddddd;
		font-size: 0.875rem;
		line-height: 1.65;
		font-style: normal;
	}

	/* 표 (Table) 글래스모피즘 스타일링 */
	:global(.bot-md-content .md-table-wrap) {
		width: 100%;
		overflow-x: auto;
		margin: 0.85rem 0;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(20, 22, 32, 0.55);
		backdrop-filter: blur(8px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	}

	:global(.bot-md-content .md-table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		text-align: left;
	}

	:global(.bot-md-content .md-table th) {
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		font-weight: 600;
		padding: 0.65rem 0.95rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.14);
		white-space: nowrap;
	}

	:global(.bot-md-content .md-table td) {
		padding: 0.6rem 0.95rem;
		color: #e0e0e0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	:global(.bot-md-content .md-table tr:last-child td) {
		border-bottom: none;
	}

	:global(.bot-md-content .md-table tr:hover td) {
		background: rgba(255, 255, 255, 0.04);
	}

	:global(.bot-md-content .md-inline-code) {
		background: rgba(255, 255, 255, 0.09);
		color: rgb(245, 245, 247);
		padding: 2px 5px;
		border-radius: 4px;
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.85em;
	}

	:global(.bot-md-content .md-code-block) {
		margin: 0.75rem 0;
		padding: 0.85rem 1.1rem;
		background: rgba(0, 0, 0, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		overflow-x: auto;
		color: #e2e8f0;
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.8125rem;
		line-height: 1.55;
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

	.status-text-truncate {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* 생각 중 원형 회전 펄스 스피너: 흑백 테마 맞춤 무채색 화이트 */
	.thinking-spinner {
		width: 18px;
		height: 18px;
		color: #ffffff;
		flex-shrink: 0;
		display: block;
		filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.45));
	}

	/* -------------------------------------------------------------
	   플로팅 인풋 덱
	   ------------------------------------------------------------- */
	.chat-floating-deck {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: transparent; /* 영역 자체 배경 없음 */
		border: none; /* 상단 선 완전 제거 */
		display: flex;
		flex-direction: column;
		pointer-events: none; /* 빈 공간은 스크롤 통과 */
		z-index: 20;
	}

	.quick-suggestions-wrap {
		pointer-events: auto;
		padding: 0 0.15rem;
		flex-shrink: 0;
	}

	.suggestions-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.suggestion-chip {
		text-align: left;
		padding: 0.5rem 0.85rem;
		background: rgba(14, 16, 26, 0.7);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		color: #cbd5e1;
		font-size: 0.8125rem;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
		transition: all 0.18s ease;
	}

	.suggestion-chip:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		border-color: rgba(99, 102, 241, 0.55);
		transform: translateX(3px);
	}

	/* 플로팅 유체 인풋창 폼 (FdInput + FdButton) */
	.chat-input-form {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		background: transparent;
		border: none;
		box-shadow: none;
		width: 100%;
	}

	.input-fluid-wrap {
		flex: 1;
		min-width: 0;
	}

	/* FdInput 패딩 및 높이 컴팩트 최적화 (높이 축소) */
	:global(.input-fluid-wrap .input-box) {
		padding: 0.38rem 0.8rem 0.38rem 1.05rem !important;
		min-height: 38px !important;
	}

	/* FdInput 내부 우측 전송 버튼 (하양색 원형 버튼) */
	.inline-send-btn {
		width: 0;
		height: 28px;
		opacity: 0;
		margin-left: 0;
		padding: 0;
		border: none;
		border-radius: 9999px;
		background: #ffffff;
		color: #111827;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		pointer-events: none;
		transform: scale(0.35) rotate(-15deg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
		flex-shrink: 0;
		overflow: hidden;

		/* 부드럽고 쫀득한 스프링 팝 애니메이션 */
		transition:
			width 0.28s cubic-bezier(0.16, 1, 0.3, 1),
			transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 0.22s ease,
			margin-left 0.24s cubic-bezier(0.16, 1, 0.3, 1),
			background-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	/* 텍스트 입력 시 활성화 */
	.inline-send-btn.visible {
		width: 28px;
		opacity: 1;
		margin-left: 5px;
		pointer-events: auto;
		transform: scale(1) rotate(0deg);
	}

	.inline-send-btn:hover {
		background: #f1f5f9;
		transform: scale(1.08) rotate(0deg);
		box-shadow: 0 4px 12px rgba(255, 255, 255, 0.25);
	}

	.inline-send-btn:active {
		background: #e2e8f0;
		transform: scale(0.92) rotate(0deg);
	}

	.inline-send-btn svg {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}

	/* FdInput 내부 좌측 첨부 버튼: 흑백 테마 맞춤 무채색 화이트 */
	.inline-attach-btn {
		background: transparent;
		border: none;
		color: #ffffff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 9999px;
		cursor: pointer;
		padding: 0;
		margin-right: 2px;
		transition: all 0.18s ease;
		opacity: 0.85;
	}

	.inline-attach-btn:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.15);
		transform: scale(1.08);
		opacity: 1;
	}

	/* 드래그 오버 피드백 및 오버레이 */
	.drag-drop-overlay {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: rgba(15, 17, 26, 0.88);
		backdrop-filter: blur(8px);
		border: 1.5px dashed #ffffff;
		border-radius: 20px;
		color: #ffffff;
		font-size: 0.8125rem;
		font-weight: 500;
		pointer-events: none;
	}

	:global(.chat-input-form.is-dragover .input-box) {
		border-color: #ffffff !important;
		background: rgba(255, 255, 255, 0.12) !important;
	}

	/* 첨부 파일/이미지 프리뷰 바 */
	.attached-previews-wrap {
		pointer-events: auto;
		padding: 0 0.25rem 0.5rem 0.25rem;
		width: 100%;
	}

	.attached-previews-scroll {
		display: flex;
		align-items: center;
		gap: 8px;
		overflow-x: auto;
		padding: 4px 2px;
		scrollbar-width: none;
	}

	.attached-previews-scroll::-webkit-scrollbar {
		display: none;
	}

	.preview-chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px 4px 6px;
		background: rgba(26, 26, 32, 0.85);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 10px;
		color: #e2e8f0;
		font-size: 0.75rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
		flex-shrink: 0;
	}

	.preview-chip.is-img {
		padding: 2px;
		border-radius: 10px;
	}

	.preview-thumb {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		object-fit: cover;
		display: block;
	}

	.preview-file-icon {
		color: #818cf8;
		display: flex;
		align-items: center;
	}

	.preview-file-icon.audio {
		color: #c084fc;
	}

	.preview-file-icon.video {
		color: #38bdf8;
	}

	.preview-file-badge {
		font-size: 0.6rem;
		font-weight: 700;
		padding: 1px 4px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.15);
		color: #cbd5e1;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}

	.preview-file-name {
		max-width: 110px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-remove-btn {
		width: 18px;
		height: 18px;
		border-radius: 9999px;
		border: none;
		background: rgba(255, 255, 255, 0.2);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		margin-left: 2px;
		padding: 0;
		transition: background 0.15s ease;
	}

	.preview-chip.is-img .preview-remove-btn {
		position: absolute;
		top: -4px;
		right: -4px;
		background: rgba(0, 0, 0, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.35);
	}

	.preview-remove-btn:hover {
		background: #ef4444;
	}

	/* 유저 말풍선 내부 첨부파일 표시 */
	.user-attachments-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: flex-end;
		max-width: 100%;
	}

	.user-attached-img-wrap {
		border-radius: 14px;
		overflow: hidden;
		max-width: 220px;
		max-height: 220px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
	}

	.user-attached-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* 오디오 첨부 카드 */
	.user-attached-audio-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 0.65rem 0.85rem;
		background: rgba(28, 28, 36, 0.95);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 14px;
		color: #f1f5f9;
		width: 100%;
		min-width: 230px;
		max-width: 280px;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
	}

	.audio-card-top {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.audio-card-top .audio-icon {
		width: 18px;
		height: 18px;
		color: #c084fc;
		flex-shrink: 0;
	}

	.user-inline-audio {
		width: 100%;
		height: 32px;
		border-radius: 8px;
		outline: none;
	}

	/* 비디오 첨부 카드 */
	.user-attached-video-wrap {
		border-radius: 14px;
		overflow: hidden;
		max-width: 260px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: #000;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
	}

	.user-inline-video {
		display: block;
		width: 100%;
		max-height: 180px;
		object-fit: contain;
		background: #000;
	}

	.video-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 5px 8px;
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.7);
		background: rgba(20, 20, 25, 0.9);
	}

	.video-meta .file-name {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.video-meta .file-size {
		color: rgba(255, 255, 255, 0.45);
	}

	/* 일반 문서/코드 첨부 카드 */
	.user-attached-file-card {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0.5rem 0.85rem;
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		color: #f1f5f9;
		font-size: 0.8125rem;
	}

	.file-ext-badge {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(129, 140, 248, 0.2);
		border: 1px solid rgba(129, 140, 248, 0.4);
		color: #c7d2fe;
		letter-spacing: 0.03em;
		flex-shrink: 0;
	}

	.user-attached-file-card .file-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.user-attached-file-card .file-name {
		font-weight: 500;
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-attached-file-card .file-size {
		font-size: 0.7rem;
		color: rgba(255, 255, 255, 0.5);
	}

	/* -------------------------------------------------------------
	   2. 우측 하단 봇 홈 앵커
	   ------------------------------------------------------------- */
	.bot-home-anchor {
		width: 80px;
		height: 80px;
		pointer-events: none;
	}

	/* -------------------------------------------------------------
	   3. 독립 비행 봇 액터 (Bot.svelte):
	   - 항상 최상단 레이어 (z-index: 60)에 배치되어 어떤 경우에도 절대 가려지지 않음!
	   - 대화창 패널의 원 -> 사각형 모핑 시간과 완벽히 동기화된 0.52s 실크 스프링 이징!
	   ------------------------------------------------------------- */
	.flying-bot-actor {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
		z-index: 60; /* 항상 최상단에 또렷하게 표시되어 1프레임도 가려지지 않음! */
		transform-origin: center center;

		/* 창이 퍼지는 0.52s와 정확히 동일한 실크 스프링 이징 */
		transition: transform 0.52s cubic-bezier(0.16, 1, 0.3, 1);
		will-change: transform;
	}

	.bot-trigger-button {
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		outline: none;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		transition:
			transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
			filter 0.22s ease;
		-webkit-tap-highlight-color: transparent;
		filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.5));
	}

	.bot-trigger-button:hover {
		transform: scale(1.08);
		filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.65));
	}

	.bot-trigger-button:active {
		transform: scale(0.95);
	}
</style>
