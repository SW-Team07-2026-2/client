<script lang="ts">
	import FdDiv from './FdDiv.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';

	interface Props {
		/** 스위치 활성화 여부 */
		checked?: boolean;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 활성화 시 유체 파동 애니메이션 일시정지 여부 (비활성 탭/패널 절전용) */
		paused?: boolean;
		/** true면 자체 버튼(role="switch")으로 동작, false면 상위 스위치 행 내부의 시각 트랙으로만 렌더링 */
		interactive?: boolean;
		/** true면 비활성 트랙 테두리를 제거한 borderless 스타일 사용 */
		borderless?: boolean;
		/** 접근성 라벨 (interactive === true일 때 사용) */
		ariaLabel?: string;
		/** 토글 변경 콜백 */
		onchange?: (checked: boolean) => void;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		checked = $bindable(false),
		disabled = false,
		paused = false,
		interactive = true,
		borderless = false,
		ariaLabel = '스위치',
		onchange,
		class: klass = ''
	}: Props = $props();

	const TRACK_BASE_SETTING = new FluidSetting({
		radius: 999,
		inset: 6,
		reach: 26,
		bulge: 4,
		bulgeWidth: 16,
		layers: 2,
		layerGap: 0,
		waveAmp: 0,
		waveLength: 48,
		spin: 1.1,
		staticFrontWave: true,
		hoverReactive: true,
		bulgeReactive: true,
		clickReactive: true,
		pressDeform: { x: 0.9, y: -1.3 },
		pauseWhenIdle: true,
		color: 'var(--surface-3)',
		hoverColor: 'var(--surface-4)',
		pressColor: 'var(--line)',
		waveColor: 'var(--surface-4)',
		borderWidth: 1,
		borderColor: 'var(--line)',
		hoverBorderColor: 'var(--muted)',
		pressBorderColor: 'var(--muted)'
	});

	const TRACK_BORDERLESS_BASE_SETTING = TRACK_BASE_SETTING.with({
		color: 'var(--surface-2)',
		hoverColor: 'var(--surface-3)',
		pressColor: 'var(--surface-4)',
		waveColor: 'var(--surface-3)',
		borderWidth: 0
	});

	const TRACK_ACTIVE_SETTING = TRACK_BASE_SETTING.with({
		layers: 2,
		layerGap: 2.2,
		waveAmp: 2.2,
		spin: 1.5,
		staticFrontWave: true,
		pauseWhenIdle: false,
		color: 'var(--white-2)',
		hoverColor: 'var(--white)',
		pressColor: 'var(--white-3)',
		waveColor: 'var(--white-3)',
		hoverWaveColor: 'var(--white-3)',
		borderWidth: 0
	});

	const trackSetting = $derived.by(() => {
		const base = checked
			? paused || disabled
				? TRACK_ACTIVE_SETTING.with({ pauseWhenIdle: true })
				: TRACK_ACTIVE_SETTING
			: borderless
				? TRACK_BORDERLESS_BASE_SETTING
				: TRACK_BASE_SETTING;

		if (disabled) {
			return base.with({
				hoverReactive: false,
				bulgeReactive: false,
				clickReactive: false,
				pauseWhenIdle: true
			});
		}
		return base;
	});

	function handleToggle() {
		if (disabled) return;
		const next = !checked;
		checked = next;
		onchange?.(next);
	}
</script>

{#snippet trackContent()}
	<FdDiv
		setting={trackSetting}
		staticFrontWave={true}
		class="fd-switch-wrap"
		bodyClass="fd-switch-body"
	>
		<span class="fd-switch-thumb"></span>
	</FdDiv>
{/snippet}

<!-- 공용 유체 스위치 (FdDiv 기반 트랙 + 스프링 슬라이드 썸, 순수 렌더링) -->
{#if interactive}
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={ariaLabel}
		{disabled}
		class="fd-switch-slot is-interactive {klass}"
		class:is-checked={checked}
		class:is-disabled={disabled}
		onclick={handleToggle}
	>
		{@render trackContent()}
	</button>
{:else}
	<span
		class="fd-switch-slot {klass}"
		class:is-checked={checked}
		class:is-disabled={disabled}
		aria-hidden="true"
	>
		{@render trackContent()}
	</span>
{/if}

<style>
	.fd-switch-slot {
		position: relative;
		flex: 0 0 auto;
		width: 40px;
		height: 22px;
		padding: 0;
		border: none;
		background: transparent;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		-webkit-tap-highlight-color: transparent;
	}

	.fd-switch-slot.is-interactive {
		cursor: pointer;
	}

	.fd-switch-slot.is-interactive:focus-visible {
		outline: 2px solid var(--muted);
		outline-offset: 4px;
		border-radius: 999px;
	}

	.fd-switch-slot.is-disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.fd-switch-slot :global(.fd-wrap.fd-switch-wrap) {
		margin: -6px;
	}

	.fd-switch-slot :global(.fd-wrap .fd-body.fd-switch-body) {
		position: relative;
		box-sizing: content-box;
		width: 40px;
		height: 22px;
		padding: 0;
	}

	.fd-switch-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 999px;
		background: var(--muted);
		transform: translate3d(0, 0, 0);
		transition:
			transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
			background-color 0.24s ease;
	}

	.fd-switch-slot.is-checked .fd-switch-thumb {
		background: var(--bg);
		transform: translate3d(18px, 0, 0);
	}

	@media (prefers-reduced-motion: reduce) {
		.fd-switch-thumb {
			transition: none;
		}
	}
</style>
