<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import FdDiv from './FdDiv.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';

	interface Props extends HTMLButtonAttributes {
		children?: Snippet;
		/** 통합 FluidSetting 설정 객체 (개별 prop과 함께 지정 시 개별 prop 우선) */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 부모 너비에 맞춰 100% 확장 여부 */
		fullWidth?: boolean;

		/* ── FluidSetting 개별 오버라이드 Props ── */
		radius?: number;
		reach?: number;
		bulge?: number;
		bulgeWidth?: number;
		layers?: number;
		layerGap?: number;
		waveAmp?: number;
		waveLength?: number;
		spin?: number;
		color?: string;
		hoverColor?: string;
		pressColor?: string;
		waveColor?: string;
		hoverWaveColor?: string;
		textColor?: string;
		inset?: number;
	}

	let {
		children,
		setting,
		disabled = false,
		fullWidth = false,
		type = 'button',
		radius,
		reach,
		bulge,
		bulgeWidth,
		layers,
		layerGap,
		waveAmp,
		waveLength,
		spin,
		color,
		hoverColor,
		pressColor,
		waveColor,
		hoverWaveColor,
		textColor,
		inset,
		class: klass = '',
		onclick,
		onkeydown,
		onkeyup,
		onblur,
		...rest
	}: Props = $props();

	const resolvedSetting = $derived.by(() => {
		const base = FluidSetting.from(setting);
		const patch: Partial<FluidSetting> = {};
		if (radius !== undefined) patch.radius = radius;
		if (reach !== undefined) patch.reach = reach;
		if (bulge !== undefined) patch.bulge = bulge;
		if (bulgeWidth !== undefined) patch.bulgeWidth = bulgeWidth;
		if (layers !== undefined) patch.layers = layers;
		if (layerGap !== undefined) patch.layerGap = layerGap;
		if (waveAmp !== undefined) patch.waveAmp = waveAmp;
		if (waveLength !== undefined) patch.waveLength = waveLength;
		if (spin !== undefined) patch.spin = spin;
		if (color !== undefined) patch.color = color;
		if (hoverColor !== undefined) patch.hoverColor = hoverColor;
		if (pressColor !== undefined) patch.pressColor = pressColor;
		if (waveColor !== undefined) patch.waveColor = waveColor;
		if (hoverWaveColor !== undefined) patch.hoverWaveColor = hoverWaveColor;
		if (textColor !== undefined) patch.textColor = textColor;
		if (inset !== undefined) patch.inset = inset;
		return Object.keys(patch).length > 0 ? base.with(patch) : base;
	});

	let btn: HTMLButtonElement;
	let hovered = $state(false);
	let pressed = $state(false);

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
	setting={resolvedSetting}
	{disabled}
	{fullWidth}
	bind:hovered
	bind:pressed
	bodyClass="fd-btn-body"
	onclick={handleBodyClick}
>
	<button
		bind:this={btn}
		{type}
		{disabled}
		class="fd-btn {klass}"
		{onclick}
		onkeydown={handleKeyDown}
		onkeyup={handleKeyUp}
		onblur={handleBlur}
		{...rest}
	>
		{@render children?.()}
	</button>
</FdDiv>

<style>
	:global(.fd-wrap .fd-body.fd-btn-body) {
		padding: 0;
		display: inline-grid;
	}

	:global(.fd-wrap.full-width .fd-body.fd-btn-body) {
		display: grid;
		width: 100%;
	}

	:global(.fd-wrap.full-width) .fd-btn {
		width: 100%;
	}

	.fd-btn {
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

	.fd-btn:disabled {
		cursor: not-allowed;
	}

	.fd-btn:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
</style>
