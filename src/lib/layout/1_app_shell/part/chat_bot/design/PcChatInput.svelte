<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import LetterLimitInput from '#lib/common/design/LetterLimitInput.svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { ArrowRightIcon } from '#lib/common/design/icon';
	import { FluidSetting } from '#lib/common/type/fluid';
	import type { ChatAttachment } from '../logic/types';
	import { CHAT_FILE_ACCEPT, getFileExtension } from '../logic/attachment';

	interface Props {
		value: string;
		attachedFiles: readonly ChatAttachment[];
		canSubmit: boolean;
		disabled?: boolean;
		placeholder?: string;
		maxLength?: number;
		inputEl?: HTMLTextAreaElement;
		onChangeValue?: (next: string) => void;
		onAddFiles?: (files: FileList | File[]) => void;
		onRemoveAttachment?: (id: string) => void;
		onSend?: (keepFocus?: boolean) => void;
		onClose?: () => void;
		onHeightChange?: (height: number) => void;
	}

	let {
		value,
		attachedFiles,
		canSubmit,
		disabled = false,
		placeholder = '음악 취향이나 궁금한 점을 물어보세요...',
		maxLength = 100,
		inputEl = $bindable(undefined),
		onChangeValue,
		onAddFiles,
		onRemoveAttachment,
		onSend,
		onClose,
		onHeightChange
	}: Props = $props();

	let deckEl: HTMLElement | undefined = $state(undefined);
	let fileInputEl: HTMLInputElement | undefined = $state(undefined);
	let fieldEl: HTMLTextAreaElement | HTMLInputElement | undefined = $state(undefined);

	let isDraggingOver = $state(false);
	let sendHovered = $state(false);
	let dragCounter = 0;

	$effect(() => {
		inputEl = fieldEl instanceof HTMLTextAreaElement ? fieldEl : undefined;
	});

	const SEND_ACTIVE_SETTING = new FluidSetting({
		radius: 999,
		inset: 3,
		reach: 16,
		bulge: 2.5,
		bulgeWidth: 12,
		layers: 2,
		layerGap: 1.5,
		waveAmp: 1.3,
		waveLength: 36,
		spin: 1.1,
		pauseWhenIdle: true,
		color: 'var(--white-2)',
		hoverColor: 'var(--white)',
		pressColor: 'var(--white-3)',
		waveColor: 'var(--white-3)',
		hoverWaveColor: 'var(--white-3)',
		textColor: 'var(--bg)',
		borderWidth: 0
	});

	const SEND_DISABLED_SETTING = SEND_ACTIVE_SETTING.with({
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

	const sendBtnSetting = $derived(canSubmit ? SEND_ACTIVE_SETTING : SEND_DISABLED_SETTING);

	onMount(() => {
		if (deckEl && typeof ResizeObserver !== 'undefined') {
			const report = () => {
				if (!deckEl) return;
				onHeightChange?.(Math.ceil(deckEl.getBoundingClientRect().height));
			};
			report();
			const ro = new ResizeObserver(report);
			ro.observe(deckEl);
			return () => ro.disconnect();
		}
	});

	function handleFileInputChange(e: Event & { currentTarget: HTMLInputElement }) {
		if (e.currentTarget.files && e.currentTarget.files.length > 0) {
			onAddFiles?.(e.currentTarget.files);
			e.currentTarget.value = '';
		}
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
			isDraggingOver = true;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
		isDraggingOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter <= 0) {
			dragCounter = 0;
			isDraggingOver = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter = 0;
		isDraggingOver = false;

		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			onAddFiles?.(e.dataTransfer.files);
		}
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];
		for (let i = 0; i < items.length; i++) {
			if (items[i].kind === 'file') {
				const file = items[i].getAsFile();
				if (file) files.push(file);
			}
		}

		if (files.length > 0) {
			e.preventDefault();
			onAddFiles?.(files);
		}
	}
</script>

