<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import FdDiv from './FdDiv.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';

	interface Props extends Omit<HTMLButtonAttributes, 'onchange'> {
		children?: Snippet;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 활성(체크) 상태 여부 (bind:checked 양방향 바인딩 지원) */
		checked?: boolean;
		/** true 시 클릭 시 내부 checked를 자동 반전하지 않고 onchange 콜백만 호출 (제어형 사용 시) */
		preventAutoToggle?: boolean;
		/** 체크 상태 변경 콜백 */
		onchange?: (checked: boolean) => void;

		/** 비활성(기본/호버) 상태의 FluidSetting */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 활성(checked=true) 상태의 FluidSetting (미지정 시 setting 기반으로 더 크고 빠르게 일렁이며 pauseWhenIdle=false 적용) */
		activeSetting?: FluidSetting | Partial<FluidSetting>;

		/* ── 개별 오버라이드 Props (일반 / 호버 / 누름) ── */
		radius?: number;
		reach?: number;
		bulge?: number;
		bulgeWidth?: number;
		color?: string;
		hoverColor?: string;
		pressColor?: string;
		waveColor?: string;
		textColor?: string;
		borderWidth?: number;
		borderColor?: string;
		hoverBorderColor?: string;
		pressBorderColor?: string;

		/* ── 개별 오버라이드 Props (활성화 checked=true) ── */
		activeColor?: string;
		activeHoverColor?: string;
		activePressColor?: string;
		activeWaveColor?: string;
		activeTextColor?: string;
		activeBorderWidth?: number;
		activeBorderColor?: string;
		activeHoverBorderColor?: string;
		activePressBorderColor?: string;
		inset?: number;
	}

	let {
		children,
		disabled = false,
		checked = $bindable(false),
		preventAutoToggle = false,
		onchange,
		onclick,
		setting,
		activeSetting,
		radius,
		reach,
		bulge,
		bulgeWidth,
		color,
		hoverColor,
		pressColor,
		waveColor,
		textColor,
		borderWidth,
		borderColor,
		hoverBorderColor,
		pressBorderColor,
		activeColor,
		activeHoverColor,
		activePressColor,
		activeWaveColor,
		activeTextColor,
		activeBorderWidth,
		activeBorderColor,
		activeHoverBorderColor,
		activePressBorderColor,
		inset: insetProp,
		class: klass = '',
		onkeydown,
		onkeyup,
		onblur,
		...rest
	}: Props = $props();

	// 1. 비활성(기본/호버) FluidSetting 구성
	const baseCfg = $derived.by(() => {
		const s = FluidSetting.from(setting);
		const patch: Partial<FluidSetting> = { pauseWhenIdle: true };
		if (radius !== undefined) patch.radius = radius;
		if (reach !== undefined) patch.reach = reach;
		if (bulge !== undefined) patch.bulge = bulge;
		if (bulgeWidth !== undefined) patch.bulgeWidth = bulgeWidth;
		if (color !== undefined) patch.color = color;
		if (hoverColor !== undefined) patch.hoverColor = hoverColor;
		if (pressColor !== undefined) patch.pressColor = pressColor;
		if (waveColor !== undefined) patch.waveColor = waveColor;
		if (textColor !== undefined) patch.textColor = textColor;
		if (borderWidth !== undefined) patch.borderWidth = borderWidth;
		if (borderColor !== undefined) patch.borderColor = borderColor;
		if (hoverBorderColor !== undefined) patch.hoverBorderColor = hoverBorderColor;
		if (pressBorderColor !== undefined) patch.pressBorderColor = pressBorderColor;
		return s.with(patch);
	});

	// 2. 활성(checked=true) FluidSetting 구성 (기존 FdCheckButton 기본값: layerGap=4, waveAmp=4.5, spin=1.8, pauseWhenIdle=false)
	const activeCfg = $derived.by(() => {
		const resolvedActiveBase = activeColor ?? baseCfg.hoverColor ?? baseCfg.color;
		const resolvedActiveHover = activeHoverColor ?? resolvedActiveBase;
		const defaultActive = baseCfg.with({
			layerGap: 4,
			waveAmp: 4.5,
			spin: 1.8,
			pauseWhenIdle: false,
			color: resolvedActiveBase,
			hoverColor: resolvedActiveHover,
			waveColor: activeWaveColor ?? resolvedActiveHover ?? baseCfg.waveColor ?? baseCfg.hoverColor
		});

		const merged = activeSetting ? defaultActive.with(activeSetting) : defaultActive;
		const patch: Partial<FluidSetting> = { pauseWhenIdle: false };
		if (radius !== undefined) patch.radius = radius;
		if (reach !== undefined) patch.reach = reach;
		if (bulge !== undefined) patch.bulge = bulge;
		if (bulgeWidth !== undefined) patch.bulgeWidth = bulgeWidth;
		if (activeColor !== undefined) {
			patch.color = activeColor;
			if (activeHoverColor === undefined && activeSetting?.hoverColor === undefined) {
				patch.hoverColor = activeColor;
			}
		}
		if (activeHoverColor !== undefined) patch.hoverColor = activeHoverColor;
		if (activePressColor !== undefined) {
			patch.pressColor = activePressColor;
		} else if (pressColor !== undefined && activeSetting?.pressColor === undefined) {
			patch.pressColor = pressColor;
		}
		if (activeWaveColor !== undefined) patch.waveColor = activeWaveColor;
		if (activeTextColor !== undefined) {
			patch.textColor = activeTextColor;
		} else if (textColor !== undefined && activeSetting?.textColor === undefined) {
			patch.textColor = textColor;
		}
		if (activeBorderWidth !== undefined) patch.borderWidth = activeBorderWidth;
		if (activeBorderColor !== undefined) {
			patch.borderColor = activeBorderColor;
			if (
				activeHoverBorderColor === undefined &&
				activeSetting?.hoverBorderColor === undefined
			) {
				patch.hoverBorderColor = activeBorderColor;
			}
		}
		if (activeHoverBorderColor !== undefined) patch.hoverBorderColor = activeHoverBorderColor;
		if (activePressBorderColor !== undefined) patch.pressBorderColor = activePressBorderColor;
		return merged.with(patch);
	});

	// 체크 토글 시 레이아웃(border 두께)이 변하지 않도록 두 상태 중 최대 inset으로 고정
	const sharedInset = $derived(
		insetProp ?? Math.max(baseCfg.computedInset, activeCfg.computedInset)
	);

	const currentSetting = $derived(
		(checked ? activeCfg : baseCfg).with({ inset: sharedInset })
	);

	let btn: HTMLButtonElement;
	let hovered = $state(false);
	let pressed = $state(false);

	function handleClick(e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		if (disabled) return;
		const next = !checked;
		if (!preventAutoToggle) {
			checked = next;
		}
		onchange?.(next);
		onclick?.(e);
	}

	function handleBodyClick(e: MouseEvent) {
		if (disabled) return;
		if (e.target !== btn && !btn?.contains(e.target as Node)) {
			btn?.click();
		}
	}

	function handleKeyDown(e: KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		if (e.key === ' ' || e.key === 'Enter') {
			pressed = true;
		}
		onkeydown?.(e);
	}

	function handleKeyUp(e: KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		if (e.key === ' ' || e.key === 'Enter') {
			pressed = false;
		}
		onkeyup?.(e);
	}

	function handleBlur(e: FocusEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		pressed = false;
		onblur?.(e);
	}
</script>

<FdDiv
	setting={currentSetting}
	{disabled}
	bind:hovered
	bind:pressed
	data-checked={checked || undefined}
	bodyClass="fd-check-body"
	onclick={handleBodyClick}
>
	<button
		bind:this={btn}
		type="button"
		role="switch"
		aria-checked={checked}
		{disabled}
		class="fd-check-btn {klass}"
		onclick={handleClick}
		onkeydown={handleKeyDown}
		onkeyup={handleKeyUp}
		onblur={handleBlur}
		{...rest}
	>
		{@render children?.()}
	</button>
</FdDiv>

<style>
	:global(.fd-wrap .fd-body.fd-check-body) {
		padding: 0;
		display: inline-grid;
	}

	.fd-check-btn {
		position: relative;
		z-index: 1;
		margin: 0;
		padding: 0.65em 1.35em;
		border: none;
		border-radius: var(--fd-i-r);
		background: transparent;
		font: inherit;
		font-weight: 600;
		color: inherit;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		outline: none;
	}

	.fd-check-btn:disabled {
		cursor: not-allowed;
	}

	.fd-check-btn:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
</style>
