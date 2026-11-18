<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { TransitionConfig } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import FdDiv from './FdDiv.svelte';
	import { FluidSetting } from '#lib/fluid/setting';

	export type ToastType = 'error' | 'info' | 'success';

	interface Props {
		/** 토스트 표시 여부 (bind:open 양방향 바인딩 지원) */
		open?: boolean;
		/** 토스트 타입 ('error' | 'info' | 'success') */
		type?: ToastType;
		/** 표시할 메시지 텍스트 */
		message?: string;
		/** 화면 위쪽에 머무르는 시간 (ms, 기본값: 2000) */
		duration?: number;
		/** 내부 커스텀 콘텐츠 (message 대신 사용 가능) */
		children?: Snippet;
		/** 토스트가 닫힐 때 호출되는 콜백 */
		onclose?: () => void;
		/** 동일 메시지 연속 호출 시 타이머를 재시작하기 위한 트리거 카운터 */
		trigger?: number;
		/** 추가 클래스 */
		class?: string;
		/** FluidSetting 추가 오버라이드 */
		setting?: FluidSetting | Partial<FluidSetting>;
	}

	let {
		open = $bindable(false),
		type = 'info',
		message = '',
		duration = 5000,
		children,
		onclose,
		trigger = 0,
		class: klass = '',
		setting
	}: Props = $props();

	const TOAST_THEME_MAP: Record<ToastType, { bg: string; fg: string }> = {
		error: {
			bg: 'var(--toast-error-bg)',
			fg: 'var(--toast-error-fg)'
		},
		info: {
			bg: 'var(--toast-info-bg)',
			fg: 'var(--toast-info-fg)'
		},
		success: {
			bg: 'var(--toast-success-bg)',
			fg: 'var(--toast-success-fg)'
		}
	};

	const theme = $derived(TOAST_THEME_MAP[type] ?? TOAST_THEME_MAP.info);

	const resolvedSetting = $derived.by(() => {
		const base = new FluidSetting({
			radius: 999,
			reach: 32,
			bulge: 5,
			bulgeWidth: 22,
			layers: 2,
			layerGap: 3.2,
			waveAmp: 3,
			waveLength: 68,
			spin: 1.5,
			pauseWhenIdle: false,
			clickReactive: false,
			pressDeform: { x: 0, y: 0 },
			color: theme.bg,
			hoverColor: theme.bg,
			pressColor: theme.bg,
			textColor: theme.fg
		});
		return setting ? base.with(setting) : base;
	});

	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// open, message, type, trigger 중 하나라도 바뀌면 타이머를 새로 시작
		void message;
		void type;
		void trigger;

		clearTimeout(hideTimer);

		if (open) {
			hideTimer = setTimeout(() => {
				open = false;
				onclose?.();
			}, duration);
		}

		return () => {
			clearTimeout(hideTimer);
		};
	});

	/** 화면 위에서 아래로 부드럽게 내려오며 등장 */
	function enterToast(_node: Element): TransitionConfig {
		return {
			duration: 400,
			easing: cubicOut,
			css: (t) => `
				opacity: ${t};
				transform: translate3d(0, ${(1 - t) * -56}px, 0) scale(${0.96 + 0.04 * t});
			`
		};
	}

	/** 머문 자리에서 아래로 내려가며 자연스럽게 사라짐 */
	function exitToast(_node: Element): TransitionConfig {
		return {
			duration: 360,
			easing: cubicOut,
			css: (t) => `
				opacity: ${t};
				transform: translate3d(0, ${(1 - t) * 32}px, 0) scale(${0.97 + 0.03 * t});
			`
		};
	}
</script>

{#if open}
	<div
		class="fd-toast-anchor {klass}"
		role={type === 'error' ? 'alert' : 'status'}
		aria-live={type === 'error' ? 'assertive' : 'polite'}
	>
		<div class="fd-toast-motion" in:enterToast out:exitToast>
			<FdDiv setting={resolvedSetting} class="fd-toast-wrap" bodyClass="fd-toast-body">
				<div class="fd-toast-content">
					{#if children}
						{@render children()}
					{:else}
						<span>{message}</span>
					{/if}
				</div>
			</FdDiv>
		</div>
	</div>
{/if}

<style>
	.fd-toast-anchor {
		position: fixed;
		top: max(1.25rem, calc(0.75rem + env(safe-area-inset-top, 0px)));
		left: 50%;
		transform: translateX(-50%);
		z-index: 9999;
		pointer-events: none;
		max-width: min(calc(100vw - 2rem), 420px);
	}

	.fd-toast-motion {
		pointer-events: auto;
		will-change: transform, opacity;
	}

	.fd-toast-anchor :global(.fd-toast-body) {
		padding: 0.72rem 1.35rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.fd-toast-content {
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.4;
		letter-spacing: -0.015em;
		text-align: center;
		word-break: keep-all;
	}

	@media (max-width: 640px) {
		.fd-toast-anchor :global(.fd-toast-body) {
			padding: 0.65rem 1.15rem;
		}

		.fd-toast-content {
			font-size: 0.8125rem;
		}
	}
</style>
