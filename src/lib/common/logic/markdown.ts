const LATEX_SYMBOLS: Record<string, string> = {
	times: '×',
	cdot: '·',
	div: '÷',
	pm: '±',
	mp: '∓',
	le: '≤',
	leq: '≤',
	ge: '≥',
	geq: '≥',
	ne: '≠',
	neq: '≠',
	approx: '≈',
	equiv: '≡',
	sim: '∼',
	propto: '∝',
	infty: '∞',
	to: '→',
	rightarrow: '→',
	leftarrow: '←',
	leftrightarrow: '↔',
	Rightarrow: '⇒',
	Leftarrow: '⇐',
	Leftrightarrow: '⇔',
	mapsto: '↦',
	sum: '∑',
	prod: '∏',
	int: '∫',
	partial: '∂',
	nabla: '∇',
	in: '∈',
	notin: '∉',
	subset: '⊂',
	subseteq: '⊆',
	supset: '⊃',
	supseteq: '⊇',
	cup: '∪',
	cap: '∩',
	emptyset: '∅',
	forall: '∀',
	exists: '∃',
	neg: '¬',
	land: '∧',
	lor: '∨',
	therefore: '∴',
	because: '∵',
	dots: '…',
	ldots: '…',
	cdots: '⋯',
	circ: '∘',
	deg: '°',
	angle: '∠',
	perp: '⊥',
	parallel: '∥',
	alpha: 'α',
	beta: 'β',
	gamma: 'γ',
	delta: 'δ',
	epsilon: 'ε',
	varepsilon: 'ε',
	zeta: 'ζ',
	eta: 'η',
	theta: 'θ',
	iota: 'ι',
	kappa: 'κ',
	lambda: 'λ',
	mu: 'μ',
	nu: 'ν',
	xi: 'ξ',
	pi: 'π',
	rho: 'ρ',
	sigma: 'σ',
	tau: 'τ',
	upsilon: 'υ',
	phi: 'φ',
	varphi: 'φ',
	chi: 'χ',
	psi: 'ψ',
	omega: 'ω',
	Gamma: 'Γ',
	Delta: 'Δ',
	Theta: 'Θ',
	Lambda: 'Λ',
	Xi: 'Ξ',
	Pi: 'Π',
	Sigma: 'Σ',
	Phi: 'Φ',
	Psi: 'Ψ',
	Omega: 'Ω',
	quad: ' ',
	qquad: '  '
};

