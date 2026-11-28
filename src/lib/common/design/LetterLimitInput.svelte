<script lang="ts">
	import { onDestroy, onMount, tick, untrack, type Snippet } from 'svelte';
	import FdButton from './fluid/FdButton.svelte';
	import { FluidSetting } from '../type/fluid';
	import { createLetterLimitMotion } from '../logic/letterLimitMotion';

	export type LetterLimitMode = 'default' | 'slim' | 'plain';

	interface Props {
		/** 현재 입력 텍스트 */
		value: string;
		/** 최대 글자 수 (초과 입력 시 글자 낙하 물리 발동) */
		maxLength?: number;
		/** 경고 색상(주황) 진입 남은 글자 수 임계치 */
		nearThreshold?: number;
		/**
		 * 표시 모드:
		 * - 'default': 멀티라인 textarea + 하단 툴바(파일첨부·원형 미터·카운트·제출 버튼)
		 * - 'slim': 단일행 input + 우측 끝 남은 글자 수 + FdButton 제출 버튼
		 * - 'plain': 단일행 input + 초과 글자 낙하 물리만 (카운트·버튼 숨김)
		 */
		mode?: LetterLimitMode;
		/** 하위 호환용 슬림 모드 축약 플래그 (mode 미지정 시 'slim' 적용) */
		slim?: boolean;
		/** 단일행 input type ('text' | 'tel' | 'email' | 'search') */
		type?: 'text' | 'tel' | 'email' | 'search';
		/** 모바일 가상 키보드 힌트 */
		inputmode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal' | 'search' | 'url' | 'none';
		/** 제출 가능 여부 (false 시 제출 버튼 비활성화) */
		canSubmit?: boolean;
		/** 입력 전체 비활성화 */
		disabled?: boolean;
		/** 플레이스홀더 */
		placeholder?: string;
		/** 접근성 라벨 */
		ariaLabel?: string;
		/** 오류 상태 스타일 */
		hasError?: boolean;
		/** 기본 제출 버튼 라벨 (submitButton 스니펫 미지정 시 사용) */
		submitLabel?: string;
		/** 외부에서 강제 포커스 스타일 강조 (예: 드래그 오버) */
		forceFocused?: boolean;
		/** Enter 입력 시 keepFocus 전달 여부 (기본 true) */
		keepFocusOnEnter?: boolean;
		/** 입력 엘리먼트 바인딩 */
		inputEl?: HTMLTextAreaElement | HTMLInputElement;
		/** 추가 루트 클래스 */
		class?: string;
		/** 값 변경 콜백 */
		onChangeValue?: (next: string) => void;
		/** 제출 콜백 (keepFocus 인자 포함) */
		onSubmit?: (keepFocus: boolean) => void;
		/** Escape 키 콜백 */
		onEscape?: () => void;
		/** 일반 모드 상단 트레이 슬롯 (예: 첨부파일 미리보기) */
		topTray?: Snippet;
		/** 일반 모드 카드 오버레이 슬롯 (예: 드래그 앤 드롭 오버레이) */
		overlay?: Snippet;
		/** 일반 모드 하단 좌측 액션 슬롯 (예: 파일 첨부 버튼) */
		footLeading?: Snippet;
		/** 커스텀 제출 버튼 슬롯 (예: 챗봇 FdButton + ArrowRightIcon) */
		submitButton?: Snippet<[{ canSubmit: boolean }]>;
	}

	let {
		value,
		maxLength = 100,
		nearThreshold,
		mode,
		slim = false,
		type = 'text',
		inputmode,
		canSubmit = true,
		disabled = false,
		placeholder = '',
		ariaLabel = '입력',
		hasError = false,
		submitLabel = '확인',
		forceFocused = false,
		keepFocusOnEnter = true,
		inputEl = $bindable(undefined),
		class: className = '',
		onChangeValue,
		onSubmit,
		onEscape,
		topTray,
		overlay,
		footLeading,
		submitButton
	}: Props = $props();

	const TEXTAREA_MIN_HEIGHT = 22;
	const TEXTAREA_MAX_HEIGHT = 160;

	let mirrorEl = $state<HTMLDivElement | undefined>(undefined);
	let fillCircleEl = $state<SVGCircleElement | undefined>(undefined);
	let meterSvgEl = $state<SVGSVGElement | undefined>(undefined);
	let countEl = $state<HTMLSpanElement | undefined>(undefined);
	let sendWrapEl = $state<HTMLDivElement | undefined>(undefined);
	let pileEl = $state<HTMLDivElement | undefined>(undefined);

	let isFocused = $state(false);

	const resolvedMode = $derived<LetterLimitMode>(mode ?? (slim ? 'slim' : 'default'));
	const isSingleLine = $derived(resolvedMode === 'slim' || resolvedMode === 'plain');
	const isPlain = $derived(resolvedMode === 'plain');
	const isSlim = $derived(resolvedMode === 'slim');
	const submitReady = $derived(canSubmit && !disabled);

	const resolvedNear = $derived(
		nearThreshold ?? Math.max(1, Math.min(15, Math.floor(maxLength * 0.2)))
	);
	const remaining = $derived(Math.max(0, maxLength - value.length));
	const isNear = $derived(!isPlain && remaining <= resolvedNear && remaining > 0);
	const isFull = $derived(!isPlain && remaining <= 0);

	const DEFAULT_SUBMIT_ACTIVE_SETTING = new FluidSetting({
		radius: 10,
		inset: 3,
		reach: 16,
		bulge: 2.2,
		bulgeWidth: 12,
		layers: 2,
		layerGap: 1.4,
		waveAmp: 1.2,
		waveLength: 36,
		spin: 1.0,
		pauseWhenIdle: true,
		color: 'var(--white-2)',
		hoverColor: 'var(--white)',
		pressColor: 'var(--white-3)',
		waveColor: 'var(--white-3)',
		hoverWaveColor: 'var(--white-3)',
		textColor: 'var(--bg)',
		borderWidth: 0
	});

	const DEFAULT_SUBMIT_DISABLED_SETTING = DEFAULT_SUBMIT_ACTIVE_SETTING.with({
		hoverReactive: false,
		bulgeReactive: false,
		clickReactive: false,
		layerGap: 0,
		waveAmp: 0,
		color: 'var(--surface-2)',
		hoverColor: 'var(--surface-2)',
		pressColor: 'var(--surface-2)',
		waveColor: 'var(--surface-2)',
		hoverWaveColor: 'var(--surface-2)',
		textColor: 'var(--muted)'
	});

	const defaultSubmitSetting = $derived(
		submitReady ? DEFAULT_SUBMIT_ACTIVE_SETTING : DEFAULT_SUBMIT_DISABLED_SETTING
	);

	const motion = createLetterLimitMotion({
		getInput: () => inputEl,
		getMirror: () => mirrorEl,
		getFillCircle: () => (resolvedMode === 'default' ? fillCircleEl : undefined),
		getMeterSvg: () => (resolvedMode === 'default' ? meterSvgEl : undefined),
		getCountEl: () => (isPlain ? undefined : countEl),
		getSendWrap: () => (isPlain ? undefined : sendWrapEl),
		getPileEl: () => pileEl
	});

	function autoResizeTextarea() {
		if (isSingleLine || !inputEl || !(inputEl instanceof HTMLTextAreaElement)) return;
		inputEl.style.height = 'auto';
		const nextH = Math.min(TEXTAREA_MAX_HEIGHT, Math.max(TEXTAREA_MIN_HEIGHT, inputEl.scrollHeight));
		inputEl.style.height = `${nextH}px`;
	}

	onMount(() => {
		autoResizeTextarea();
		motion.syncLength(value.length, maxLength);
		motion.render();
	});

	$effect(() => {
		const len = value.length;
		const limit = maxLength;
		const single = isSingleLine;
		untrack(() => {
			if (!single) autoResizeTextarea();
			motion.syncLength(len, limit);
		});
	});

	onDestroy(() => {
		motion.destroy();
	});

	function handleFieldInput(e: Event & { currentTarget: HTMLTextAreaElement | HTMLInputElement }) {
		const field = e.currentTarget;
		let v = field.value;
		if (v.length > maxLength) {
			const caret = field.selectionStart ?? maxLength;
			const extra = v.slice(maxLength);
			v = v.slice(0, maxLength);
			field.value = v;
			if (document.activeElement === field) {
				const pos = Math.min(caret, maxLength);
				field.setSelectionRange(pos, pos);
			}
			motion.drop(extra, v);
		}
		onChangeValue?.(v);
		// 상위에서 값을 정규화/포맷(예: 전화번호 하이픈)한 경우 DOM 입력값을 제어 값과 즉시 동기화
		void tick().then(() => {
			if (field && field.value !== value) {
				field.value = value;
			}
		});
	}

	function triggerSubmit(keepFocus: boolean) {
		if (!submitReady || isPlain) return;
		motion.triggerSendPress();
		onSubmit?.(keepFocus);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isPlain && (isSingleLine || !e.shiftKey)) {
			if (e.isComposing) return;
			e.preventDefault();
			triggerSubmit(keepFocusOnEnter);
		} else if (e.key === 'Escape') {
			onEscape?.();
		}
	}

	function handleCardClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (target?.closest('button, .preview-chip, .ll-submit-wrap')) return;
		if (!disabled && document.activeElement !== inputEl) {
			inputEl?.focus();
		}
	}
