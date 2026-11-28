<script lang="ts">
	import type { Snippet } from 'svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import type {
		AlertDialogFrom,
		AlertDialogSize,
		AlertDialogVariant
	} from '#lib/common/logic/alertDialog.svelte';

	interface Props {
		/** 표시 여부 (단독 선언형 사용 시) */
		open?: boolean;
		/** 애니메이션 단계 (AlertDialogViewport 연동 시 직접 제어, 생략 시 open으로 자동 동기화) */
		phase?: 'entering' | 'open' | 'exiting';
		/** 다이얼로그 제목 */
		title?: string;
		/** 본문 설명 */
		description?: string;
		/** 확인 버튼 문구 */
		confirmText?: string;
		/** 취소 버튼 문구 */
		cancelText?: string;
		/** 취소 버튼 숨김 여부 */
		hideCancel?: boolean;
		/** 확인 버튼 톤 */
		variant?: AlertDialogVariant;
		/** 진입·퇴장 방향 ('top' | 'bottom' | 'left' | 'right') */
		from?: AlertDialogFrom;
		/** 다이얼로그 크기 ('default' | 'sm') */
		size?: AlertDialogSize;
		/** 확인 비동기 처리 중 상태 */
		busy?: boolean;
		/** 배경 클릭 시 닫기 허용 */
		closeOnOverlay?: boolean;
		/** Escape 키 입력 시 닫기 허용 */
		closeOnEscape?: boolean;
		/** 확인 클릭 콜백 */
		onConfirm?: () => void;
		/** 취소/닫기 콜백 */
		onCancel?: () => void;
		/** 선택적 상단 미디어/아이콘 슬롯 */
		media?: Snippet;
		/** 선택적 커스텀 본문 슬롯 */
		children?: Snippet;
		/** 선택적 커스텀 푸터 슬롯 */
		footer?: Snippet;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		open = $bindable(false),
		phase,
		title = '',
		description = '',
		confirmText = '확인',
		cancelText = '취소',
		hideCancel = false,
		variant = 'default',
		from = 'top',
		size = 'default',
		busy = false,
		closeOnOverlay = false,
		closeOnEscape = true,
		onConfirm,
		onCancel,
		media,
		children,
		footer,
		class: className = ''
	}: Props = $props();

	const titleId = `indig-alert-dialog-title-${Math.random().toString(36).slice(2, 9)}`;
	const descId = `indig-alert-dialog-desc-${Math.random().toString(36).slice(2, 9)}`;

	const cancelBtnSetting = new FluidSetting({
		radius: 10,
		inset: 6,
		layers: 2,
		layerGap: 2,
		waveAmp: 1.8,
		borderWidth: 0,
		color: 'var(--surface-2)',
		hoverColor: 'var(--surface-3)',
		pressColor: 'var(--surface-4)',
		waveColor: 'var(--line-wave)',
		textColor: 'var(--fg)'
	});

	const actionBtnSetting = $derived.by(() => {
		if (variant === 'danger') {
			return new FluidSetting({
				radius: 10,
				inset: 6,
				layers: 2,
				layerGap: 2,
				waveAmp: 1.8,
				borderWidth: 0,
				color: 'var(--danger)',
				hoverColor: 'var(--danger)',
				pressColor: 'var(--danger)',
				waveColor: 'var(--toast-error-wave)',
				textColor: 'var(--white)'
			});
		}
		if (variant === 'warning') {
			return new FluidSetting({
				radius: 10,
				inset: 6,
				layers: 2,
				layerGap: 2,
				waveAmp: 1.8,
				borderWidth: 0,
				color: 'var(--warning)',
				hoverColor: 'var(--warning)',
				pressColor: 'var(--warning)',
				waveColor: 'var(--warning)',
				textColor: 'var(--bg)'
			});
		}
		return new FluidSetting({
			radius: 10,
			inset: 6,
			layers: 2,
			layerGap: 2,
			waveAmp: 1.8,
			borderWidth: 0,
			color: 'var(--white)',
			hoverColor: 'var(--white-2)',
			pressColor: 'var(--white-3)',
			waveColor: 'var(--white-3)',
			textColor: 'var(--bg)'
		});
	});

	// 단독 선언형(phase 미전달)일 때 내부 entering → open → exiting 트랜지션 관리
	let localVisible = $state(false);
	let localPhase = $state<'entering' | 'open' | 'exiting'>('entering');
	let localTimer: ReturnType<typeof setTimeout> | null = null;
	let contentEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (phase !== undefined) return;
		if (localTimer) {
			clearTimeout(localTimer);
			localTimer = null;
		}
		if (open) {
			localVisible = true;
			localPhase = 'entering';
			if (typeof requestAnimationFrame === 'function') {
				requestAnimationFrame(() => {
					if (open) localPhase = 'open';
				});
			} else {
				localPhase = 'open';
			}
		} else if (localVisible) {
			localPhase = 'exiting';
			localTimer = setTimeout(() => {
				localTimer = null;
				localVisible = false;
			}, 220);
		}
		return () => {
			if (localTimer) {
				clearTimeout(localTimer);
				localTimer = null;
			}
		};
	});

	const isMounted = $derived(phase !== undefined ? true : localVisible);
	const resolvedPhase = $derived(phase ?? localPhase);

	// 열릴 때 포커스 이동 및 Escape 키 처리
	$effect(() => {
		if (!isMounted || resolvedPhase === 'exiting') return;
		if (typeof window === 'undefined') return;

		contentEl?.focus({ preventScroll: true });

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && closeOnEscape && !busy) {
				e.preventDefault();
				triggerCancel();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	function triggerCancel() {
		if (busy) return;
		if (phase === undefined) {
			open = false;
		}
		onCancel?.();
	}

	function triggerConfirm() {
		if (busy) return;
		onConfirm?.();
	}

	function handleOverlayClick() {
		if (closeOnOverlay && !busy) {
			triggerCancel();
		}
	}
</script>

{#if isMounted}
	<div
		class="indig-alert-dialog-portal"
		data-slot="alert-dialog-portal"
		data-phase={resolvedPhase}
		data-fd-barrier
	>
		<!-- 백드롭 오버레이 -->
		<div
			class="indig-alert-dialog-overlay"
			data-slot="alert-dialog-overlay"
			data-phase={resolvedPhase}
			role="presentation"
			onclick={handleOverlayClick}
		></div>

		<!-- 다이얼로그 팝업 본체 (Animate UI 3D 방향별 플립 진입·퇴장) -->
		<div
			bind:this={contentEl}
			class="indig-alert-dialog-content {className}"
			data-slot="alert-dialog-content"
			data-size={size}
			data-from={from}
			data-phase={resolvedPhase}
			role="alertdialog"
			aria-modal="true"
			aria-labelledby={title ? titleId : undefined}
			aria-describedby={description ? descId : undefined}
			tabindex="-1"
		>
			<div
				class="indig-alert-dialog-header"
				class:has-media={Boolean(media)}
				data-slot="alert-dialog-header"
			>
				{#if media}
					<div class="indig-alert-dialog-media" data-slot="alert-dialog-media">
						{@render media()}
					</div>
				{/if}

				{#if title}
					<h2 id={titleId} class="indig-alert-dialog-title" data-slot="alert-dialog-title">
						{title}
					</h2>
				{/if}

				{#if description}
					<p
						id={descId}
						class="indig-alert-dialog-description"
						data-slot="alert-dialog-description"
					>
						{description}
					</p>
				{/if}
			</div>

			{#if children}
				<div class="indig-alert-dialog-body">
					{@render children()}
				</div>
			{/if}

			<div class="indig-alert-dialog-footer" data-slot="alert-dialog-footer">
				{#if footer}
					{@render footer()}
				{:else}
					{#if !hideCancel}
						<FdButton
							setting={cancelBtnSetting}
							fullWidth={size === 'sm'}
							class="indig-alert-dialog-fd-btn"
							data-slot="alert-dialog-cancel"
							disabled={busy}
							onclick={triggerCancel}
						>
							<span class="indig-alert-dialog-btn-label">{cancelText}</span>
						</FdButton>
					{/if}

					<FdButton
						setting={actionBtnSetting}
						fullWidth={size === 'sm'}
						class="indig-alert-dialog-fd-btn"
						data-slot="alert-dialog-action"
						disabled={busy}
						onclick={triggerConfirm}
					>
						<span class="indig-alert-dialog-btn-label">
							{#if busy}
								<span class="btn-spinner" aria-hidden="true"></span>
							{/if}
							<span>{confirmText}</span>
						</span>
					</FdButton>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.indig-alert-dialog-portal {
		position: fixed;
		inset: 0;
		z-index: 120;
		display: grid;
		place-items: center;
		padding: 1rem;
		pointer-events: auto;
	}

	.indig-alert-dialog-portal[data-phase='exiting'] {
		pointer-events: none;
	}

	.indig-alert-dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		opacity: 0;
		transition: opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.indig-alert-dialog-overlay[data-phase='open'] {
		opacity: 1;
	}

	.indig-alert-dialog-content {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 24rem;
		display: grid;
		gap: 1rem;
		padding: 1.125rem;
		border-radius: 1rem;
		background: var(--surface-dim-2);
		color: var(--fg);
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
		outline: none;
		overflow: hidden;
		opacity: 0;
		will-change: transform, opacity;
		transition:
			transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.22s ease;
	}

	.indig-alert-dialog-content[data-size='sm'] {
		max-width: 20rem;
	}

	/* Animate UI 방향별 3D 플립 진입·퇴장 트랜스폼 */
	.indig-alert-dialog-content[data-from='top'] {
		transform: perspective(900px) translate3d(0, -18px, 0) rotateX(14deg) scale(0.96);
	}

	.indig-alert-dialog-content[data-from='bottom'] {
		transform: perspective(900px) translate3d(0, 18px, 0) rotateX(-14deg) scale(0.96);
	}

	.indig-alert-dialog-content[data-from='left'] {
		transform: perspective(900px) translate3d(-18px, 0, 0) rotateY(-14deg) scale(0.96);
	}

	.indig-alert-dialog-content[data-from='right'] {
		transform: perspective(900px) translate3d(18px, 0, 0) rotateY(14deg) scale(0.96);
	}

	.indig-alert-dialog-content[data-phase='open'] {
		opacity: 1;
		transform: perspective(900px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1);
	}

	.indig-alert-dialog-header {
		display: grid;
		grid-template-rows: auto 1fr;
		place-items: center;
		gap: 0.45rem;
		text-align: center;
	}

	.indig-alert-dialog-header.has-media {
		grid-template-rows: auto auto 1fr;
		column-gap: 0.9rem;
	}

	@media (min-width: 640px) {
		.indig-alert-dialog-content[data-size='default'] .indig-alert-dialog-header {
			place-items: start;
			text-align: left;
		}

		.indig-alert-dialog-content[data-size='default'] .indig-alert-dialog-header.has-media {
			grid-template-columns: auto 1fr;
			grid-template-rows: auto 1fr;
		}

		.indig-alert-dialog-content[data-size='default'] .indig-alert-dialog-media {
			grid-row: span 2;
			margin-bottom: 0;
		}

		.indig-alert-dialog-content[data-size='default']
			.indig-alert-dialog-header.has-media
			.indig-alert-dialog-title {
			grid-column: 2;
		}
	}

	.indig-alert-dialog-media {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		margin-bottom: 0.35rem;
		border-radius: 0.625rem;
		background: var(--surface-2);
		color: var(--white);
	}

	.indig-alert-dialog-title {
		margin: 0;
		font-size: 1rem;
		font-weight: var(--fw-semibold);
		line-height: 1.4;
		color: var(--white);
		letter-spacing: -0.015em;
		word-break: keep-all;
	}

	.indig-alert-dialog-description {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.55;
		color: var(--muted);
		word-break: keep-all;
		white-space: pre-line;
	}

	.indig-alert-dialog-body {
		min-width: 0;
	}

	.indig-alert-dialog-footer {
		display: flex;
		flex-direction: column-reverse;
		gap: 0.35rem;
		margin: 0.125rem -1.125rem -1.125rem;
		padding: 0.65rem 0.9rem;
		border-radius: 1rem;
		background: var(--surface);
	}

	.indig-alert-dialog-content[data-size='sm'] .indig-alert-dialog-footer {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (min-width: 640px) {
		.indig-alert-dialog-content[data-size='default'] .indig-alert-dialog-footer {
			flex-direction: row;
			justify-content: flex-end;
		}
	}

	.indig-alert-dialog-footer :global(.fd-btn.indig-alert-dialog-fd-btn) {
		padding: 0.48rem 0.9rem;
	}

	.indig-alert-dialog-btn-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.875rem;
		font-weight: var(--fw-semibold);
		line-height: 1;
		white-space: nowrap;
	}

	.btn-spinner {
		width: 14px;
		height: 14px;
		border-radius: 999px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		animation: indig-dialog-spin 0.7s linear infinite;
	}

	@keyframes indig-dialog-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.indig-alert-dialog-overlay,
		.indig-alert-dialog-content {
			transition: none;
		}
	}
</style>
