<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, slide } from 'svelte/transition';
	import { ThreeBodySpinner } from '#lib/common/design/icon/spinner';
	import type { AgentStep } from '../logic/types';

	interface Props {
		/** 에이전트 실행 단계 목록 (진행에 따라 상태 업데이트) */
		steps: readonly AgentStep[];
		/** 본문 답변 출력이 시작되었는지 여부 (시작 즉시 단계 목록 자동 접힘) */
		isTalking?: boolean;
		/** 모든 단계 완료 시 자동으로 접을지 여부 (기본값 true) */
		collapseWhenDone?: boolean;
		class?: string;
	}

	let {
		steps,
		isTalking = false,
		collapseWhenDone = true,
		class: className = ''
	}: Props = $props();

	const LINE_HEIGHT = 24;
	const VISIBLE_LINES = 3;
	const listId = $props.id();

	const running = $derived(steps.find((s) => s.status === 'running'));
	const failed = $derived(steps.find((s) => s.status === 'error'));
	const isDone = $derived(steps.length > 0 && steps.every((s) => s.status === 'done'));
	const isActive = $derived(Boolean(running));

	/* ── 전체 경과 시간(초) ── */
	let seconds = $state(0);
	let runStartMs: number | null = null;
	let runFinished = false;

	$effect(() => {
		if (isDone) {
			runFinished = true;
		}
	});

	$effect(() => {
		if (!isActive) return;
		if (runFinished) {
			runFinished = false;
			runStartMs = null;
		}
		const start = runStartMs ?? Date.now();
		runStartMs = start;
		const update = () => {
			seconds = Math.floor((Date.now() - start) / 1000);
		};
		update();
		const id = setInterval(update, 500);
		return () => clearInterval(id);
	});

	/* ── 단계별 소요 시간(ms) ── */
	let stepTimes = $state<Record<string, number>>({});
	const stepStarts: Record<string, number> = {};

	$effect(() => {
		const currentSteps = steps;
		untrack(() => {
			const now = Date.now();
			const nextTimes: Record<string, number> = {};
			let changed = false;

			for (const step of currentSteps) {
				if (step.status === 'pending') {
					delete stepStarts[step.id];
					if (step.id in stepTimes) changed = true;
					continue;
				}
				if (step.status === 'running' && step.id in stepTimes) {
					stepStarts[step.id] = now;
					changed = true;
				}
				stepStarts[step.id] ??= now;
				if (step.status === 'done' || step.status === 'error') {
					nextTimes[step.id] = stepTimes[step.id] ?? Math.max(100, now - stepStarts[step.id]);
					if (!(step.id in stepTimes)) changed = true;
				}
			}

			if (changed) {
				stepTimes = nextTimes;
			}
		});
	});

	/* ── 완료 또는 본문 발화 시작 시 자동 접힘 / 사용자 수동 토글 ── */
	const shouldCollapse = $derived((isDone || isTalking) && collapseWhenDone);
	let isOpen = $state(!untrack(() => (isDone || isTalking) && collapseWhenDone));
	let prevShouldCollapse = $state(untrack(() => (isDone || isTalking) && collapseWhenDone));

	$effect(() => {
		const nextCollapse = shouldCollapse;
		if (nextCollapse !== prevShouldCollapse) {
			prevShouldCollapse = nextCollapse;
			isOpen = !nextCollapse;
		}
	});

	function formatDuration(sec: number): string {
		if (sec < 60) return `${sec}s`;
		return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
	}

	function formatStepTime(ms: number): string {
		return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;
	}

	const headerTitle = $derived.by(() => {
		if (failed) return `중단됨: ${failed.label}`;
		if (isDone || isTalking)
			return seconds > 0 ? `${formatDuration(seconds)} 동안 생각함` : '생각 완료';
		if (running) return running.label;
		return '준비 중';
	});
</script>

