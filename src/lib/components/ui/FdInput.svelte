<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import FdDiv from './FdDiv.svelte';
	import { FluidSetting } from '#lib/fluid/setting';

	interface Props extends Omit<HTMLInputAttributes, 'size' | 'prefix' | 'value'> {
		/** 입력 값 (양방향 바인딩 지원 bind:value) */
		value?: string | number;
		/** 입력 타입 ('text', 'password', 'email', 'number', 'search', 'tel', 'url' 등) */
		type?: string;
		/** 플레이스홀더 텍스트 */
		placeholder?: string;
		/** placeholder 텍스트 변경 시 부드러운 크로스페이드/슬라이드 전환 여부 */
		animatePlaceholder?: boolean;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 읽기 전용 여부 */
		readonly?: boolean;
		/** 필수 입력 여부 */
		required?: boolean;
		/** 자동 포커스 */
		autofocus?: boolean;

		/* ── 아이콘 및 슬롯 ── */
		/** 입력창 앞쪽 아이콘/요소 스니펫 */
		prefix?: Snippet;
		/** 입력창 뒤쪽 아이콘/요소 스니펫 */
		suffix?: Snippet;
		/** 입력창 앞쪽 고정 텍스트 (예: "$", "https://") */
		prefixText?: string;
		/** 입력창 뒤쪽 고정 텍스트 (예: "원", "kg", ".com") */
		suffixText?: string;

		/* ── 편의 기능 ── */
		/** 내용이 있을 때 우측에 원클릭 지우기(X) 버튼 표시 여부 */
		clearable?: boolean;
		/** type="password" 일 때 비밀번호 표시/숨김 토글 버튼 표시 여부 */
		showPasswordToggle?: boolean;
		/** 가로 폭 100% 채움 여부 */
		fullWidth?: boolean;
		/** 크기 프리셋 ('sm' | 'md' | 'lg') 또는 최소 높이(px) */
		size?: 'sm' | 'md' | 'lg' | number;
		/** Enter 키 입력 시 콜백 */
		onenter?: (val: string | number) => void;
		/** 지우기 버튼 클릭 시 콜백 */
		onclear?: () => void;
		/** 내부 input 엘리먼트 ref 바인딩용 (bind:inputRef) */
		inputRef?: HTMLInputElement;
		/** 내부 input 태그에 직접 지정할 추가 클래스 */
		inputClass?: string;

		/* ── FluidSetting 및 개별 스타일 오버라이드 props ── */
		/** 비포커스(기본/호버) 상태의 FluidSetting */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 포커스 상태의 FluidSetting (생략 시 setting 기반으로 상시 물결 활성화) */
		focusSetting?: FluidSetting | Partial<FluidSetting>;
		radius?: number;
		reach?: number;
		bulge?: number;
		bulgeWidth?: number;
		layers?: number;
		waveColor?: string;
		focusWaveColor?: string;
		color?: string;
		hoverColor?: string;
		focusColor?: string;
		pressColor?: string;
		textColor?: string;
		placeholderColor?: string;
		inset?: number;
		class?: string;
		style?: string;
	}

	let {
		value = $bindable(''),
		type = 'text',
		placeholder = '',
		animatePlaceholder = false,
		disabled = false,
		readonly = false,
		required = false,
		autofocus = false,
		prefix,
		suffix,
		prefixText,
		suffixText,
		clearable = false,
		showPasswordToggle = false,
		fullWidth = false,
		size = 'md',
		onenter,
		onclear,
		inputRef = $bindable(undefined),
		inputClass = '',
		setting,
		focusSetting,
		radius,
		reach,
		bulge,
		bulgeWidth,
		layers,
		waveColor,
		focusWaveColor,
		color,
		hoverColor,
		focusColor,
		pressColor,
		textColor,
		placeholderColor,
		inset: insetProp,
		class: klass = '',
		style = '',
		oninput,
		onchange,
		onfocus,
		onblur,
		onkeydown,
		...rest
	}: Props = $props();

	let inputEl: HTMLInputElement;
	let focused = $state(false);
	let isPasswordVisible = $state(false);
	const isEmpty = $derived(value === '' || value === undefined || value === null);

	$effect(() => {
		inputRef = inputEl;
	});

	const effectiveType = $derived.by(() => {
		if (type === 'password' && showPasswordToggle) {
			return isPasswordVisible ? 'text' : 'password';
		}
		return type;
	});

	// 1. 기본/호버 상태 FluidSetting (FdInput 기본값: pressColor='#f3f4f6', pressDeform={ x: 1.2, y: -2.0 })
	const baseCfg = $derived.by(() => {
		const s = FluidSetting.from(setting);
		const patch: Partial<FluidSetting> = {
			pressColor: pressColor ?? setting?.pressColor ?? '#f3f4f6',
			pressDeform: setting?.pressDeform ?? { x: 1.2, y: -2.0 },
			pauseWhenIdle: true
		};
		if (radius !== undefined) patch.radius = radius;
		if (reach !== undefined) patch.reach = reach;
		if (bulge !== undefined) patch.bulge = bulge;
		if (bulgeWidth !== undefined) patch.bulgeWidth = bulgeWidth;
		if (layers !== undefined) patch.layers = layers;
		if (color !== undefined) patch.color = color;
		if (hoverColor !== undefined) patch.hoverColor = hoverColor;
		if (waveColor !== undefined) patch.waveColor = waveColor;
		if (textColor !== undefined) patch.textColor = textColor;
		return s.with(patch);
	});

	// 2. 포커스 상태 FluidSetting (포커스 중에는 물결이 멈추지 않도록 pauseWhenIdle=false)
	const focusCfg = $derived.by(() => {
		const defaultFocus = baseCfg.with({
			pauseWhenIdle: false,
			color: focusColor ?? baseCfg.hoverColor ?? baseCfg.color,
			hoverColor: focusColor ?? baseCfg.hoverColor ?? baseCfg.color,
			waveColor: focusWaveColor ?? focusColor ?? baseCfg.waveColor ?? baseCfg.hoverColor
		});
		const merged = focusSetting ? defaultFocus.with(focusSetting) : defaultFocus;
		const patch: Partial<FluidSetting> = { pauseWhenIdle: false };
		if (radius !== undefined) patch.radius = radius;
		if (reach !== undefined) patch.reach = reach;
		if (bulge !== undefined) patch.bulge = bulge;
		if (bulgeWidth !== undefined) patch.bulgeWidth = bulgeWidth;
		if (focusColor !== undefined) {
			patch.color = focusColor;
			patch.hoverColor = focusColor;
		}
		if (focusWaveColor !== undefined) patch.waveColor = focusWaveColor;
		if (textColor !== undefined) patch.textColor = textColor;
		return merged.with(patch);
	});

	const sharedInset = $derived(
		insetProp ?? Math.max(baseCfg.computedInset, focusCfg.computedInset)
	);

	const currentSetting = $derived(
		(focused ? focusCfg : baseCfg).with({ inset: sharedInset })
	);

	function handleBoxClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (target?.closest('button')) return;
		if (document.activeElement !== inputEl) {
			inputEl?.focus();
		}
	}

	function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
		value = e.currentTarget.value;
		oninput?.(e);
	}

	function handleChange(e: Event & { currentTarget: HTMLInputElement }) {
		value = e.currentTarget.value;
		onchange?.(e);
	}

	function handleKeyDown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Enter') {
			onenter?.(value);
		}
		onkeydown?.(e);
	}

	function handleFocus(e: FocusEvent & { currentTarget: HTMLInputElement }) {
		focused = true;
		onfocus?.(e);
	}

	function handleBlur(e: FocusEvent & { currentTarget: HTMLInputElement }) {
		focused = false;
		onblur?.(e);
	}

	function handleClear(e: MouseEvent) {
		e.stopPropagation();
		value = '';
		onclear?.();
		inputEl?.focus();
	}

	function togglePasswordVisibility(e: MouseEvent) {
		e.stopPropagation();
		isPasswordVisible = !isPasswordVisible;
		inputEl?.focus();
	}

	/* ── 외부에 공개하는 편의 메서드 ── */
	export function focus() {
		inputEl?.focus();
	}
	export function blur() {
		inputEl?.blur();
	}
	export function select() {
		inputEl?.select();
	}
	export function clear() {
		value = '';
		onclear?.();
		inputEl?.focus();
	}
