/**
 * 안전하고 강력한 인라인/블록 마크다운 파서 (GFM 완벽 지원)
 */
export function renderMarkdown(content: string): string {
	if (!content) return '';

	// 1. 코드 블록(```) 임시 보호 (스트리밍 중이거나 토큰 제한으로 닫는 ```가 누락된 경우도 안전하게 코드 블록으로 렌더링)
	const codeBlocks: string[] = [];
	let html = content.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)(?:```|$)/g, (_, lang, code) => {
		const idx = codeBlocks.length;
		const safeCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		codeBlocks.push(
			`<pre class="md-code-block" data-lang="${lang || ''}"><code>${safeCode.trim()}</code></pre>`
		);
		return `@@CODEBLOCK:${idx}@@`;
	});

	// 2. 인라인 코드(`...`) 임시 보호
	const inlineCodes: string[] = [];
	html = html.replace(/`([^`\n]+)`/g, (_, code) => {
		const idx = inlineCodes.length;
		const safeCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		inlineCodes.push(`<code class="md-inline-code">${safeCode}</code>`);
		return `@@INLINECODE:${idx}@@`;
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

	// 이탤릭: *text* 또는 _text_ (단어 중간의 언더바는 건드리지 않도록 처리)
	html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
	html = html.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?:;)])/g, '$1<em>$2</em>');

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
				trimmed.startsWith('@@CODEBLOCK:') ||
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
		finalHtml = finalHtml.replace(`@@CODEBLOCK:${idx}@@`, cb);
	});
	inlineCodes.forEach((ic, idx) => {
		finalHtml = finalHtml.replace(`@@INLINECODE:${idx}@@`, ic);
	});

	return finalHtml;
}