function escapeMathText(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function readBracedGroup(src: string, start: number): [string, number] | null {
	let i = start;
	while (i < src.length && src[i] === ' ') i++;
	if (src[i] !== '{') return null;
	let depth = 0;
	const contentStart = i + 1;
	for (; i < src.length; i++) {
		if (src[i] === '\\') {
			i++;
			continue;
		}
		if (src[i] === '{') depth++;
		else if (src[i] === '}') {
			depth--;
			if (depth === 0) {
				return [src.slice(contentStart, i), i + 1];
			}
		}
	}
	return null;
}

/** LaTeX 수식 표현을 안전한 HTML 마크업으로 변환 */
function renderLatexMath(raw: string): string {
	let src = raw.trim();
	if (!src) return '';

	// \left / \right 크기 수식어 제거
	src = src.replace(/\\(?:left|right|big|Big|bigg|Bigg)\s*(?=[()[\]{}|.])/g, '');
	src = src.replace(/\\[,;:!]/g, ' ');
	src = src.replace(/\\([%$#&_{}])/g, '$1');

	// \frac{a}{b}, \sqrt{x}, \text{...}, \mathrm{...}, \mathbf{...} 재귀 변환
	let out = '';
	let i = 0;
	while (i < src.length) {
		if (src[i] === '\\') {
			const cmdMatch = src.slice(i + 1).match(/^([a-zA-Z]+)/);
			if (cmdMatch) {
				const cmd = cmdMatch[1];
				const afterCmd = i + 1 + cmd.length;

				if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
					const num = readBracedGroup(src, afterCmd);
					const den = num ? readBracedGroup(src, num[1]) : null;
					if (num && den) {
						out += `<span class="md-frac"><span class="md-frac-num">${renderLatexMath(num[0])}</span><span class="md-frac-den">${renderLatexMath(den[0])}</span></span>`;
						i = den[1];
						continue;
					}
				} else if (cmd === 'sqrt') {
					const arg = readBracedGroup(src, afterCmd);
					if (arg) {
						out += `<span class="md-sqrt">√<span class="md-sqrt-inner">${renderLatexMath(arg[0])}</span></span>`;
						i = arg[1];
						continue;
					}
				} else if (cmd === 'text' || cmd === 'mathrm' || cmd === 'operatorname') {
					const arg = readBracedGroup(src, afterCmd);
					if (arg) {
						out += `<span class="md-math-text">${escapeMathText(arg[0])}</span>`;
						i = arg[1];
						continue;
					}
				} else if (cmd === 'mathbf' || cmd === 'textbf' || cmd === 'boldsymbol') {
					const arg = readBracedGroup(src, afterCmd);
					if (arg) {
						out += `<strong class="md-math-bold">${renderLatexMath(arg[0])}</strong>`;
						i = arg[1];
						continue;
					}
				} else if (cmd in LATEX_SYMBOLS) {
					out += `<span class="md-math-op">${LATEX_SYMBOLS[cmd]}</span>`;
					i = afterCmd;
					continue;
				}
			}
			// 알 수 없는 이스케이프는 문자 그대로 출력
			out += escapeMathText(src[i + 1] ?? '');
			i += 2;
			continue;
		}

		// 위첨자(^) / 아래첨자(_)
		if (src[i] === '^' || src[i] === '_') {
			const tag = src[i] === '^' ? 'sup' : 'sub';
			const group = readBracedGroup(src, i + 1);
			if (group) {
				out += `<${tag}>${renderLatexMath(group[0])}</${tag}>`;
				i = group[1];
				continue;
			}
			const nextChar = src[i + 1];
			if (nextChar) {
				out += `<${tag}>${escapeMathText(nextChar)}</${tag}>`;
				i += 2;
				continue;
			}
		}

		// 단독 그룹 { ... } 언래핑
		if (src[i] === '{') {
			const group = readBracedGroup(src, i);
			if (group) {
				out += renderLatexMath(group[0]);
				i = group[1];
				continue;
			}
		}

		const ch = src[i];
		if (/[a-zA-Z]/.test(ch)) {
			// 연속 영문 변수명(예: sin, log)은 정자, 단일 변수는 이탤릭
			const wordMatch = src.slice(i).match(/^[a-zA-Z]+/);
			const word = wordMatch ? wordMatch[0] : ch;
			if (word.length === 1) {
				out += `<var class="md-math-var">${word}</var>`;
			} else {
				out += `<span class="md-math-text">${word}</span>`;
			}
			i += word.length;
			continue;
		}

		out += escapeMathText(ch);
		i++;
	}

	return out;
}

/**
 * 안전하고 강력한 인라인/블록 마크다운 파서 (GFM + LaTeX 수식 지원)
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

	// 2.5. LaTeX 수식 블록($$...$$, \[...\]) 및 인라인($...$, \(...\)) 임시 보호·렌더링
	const mathBlocks: string[] = [];
	const mathInlines: string[] = [];

	html = html.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g, (_, d1, d2) => {
		const expr = (d1 ?? d2 ?? '').trim();
		const idx = mathBlocks.length;
		mathBlocks.push(`<div class="md-math-block">${renderLatexMath(expr)}</div>\n\n`);
		return `@@MATHBLOCK:${idx}@@`;
	});

	// 인라인 수식: \(...\) 또는 $...$ (앞뒤 공백 없이 수식 내용 포함, 금액 표기 '$100' 등은 오인식 방지)
	html = html.replace(
		/\\\(([^\n]+?)\\\)|(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g,
		(match, p1, p2) => {
			const expr = (p1 ?? p2 ?? '').trim();
			// 단순 숫자/쉼표/소수점만 있는 경우(예: $10 ~ $20 사이 구간)는 수식으로 오인하지 않음
			if (!p1 && /^[\d,.\s]+$/.test(expr)) return match;
			const idx = mathInlines.length;
			mathInlines.push(`<span class="md-math-inline">${renderLatexMath(expr)}</span>`);
			return `@@MATHINLINE:${idx}@@`;
		}
	);

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
				trimmed.startsWith('@@MATHBLOCK:') ||
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

	// 13. 보호해 둔 코드 블록, 인라인 코드, LaTeX 수식 복원
	codeBlocks.forEach((cb, idx) => {
		finalHtml = finalHtml.replace(`@@CODEBLOCK:${idx}@@`, cb);
	});
	mathBlocks.forEach((mb, idx) => {
		finalHtml = finalHtml.replace(`@@MATHBLOCK:${idx}@@`, mb);
	});
	mathInlines.forEach((mi, idx) => {
		finalHtml = finalHtml.replace(`@@MATHINLINE:${idx}@@`, mi);
	});
	inlineCodes.forEach((ic, idx) => {
		finalHtml = finalHtml.replace(`@@INLINECODE:${idx}@@`, ic);
	});

	return finalHtml;
}

