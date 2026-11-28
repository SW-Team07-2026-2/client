<script lang="ts">
	import { renderMarkdown } from '../logic/markdown';

	interface Props {
		content: string;
		class?: string;
	}

	let { content, class: className = '' }: Props = $props();

	const renderedHtml = $derived(renderMarkdown(content));
</script>

<div class="bot-md-content {className}">
	{@html renderedHtml}
</div>

<style>
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

	:global(.bot-md-content .md-h5) {
		font-size: 0.88rem;
		font-weight: 600;
		color: #e4e4e7;
		margin: 0.55rem 0 0.3rem 0;
	}

	:global(.bot-md-content .md-del) {
		text-decoration: line-through;
		color: rgba(255, 255, 255, 0.45);
	}

	/* 마크다운 링크 */
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

	/* 목록 아이콘 및 인덴트 보정 */
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
		background: rgba(20, 22, 32, 0.72);
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

	:global(.bot-md-content .md-code-block::-webkit-scrollbar),
	:global(.bot-md-content .md-table-wrap::-webkit-scrollbar) {
		height: 4px;
		width: 4px;
	}

	:global(.bot-md-content .md-code-block::-webkit-scrollbar-track),
	:global(.bot-md-content .md-table-wrap::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(.bot-md-content .md-code-block::-webkit-scrollbar-thumb),
	:global(.bot-md-content .md-table-wrap::-webkit-scrollbar-thumb) {
		background: rgba(255, 255, 255, 0.12);
		border-radius: 4px;
	}

	:global(.bot-md-content .md-code-block::-webkit-scrollbar-thumb:hover),
	:global(.bot-md-content .md-table-wrap::-webkit-scrollbar-thumb:hover) {
		background: rgba(255, 255, 255, 0.25);
	}

	/* LaTeX 수식 렌더링 스타일 */
	:global(.bot-md-content .md-math-inline) {
		font-family: 'Cambria Math', 'Times New Roman', Georgia, serif;
		font-size: 1.02em;
		letter-spacing: 0.01em;
		color: var(--white-2);
	}

	:global(.bot-md-content .md-math-block) {
		margin: 0.75rem 0;
		padding: 0.7rem 1rem;
		border-radius: 10px;
		background: color-mix(in srgb, var(--white) 5%, transparent);
		text-align: center;
		overflow-x: auto;
		font-family: 'Cambria Math', 'Times New Roman', Georgia, serif;
		font-size: 1.08rem;
		line-height: 1.6;
		color: var(--white);
	}

	:global(.bot-md-content .md-math-var) {
		font-style: italic;
	}

	:global(.bot-md-content .md-math-text) {
		font-style: normal;
	}

	:global(.bot-md-content .md-math-op) {
		margin: 0 0.14em;
		font-style: normal;
	}

	:global(.bot-md-content .md-frac) {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		vertical-align: middle;
		margin: 0 0.2em;
		font-size: 0.88em;
		line-height: 1.15;
	}

	:global(.bot-md-content .md-frac-num) {
		padding: 0 0.2em 0.1em;
		border-bottom: 1px solid currentColor;
	}

	:global(.bot-md-content .md-frac-den) {
		padding: 0.1em 0.2em 0;
	}

	:global(.bot-md-content .md-sqrt) {
		display: inline-flex;
		align-items: baseline;
	}

	:global(.bot-md-content .md-sqrt-inner) {
		border-top: 1px solid currentColor;
		padding: 0 0.12em;
		margin-left: 0.04em;
	}
</style>