</script>

<!-- 공용 Letter Limit 입력 컴포넌트 (default 멀티라인 · slim 단일행+카운트+FdButton · plain 드롭 전용) -->
<div
	class="ll-root {className}"
	class:is-slim={isSlim}
	class:is-plain={isPlain}
>
	<div bind:this={pileEl} class="ll-pile" aria-hidden="true"></div>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="ll-card"
		class:is-slim={isSlim}
		class:is-plain={isPlain}
		class:is-focused={isFocused || forceFocused}
		class:is-near={isNear}
		class:is-full={isFull}
		class:has-error={hasError}
		onclick={handleCardClick}
	>
		{#if !isSingleLine && overlay}
			{@render overlay()}
		{/if}

		{#if !isSingleLine && topTray}
			{@render topTray()}
		{/if}

		{#if isSingleLine}
			<!-- 단일행 모드 (slim: 카운트 + FdButton 포함 / plain: 순수 입력 + 낙하 물리만) -->
			<div class="ll-slim-row">
				<div class="ll-area is-single">
					<input
						bind:this={inputEl}
						{type}
						{inputmode}
						{value}
						{placeholder}
						{disabled}
						spellcheck="false"
						autocomplete="off"
						aria-label={ariaLabel}
						aria-invalid={hasError || undefined}
						class="ll-input"
						class:is-plain={isPlain}
						oninput={handleFieldInput}
						onkeydown={handleKeyDown}
						onfocus={() => (isFocused = true)}
						onblur={() => (isFocused = false)}
					/>
					<div
						bind:this={mirrorEl}
						class="ll-mirror is-single"
						class:is-plain={isPlain}
						aria-hidden="true"
					></div>
				</div>

				{#if isSlim}
					<span bind:this={countEl} class="ll-count is-slim" aria-live="polite">{remaining}</span>

					<div bind:this={sendWrapEl} class="ll-submit-wrap is-slim">
						{#if submitButton}
							{@render submitButton({ canSubmit: submitReady })}
						{:else}
							<FdButton
								type="button"
								setting={defaultSubmitSetting}
								disabled={!submitReady}
								class="ll-default-fd-btn is-slim"
								onclick={() => triggerSubmit(false)}
							>
								{submitLabel}
							</FdButton>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<!-- 일반 모드: 자동 높이 멀티라인 textarea + 하단 액션바(파일첨부·원형 미터·카운트·제출 버튼) -->
			<div class="ll-area">
				<textarea
					bind:this={inputEl}
					rows="1"
					{value}
					{placeholder}
					{disabled}
					spellcheck="false"
					autocomplete="off"
					aria-label={ariaLabel}
					aria-invalid={hasError || undefined}
					class="ll-textarea"
					oninput={handleFieldInput}
					onkeydown={handleKeyDown}
					onfocus={() => (isFocused = true)}
					onblur={() => (isFocused = false)}
				></textarea>
				<div bind:this={mirrorEl} class="ll-mirror" aria-hidden="true"></div>
			</div>

			<div class="ll-foot">
				{#if footLeading}
					{@render footLeading()}
				{/if}

				<div class="ll-meter-group">
					<svg bind:this={meterSvgEl} class="ll-meter" viewBox="0 0 24 24" aria-hidden="true">
						<circle class="ll-track" cx="12" cy="12" r="9" />
						<circle bind:this={fillCircleEl} class="ll-fill" cx="12" cy="12" r="9" pathLength="1" />
					</svg>
					<span bind:this={countEl} class="ll-count" aria-live="polite">{remaining}</span>
				</div>

				<div bind:this={sendWrapEl} class="ll-submit-wrap">
					{#if submitButton}
						{@render submitButton({ canSubmit: submitReady })}
					{:else}
						<FdButton
							type="button"
							setting={defaultSubmitSetting}
							disabled={!submitReady}
							class="ll-default-fd-btn"
							onclick={() => triggerSubmit(false)}
						>
							{submitLabel}
						</FdButton>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.ll-root {
		position: relative;
		width: 100%;
	}

	.ll-pile {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 250;
	}

	.ll-pile :global(.ll-falling-char) {
		position: absolute;
		left: 0;
		top: 0;
		width: 20px;
		height: 24px;
		margin: -12px 0 0 -10px;
		text-align: center;
		font-size: 0.92rem;
		font-weight: var(--fw-medium);
		line-height: 24px;
		color: var(--danger);
		will-change: transform, opacity;
	}

	.ll-card {
		position: relative;
		width: 100%;
		padding: 14px;
		border-radius: var(--ll-radius, var(--bot-input-radius, 22px));
		background: var(--ll-bg, var(--surface));
		border: none;
		display: flex;
		flex-direction: column;
		cursor: text;
		box-sizing: border-box;
		transition: background-color 0.18s ease;
	}

	.ll-card.is-slim {
		padding: 8px 8px 8px 14px;
		border-radius: var(--ll-radius, 14px);
		background: var(--ll-bg, var(--surface-dim));
	}

	.ll-card.is-plain {
		height: var(--ll-height, 46px);
		padding: var(--ll-padding, 0 0.9rem);
		border-radius: var(--ll-radius, 12px);
		background: var(--ll-bg, var(--surface-dim));
		justify-content: center;
	}

	.ll-card.is-focused {
		background: var(--ll-bg-focus, color-mix(in srgb, var(--surface-2) 55%, var(--surface)));
	}

	.ll-card.is-slim.is-focused {
		background: var(--ll-bg-focus, var(--surface-1));
	}

	.ll-card.is-plain.is-focused {
		background: var(--ll-bg-focus, var(--surface-1));
	}

	.ll-card.has-error {
		background: color-mix(in srgb, var(--toast-error-bg) 42%, var(--surface));
	}

	.ll-slim-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-width: 0;
	}

	.ll-area {
		position: relative;
		width: 100%;
	}

	.ll-area.is-single {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.ll-textarea,
	.ll-input,
	.ll-mirror {
		display: block;
		width: 100%;
		min-height: 22px;
		padding: 0;
		border: 0;
		margin: 0;
		background: transparent;
		resize: none;
		font-family: inherit;
		font-size: var(--ll-font-size, 0.9rem);
		font-weight: var(--fw-regular);
		line-height: 22px;
		letter-spacing: -0.01em;
		color: var(--fg);
		box-sizing: border-box;
	}

	.ll-textarea,
	.ll-mirror:not(.is-single) {
		white-space: pre-wrap;
		overflow-wrap: break-word;
	}

	.ll-input,
	.ll-mirror.is-single {
		height: 32px;
		line-height: 32px;
		white-space: pre;
		overflow: hidden;
		font-size: var(--ll-font-size, 0.94rem);
		font-weight: var(--fw-medium);
		color: var(--white);
	}

	.ll-input.is-plain,
	.ll-mirror.is-single.is-plain {
		font-size: var(--ll-font-size, 0.92rem);
		font-weight: var(--fw-regular);
	}

	.ll-textarea {
		max-height: 160px;
		overflow-y: auto;
		caret-color: var(--white);
		user-select: text;
		-webkit-user-select: text;
		outline: none;
		scrollbar-width: none;
	}

	.ll-input {
		caret-color: var(--white);
		user-select: text;
		-webkit-user-select: text;
		outline: none;
	}

	.ll-textarea::-webkit-scrollbar {
		display: none;
	}

	.ll-textarea::placeholder,
	.ll-input::placeholder {
		color: var(--muted);
		opacity: 0.78;
	}

	.ll-textarea:disabled,
	.ll-input:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.ll-mirror {
		position: absolute;
		left: 0;
		top: 0;
		visibility: hidden;
		pointer-events: none;
		overflow: hidden;
	}

	.ll-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}

	.ll-meter-group {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: 2px;
	}

	.ll-meter {
		width: 22px;
		height: 22px;
		transform: rotate(-90deg);
		will-change: transform;
		flex-shrink: 0;
	}

	.ll-meter circle {
		fill: none;
		stroke-width: 2.6;
	}

	.ll-meter .ll-track {
		stroke: color-mix(in srgb, var(--white) 14%, transparent);
	}

	.ll-meter .ll-fill {
		stroke: color-mix(in srgb, var(--white) 78%, transparent);
		stroke-linecap: round;
		stroke-dasharray: 1 1;
		stroke-dashoffset: 1;
		transition: stroke 0.2s ease;
	}

	.ll-count {
		font-size: 0.78rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		will-change: transform;
		transition: color 0.2s ease;
		min-width: 22px;
	}

	.ll-count.is-slim {
		text-align: right;
		flex-shrink: 0;
		min-width: 18px;
	}

	.ll-card.is-near .ll-meter .ll-fill {
		stroke: var(--warning);
	}

	.ll-card.is-near .ll-count {
		color: var(--warning);
	}

	.ll-card.is-full .ll-meter .ll-fill {
		stroke: var(--danger);
	}

	.ll-card.is-full .ll-count {
		color: var(--danger);
	}

	.ll-submit-wrap {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		will-change: transform;
	}

	.ll-submit-wrap.is-slim {
		margin-left: 0;
		margin-top: -3px;
		margin-bottom: -3px;
		margin-right: -3px;
	}

	.ll-submit-wrap :global(.fd-btn.ll-default-fd-btn) {
		height: 32px;
		padding: 0 14px;
		font-size: 0.82rem;
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
	}
</style>