<!-- PC 채팅 하단 플로팅 공용 LetterLimitInput 덱 (드래그&드롭 · 붙여넣기 · 순수 렌더링) -->
<footer bind:this={deckEl} class="chat-floating-deck">
	<input
		bind:this={fileInputEl}
		type="file"
		multiple
		accept={CHAT_FILE_ACCEPT}
		style="display: none;"
		onchange={handleFileInputChange}
	/>

	<form
		class="chat-input-form"
		class:is-dragover={isDraggingOver}
		ondragenter={handleDragEnter}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onpaste={handlePaste}
		onsubmit={(e) => {
			e.preventDefault();
			if (canSubmit) onSend?.(false);
		}}
	>
		<LetterLimitInput
			{value}
			{maxLength}
			nearThreshold={15}
			{canSubmit}
			{disabled}
			{placeholder}
			ariaLabel="메시지 입력"
			forceFocused={isDraggingOver}
			keepFocusOnEnter={true}
			bind:inputEl={fieldEl}
			{onChangeValue}
			onSubmit={(keepFocus) => onSend?.(keepFocus)}
			onEscape={() => onClose?.()}
		>
			{#snippet overlay()}
				{#if isDraggingOver}
					<div class="drag-drop-overlay" transition:fade={{ duration: 120 }}>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
							<polyline points="17 8 12 3 7 8"></polyline>
							<line x1="12" y1="3" x2="12" y2="15"></line>
						</svg>
						<span>이미지, 음원, 영상, 문서를 놓으세요</span>
					</div>
				{/if}
			{/snippet}

			{#snippet topTray()}
				{#if attachedFiles.length > 0}
					<div class="attached-inside-tray" transition:slide={{ duration: 220 }}>
						<div class="attached-previews-scroll">
							{#each attachedFiles as att, attIdx (att.id || `preview-${attIdx}`)}
								<div
									class="preview-chip"
									class:is-img={att.isImage}
									style:animation-delay="{(attIdx % 5) * -0.55}s"
								>
									{#if att.isImage}
										<img src={att.url} alt={att.name || '첨부 이미지'} class="preview-thumb" />
									{:else if att.isAudio}
										<div class="preview-file-icon audio">
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<path d="M9 18V5l12-2v13"></path>
												<circle cx="6" cy="18" r="3"></circle>
												<circle cx="18" cy="16" r="3"></circle>
											</svg>
										</div>
										<span class="preview-file-name">{att.name || '음원'}</span>
									{:else if att.isVideo}
										<div class="preview-file-icon video">
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<polygon points="23 7 16 12 23 17 23 7"></polygon>
												<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
											</svg>
										</div>
										<span class="preview-file-name">{att.name || '영상'}</span>
									{:else}
										<div class="preview-file-badge">{getFileExtension(att.name)}</div>
										<span class="preview-file-name">{att.name || '파일'}</span>
									{/if}
									<button
										type="button"
										class="preview-remove-btn"
										onclick={() => onRemoveAttachment?.(att.id)}
										aria-label="첨부파일 삭제"
									>
										<svg
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
										>
											<line x1="18" y1="6" x2="6" y2="18"></line>
											<line x1="6" y1="6" x2="18" y2="18"></line>
										</svg>
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/snippet}

			{#snippet footLeading()}
				<button
					type="button"
					class="inline-attach-btn"
					onclick={() => fileInputEl?.click()}
					{disabled}
					aria-label="파일 첨부 (이미지, 음원, 영상, 문서)"
					title="파일 첨부 (이미지, 음원, 영상, 문서 / 최대 20MB)"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
				</button>
			{/snippet}

			{#snippet submitButton({ canSubmit: ready })}
				<div
					class="send-btn-offset"
					role="presentation"
					onpointerenter={() => {
						if (ready) sendHovered = true;
					}}
					onpointerleave={() => (sendHovered = false)}
				>
					<FdButton
						type="submit"
						setting={sendBtnSetting}
						disabled={!ready}
						aria-label="메시지 전송"
						class="chat-send-fd-btn"
					>
						<ArrowRightIcon size={17} strokeWidth={2.2} hovered={sendHovered && ready} />
					</FdButton>
				</div>
			{/snippet}
		</LetterLimitInput>
	</form>
</footer>

<style>
	.chat-floating-deck {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 0 var(--bot-input-inset, 12px) var(--bot-input-inset, 12px);
		background: transparent;
		border: none;
		display: flex;
		flex-direction: column;
		pointer-events: none;
		z-index: 20;
	}

	.chat-input-form {
		--ll-bg: var(--surface-dim);
		--ll-bg-focus: var(--surface-1);
		pointer-events: auto;
		display: flex;
		align-items: flex-end;
		background: transparent;
		border: none;
		width: 100%;
	}

	.inline-attach-btn {
		background: color-mix(in srgb, var(--white) 6%, transparent);
		border: none;
		color: var(--white-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 999px;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		transition:
			background-color 0.18s ease,
			transform 0.18s ease,
			color 0.18s ease;
	}

	.inline-attach-btn:hover:not(:disabled) {
		color: var(--white);
		background: color-mix(in srgb, var(--white) 14%, transparent);
		transform: scale(1.06);
	}

	.inline-attach-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.inline-attach-btn svg {
		transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.inline-attach-btn:not(:disabled):hover svg {
		transform: rotate(90deg);
	}

	.send-btn-offset {
		margin-top: -3px;
		margin-bottom: -3px;
		margin-right: -3px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.send-btn-offset :global(.fd-btn.chat-send-fd-btn) {
		width: 38px;
		height: 30px;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 0;
	}

	@keyframes chipFloatBob {
		0%,
		100% {
			transform: translate3d(0, 0px, 0);
		}
		50% {
			transform: translate3d(0, -3.5px, 0);
		}
	}

	.attached-inside-tray {
		width: 100%;
		min-width: 0;
		padding-bottom: 0.45rem;
		overflow: hidden;
	}

	.attached-previews-scroll {
		display: flex;
		align-items: center;
		gap: 8px;
		overflow-x: auto;
		padding: 6px 2px 4px;
		scrollbar-width: none;
	}

	.attached-previews-scroll::-webkit-scrollbar {
		display: none;
	}

	.preview-chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px 5px 7px;
		background: color-mix(in srgb, var(--white) 8%, transparent);
		border: none;
		border-radius: 12px;
		color: var(--fg);
		font-size: 0.75rem;
		flex-shrink: 0;
		animation: chipFloatBob 3.2s ease-in-out infinite;
		will-change: transform;
		transition: background-color 0.15s ease;
	}

	@media (prefers-reduced-motion: reduce) {
		.preview-chip {
			animation: none;
		}
	}

	.preview-chip:hover {
		background: color-mix(in srgb, var(--white) 13%, transparent);
	}

	.preview-chip.is-img {
		padding: 0;
		background: transparent;
		border-radius: 12px;
	}

	.preview-thumb {
		width: 50px;
		height: 50px;
		border-radius: 12px;
		object-fit: cover;
		display: block;
	}

	.preview-file-icon {
		color: var(--white-2);
		display: flex;
		align-items: center;
	}

	.preview-file-badge {
		font-size: 0.6rem;
		font-weight: var(--fw-bold);
		padding: 2px 5px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--white) 14%, transparent);
		color: var(--fg);
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}

	.preview-file-name {
		max-width: 110px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-remove-btn {
		width: 18px;
		height: 18px;
		border-radius: 9999px;
		border: none;
		background: color-mix(in srgb, var(--white) 16%, transparent);
		color: var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		margin-left: 2px;
		padding: 0;
		transition: background-color 0.15s ease;
	}

	.preview-remove-btn:hover {
		background: var(--danger);
	}

	.preview-chip.is-img .preview-remove-btn {
		position: absolute;
		top: -5px;
		right: -5px;
		background: color-mix(in srgb, var(--bg) 85%, transparent);
	}

	.drag-drop-overlay {
		position: absolute;
		inset: 0;
		border-radius: var(--bot-input-radius, 22px);
		background: color-mix(in srgb, var(--surface-2) 92%, transparent);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--white);
		font-size: 0.85rem;
		font-weight: var(--fw-semibold);
		z-index: 10;
		pointer-events: none;
	}
</style>