</script>

<FdDiv
	setting={currentSetting}
	{disabled}
	{fullWidth}
	class="lq-input {klass}"
	bodyClass="input-box {typeof size === 'string' ? `size-${size}` : ''}"
	data-focused={focused || undefined}
	data-readonly={readonly || undefined}
	style="--lq-placeholder: {placeholderColor ?? '#a3a3a3'}; {typeof size === 'number'
		? `--lq-input-min-h: ${size}px;`
		: ''} {style}"
	onclick={handleBoxClick}
>
	{#if prefix}
		<div class="input-slot input-prefix" aria-hidden="true">
			{@render prefix()}
		</div>
	{:else if prefixText}
		<span class="input-text-affix input-prefix-text" aria-hidden="true">{prefixText}</span>
	{/if}

	<div class="input-field-wrap">
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:this={inputEl}
			type={effectiveType}
			bind:value
			placeholder={animatePlaceholder ? undefined : placeholder}
			aria-placeholder={animatePlaceholder && placeholder ? placeholder : undefined}
			{disabled}
			{readonly}
			{required}
			{autofocus}
			class="inner-input {inputClass}"
			oninput={handleInput}
			onchange={handleChange}
			onkeydown={handleKeyDown}
			onfocus={handleFocus}
			onblur={handleBlur}
			{...rest}
		/>

		{#if animatePlaceholder && isEmpty && placeholder}
			<div class="animated-placeholder-layer" aria-hidden="true">
				{#key placeholder}
					<span
						class="animated-placeholder-text"
						in:fly={{ y: 6, duration: 300, delay: 60, easing: cubicOut }}
						out:fly={{ y: -6, duration: 160, easing: cubicOut }}
					>
						{placeholder}
					</span>
				{/key}
			</div>
		{/if}
	</div>

	{#if clearable && !disabled && !readonly && value !== '' && value !== undefined && value !== null}
		<button
			type="button"
			class="input-action-btn input-clear-btn"
			tabindex="-1"
			aria-label="입력 내용 지우기"
			onclick={handleClear}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="m15 9-6 6" />
				<path d="m9 9 6 6" />
			</svg>
		</button>
	{/if}

	{#if showPasswordToggle && type === 'password' && !disabled}
		<button
			type="button"
			class="input-action-btn input-pwd-toggle-btn"
			tabindex="-1"
			aria-label={isPasswordVisible ? '비밀번호 가리기' : '비밀번호 보기'}
			onclick={togglePasswordVisibility}
		>
			{#if isPasswordVisible}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m15 18-.722-3.25" />
					<path d="M2 8a10.645 10.645 0 0 0 20 0" />
					<path d="m20 15-1.726-2.05" />
					<path d="m4 15 1.726-2.05" />
					<path d="m9 18 .722-3.25" />
				</svg>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
					/>
					<circle cx="12" cy="12" r="3" />
				</svg>
			{/if}
		</button>
	{/if}

	{#if suffix}
		<div class="input-slot input-suffix">
			{@render suffix()}
		</div>
	{:else if suffixText}
		<span class="input-text-affix input-suffix-text" aria-hidden="true">{suffixText}</span>
	{/if}
</FdDiv>

<style>
	:global(.fd-wrap.lq-input .fd-body.input-box) {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: calc(var(--lq-input-min-h, 42px) + var(--fd-i-inset, 0px) * 2);
		padding: 0.45em 0.85em;
		font-size: 0.95rem;
		gap: 0.55rem;
		cursor: text;
	}

	:global(.fd-wrap.lq-input .fd-body.input-box.size-sm) {
		min-height: calc(var(--lq-input-min-h, 34px) + var(--fd-i-inset, 0px) * 2);
		padding: 0.35em 0.85em;
		font-size: 0.875rem;
		gap: 0.45rem;
	}

	:global(.fd-wrap.lq-input .fd-body.input-box.size-md) {
		min-height: calc(var(--lq-input-min-h, 42px) + var(--fd-i-inset, 0px) * 2);
		padding: 0.55em 1.15em;
		font-size: 0.95rem;
		gap: 0.6rem;
	}

	:global(.fd-wrap.lq-input .fd-body.input-box.size-lg) {
		min-height: calc(var(--lq-input-min-h, 50px) + var(--fd-i-inset, 0px) * 2);
		padding: 0.75em 1.35em;
		font-size: 1.05rem;
		gap: 0.75rem;
	}

	.input-field-wrap {
		position: relative;
		flex: 1 1 0%;
		min-width: 0;
		width: 100%;
		display: flex;
		align-items: center;
	}

	.inner-input {
		width: 100%;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font: inherit;
		line-height: inherit;
		color: inherit;
		padding: 0;
		margin: 0;
		-webkit-appearance: none;
		appearance: none;
	}

	.animated-placeholder-layer {
		position: absolute;
		inset: 0;
		display: grid;
		align-items: center;
		pointer-events: none;
		overflow: hidden;
	}

	.animated-placeholder-text {
		grid-area: 1 / 1;
		font: inherit;
		line-height: inherit;
		color: var(--lq-placeholder, #a3a3a3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		user-select: none;
	}

	.inner-input::placeholder {
		color: var(--lq-placeholder, #a3a3a3);
		opacity: 1;
	}

	.inner-input:disabled {
		cursor: not-allowed;
	}

	.input-slot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: currentColor;
		opacity: 0.85;
	}

	.input-text-affix {
		font-size: 0.9em;
		font-weight: 500;
		opacity: 0.65;
		user-select: none;
		flex-shrink: 0;
	}

	.input-action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		padding: 3px;
		margin: 0;
		cursor: pointer;
		color: currentColor;
		opacity: 0.55;
		border-radius: 50%;
		transition:
			opacity 0.15s,
			transform 0.15s;
		flex-shrink: 0;
	}

	.input-action-btn:hover {
		opacity: 0.95;
		transform: scale(1.1);
	}

	.input-action-btn:active {
		transform: scale(0.92);
	}
</style>