<!-- AI 깊은 생각 · 도구 호출 단계 표시 컴포넌트 (Kokonut UI AI Loading State v2.0.0) -->
<div class="ai-loading-root {className}">
	<button
		type="button"
		class="ai-loading-header"
		class:is-collapsed={!isOpen}
		aria-controls={listId}
		aria-expanded={isOpen}
		onclick={() => (isOpen = !isOpen)}
	>
		{#if isActive && !isTalking}
			<span class="header-spinner" in:fade={{ duration: 150 }}>
				<ThreeBodySpinner size={16} label="깊은 생각 중" />
			</span>
		{/if}
		<output class="header-title">{headerTitle}</output>
		{#if isActive && !isTalking}
			<span class="header-meta">{formatDuration(seconds)}</span>
		{/if}
		{#if isDone || isTalking}
			<span class="header-meta">· {steps.length}단계</span>
		{/if}
		<svg
			class="header-chevron"
			class:is-open={isOpen}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if isOpen}
		<ol
			id={listId}
			class="step-list"
			transition:slide={{ duration: 240, easing: cubicOut }}
		>
			{#each steps as step, i (step.id)}
				{@const isLast = i === steps.length - 1}
				{@const time = stepTimes[step.id]}
				{@const lines = step.detail ?? []}
				{@const logOffset = Math.max(0, lines.length - VISIBLE_LINES)}
				<li class="step-row">
					{#if !isLast}
						<span class="step-rail" aria-hidden="true">
							<span class="step-rail-fill" class:is-done={step.status === 'done'}></span>
						</span>
					{/if}

					<span class="step-icon-box">
						{#key step.status}
							<span class="step-icon-inner" in:fade={{ duration: 160 }}>
								{#if step.status === 'pending'}
									<span class="icon-dot"></span>
								{:else if step.status === 'running'}
									<svg class="icon-spin" viewBox="0 0 16 16" fill="none" aria-hidden="true">
										<circle class="spin-track" cx="8" cy="8" r="6.25" stroke-width="1.5" />
										<path
											class="spin-arc"
											d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
											stroke-linecap="round"
											stroke-width="1.5"
										/>
									</svg>
								{:else if step.status === 'done'}
									<svg class="icon-done" viewBox="0 0 16 16" fill="none" aria-hidden="true">
										<path
											class="check-path"
											d="M3.5 8.5 6.5 11.5 12.5 4.5"
											stroke="currentColor"
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="1.75"
											pathLength="1"
										/>
									</svg>
								{:else}
									<svg class="icon-error" viewBox="0 0 16 16" fill="none" aria-hidden="true">
										<path
											d="M4.5 4.5l7 7m0-7-7 7"
											stroke="currentColor"
											stroke-linecap="round"
											stroke-width="1.75"
										/>
									</svg>
								{/if}
							</span>
						{/key}
					</span>

					<div class="step-body">
						<div class="step-label-row">
							<p class="step-label is-{step.status}">
								{#if step.status === 'running'}
									<span class="sr-only">{step.label}</span>
									<span aria-hidden="true">
										{#each Array.from(step.label) as char, ci (ci)}
											<span class="ai-wave-char" style:animation-delay="{ci * 0.045}s">{char}</span>
										{/each}
									</span>
								{:else}
									{step.label}
								{/if}
							</p>
							{#if time !== undefined}
								<span class="step-time" in:fade={{ duration: 180 }}>
									{formatStepTime(time)}
								</span>
							{/if}
						</div>

						{#if (step.status === 'running' || step.status === 'done') && lines.length > 0}
							<div
								class="step-log"
								class:is-done={step.status === 'done'}
								class:has-fade={lines.length > VISIBLE_LINES - 1}
								style:height="{LINE_HEIGHT * Math.min(lines.length, VISIBLE_LINES)}px"
								aria-hidden="true"
							>
								<div
									class="step-log-track"
									style:transform="translateY({-logOffset * LINE_HEIGHT}px)"
								>
									{#each lines as line, li (`${li}-${line}`)}
										<div class="step-log-line" style:height="{LINE_HEIGHT}px" in:fade={{ duration: 180 }}>
											<span class="log-idx">{li + 1}</span>
											<span class="log-text">{line}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.ai-loading-root {
		width: 100%;
		margin-bottom: 6px;
	}

	.ai-loading-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 2px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--white-3);
		font: inherit;
		font-size: 0.875rem;
		font-weight: var(--fw-medium);
		text-align: left;
		cursor: pointer;
		outline: none;
		-webkit-tap-highlight-color: transparent;
		transition: color 0.16s ease;
	}

	.header-spinner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ai-loading-header.is-collapsed {
		color: var(--muted);
	}

	.ai-loading-header:hover {
		color: var(--white-2);
	}

	.ai-loading-header:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--white) 22%, transparent);
	}

	.header-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.header-meta {
		flex-shrink: 0;
		font-size: 0.78rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.header-chevron {
		margin-left: auto;
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		color: var(--muted);
		transition:
			transform 0.2s cubic-bezier(0.23, 1, 0.32, 1),
			color 0.16s ease;
	}

	.ai-loading-header:hover .header-chevron {
		color: var(--fg);
	}

	.header-chevron.is-open {
		transform: rotate(180deg);
	}

	.step-list {
		list-style: none;
		margin: 0;
		padding: 0 0 4px;
		overflow: hidden;
	}

	.step-row {
		position: relative;
		display: flex;
		gap: 12px;
		padding-top: 14px;
	}

	.step-rail {
		position: absolute;
		top: 34px;
		bottom: -10px;
		left: 7.5px;
		width: 1px;
		overflow: hidden;
		background: color-mix(in srgb, var(--white) 12%, transparent);
	}

	.step-rail-fill {
		display: block;
		width: 100%;
		height: 100%;
		transform-origin: top;
		transform: scaleY(0);
		background: var(--muted);
		transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.step-rail-fill.is-done {
		transform: scaleY(1);
	}

	.step-icon-box {
		position: relative;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.step-icon-inner {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--line);
	}

	.icon-spin {
		width: 14px;
		height: 14px;
		animation: ai-step-spin 0.8s linear infinite;
	}

	.spin-track {
		stroke: color-mix(in srgb, var(--white) 16%, transparent);
	}

	.spin-arc {
		stroke: var(--white-2);
	}

	.icon-done {
		width: 14px;
		height: 14px;
		color: var(--white-2);
	}

	.check-path {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: ai-check-draw 0.3s cubic-bezier(0.23, 1, 0.32, 1) 0.05s forwards;
	}

	.icon-error {
		width: 14px;
		height: 14px;
		color: var(--danger);
	}

	.step-body {
		margin-top: -1px;
		min-width: 0;
		flex: 1;
	}

	.step-label-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.step-label {
		margin: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.875rem;
		line-height: 1.4;
		transition: color 0.2s ease;
	}

	.step-label.is-pending {
		color: color-mix(in srgb, var(--muted) 72%, transparent);
	}

	.step-label.is-running {
		color: var(--white-2);
	}

	.step-label.is-done {
		color: var(--muted);
	}

	.step-label.is-error {
		color: var(--danger);
	}

	.ai-wave-char {
		display: inline;
		white-space: pre;
		animation: ai-step-wave 1.6s ease-in-out infinite both;
	}

	.step-time {
		margin-left: auto;
		flex-shrink: 0;
		font-size: 0.72rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.step-log {
		position: relative;
		margin-top: 4px;
		overflow: hidden;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		transition: height 240ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.step-log.is-done {
		opacity: 0.72;
	}

	.step-log.has-fade {
		-webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.25), black 70%);
		mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.25), black 70%);
	}

	.step-log-track {
		transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.step-log-line {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
	}

	.log-idx {
		width: 14px;
		flex-shrink: 0;
		text-align: right;
		user-select: none;
		color: color-mix(in srgb, var(--muted) 55%, transparent);
		font-variant-numeric: tabular-nums;
	}

	.log-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes ai-step-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes ai-check-draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes ai-step-wave {
		50% {
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.icon-spin,
		.ai-wave-char {
			animation: none;
		}

		.check-path {
			animation: none;
			stroke-dashoffset: 0;
		}

		.step-rail-fill,
		.step-log-track,
		.header-chevron {
			transition: none;
		}
	}
</style>
