<script lang="ts">
	import { slide } from 'svelte/transition';
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
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
		inputEl?: HTMLInputElement;
		onChangeValue?: (next: string) => void;
		onAddFiles?: (files: FileList | File[]) => void;
		onRemoveAttachment?: (id: string) => void;
		onSend?: (keepFocus?: boolean) => void;
		onClose?: () => void;
	}

	let {
		value,
		attachedFiles,
		canSubmit,
		disabled = false,
		placeholder = '음악 취향이나 궁금한 점을 물어보세요...',
		maxLength = 300,
		inputEl = $bindable(undefined),
		onChangeValue,
		onAddFiles,
		onRemoveAttachment,
		onSend,
		onClose
	}: Props = $props();

	let fileInputEl: HTMLInputElement | undefined = $state(undefined);
	let isFocused = $state(false);

	const fluidSetting = $derived.by(
		() =>
			new FluidSetting({
				radius: 22,
				reach: 0,
				bulge: 0,
				bulgeWidth: 24,
				layers: 2,
				layerGap: 2.0,
				waveAmp: 1.4,
				waveLength: 74,
				spin: 0.72,
				staticFrontWave: true,
				bulgeReactive: false,
				clickReactive: false,
				pauseWhenIdle: !isFocused,
				borderWidth: 0,
				color: isFocused ? '#25252b' : '#1a1a1f',
				hoverColor: isFocused ? '#25252b' : '#212127',
				pressColor: isFocused ? '#25252b' : '#212127',
				waveColor: isFocused ? '#32323b' : '#26262e',
				textColor: '#eee',
				pressDeform: { x: 0, y: 0 }
			})
	);

	function handleFileInputChange(e: Event & { currentTarget: HTMLInputElement }) {
		if (e.currentTarget.files && e.currentTarget.files.length > 0) {
			onAddFiles?.(e.currentTarget.files);
			e.currentTarget.value = '';
		}
	}

	function handleInputKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			if (e.isComposing) return;
			e.preventDefault();
			onSend?.(false);
		} else if (e.key === 'Escape') {
			onClose?.();
		}
	}

	function handleBodyClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (target?.closest('button, .preview-chip')) return;
		if (!disabled && document.activeElement !== inputEl) {
			inputEl?.focus();
		}
	}
</script>

<!-- 모바일 채팅 하단 플로팅 인풋 덱 (터치 전용 · 순수 렌더링) -->
<footer class="mb-chat-floating-deck">
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
		onsubmit={(e) => {
			e.preventDefault();
			onSend?.(false);
		}}
	>
		<div class="input-shell">
			<FdDiv
				setting={fluidSetting}
				{disabled}
				fullWidth={true}
				staticFrontWave={true}
				class="chat-fd-wrap"
				bodyClass="chat-fd-body"
				onclick={handleBodyClick}
			>
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

				<div class="chat-input-row">
					<button
						type="button"
						class="inline-attach-btn"
						onclick={() => fileInputEl?.click()}
						{disabled}
						aria-label="파일 첨부"
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

					<input
						bind:this={inputEl}
						type="text"
						{value}
						{placeholder}
						{disabled}
						maxlength={maxLength}
						class="chat-native-input"
						oninput={(e) => onChangeValue?.(e.currentTarget.value)}
						onkeydown={handleInputKeyDown}
						onfocus={() => (isFocused = true)}
						onblur={() => (isFocused = false)}
					/>

					<button
						type="submit"
						class="inline-send-btn"
						class:visible={value.trim().length > 0 || attachedFiles.length > 0}
						disabled={!canSubmit}
						aria-label="메시지 전송"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="21" height="24" viewBox="0 0 448 512">
							<path
								fill="currentColor"
								d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h306.7L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"
							/>
						</svg>
					</button>
				</div>
			</FdDiv>
		</div>
	</form>
</footer>

<style>
	.mb-chat-floating-deck {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: transparent;
		border: none;
		display: flex;
		flex-direction: column;
		pointer-events: none;
		z-index: 20;
	}

	.chat-input-form {
		pointer-events: auto;
		display: flex;
		align-items: flex-end;
		background: transparent;
		border: none;
		box-shadow: none;
		width: 100%;
	}

	.input-shell {
		flex: 1 1 0%;
		width: 100%;
		min-width: 0;
	}

	:global(.fd-wrap.chat-fd-wrap) {
		display: grid;
		width: 100%;
		min-width: 0;
		grid-template-columns: minmax(0, 1fr);
	}

	:global(.fd-wrap.chat-fd-wrap .fd-body.chat-fd-body) {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		min-width: 0;
		width: 100%;
		padding: 0.44rem 0.65rem 0.44rem 0.85rem;
		gap: 0;
		cursor: text;
		box-shadow: none;
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
		padding: 9px 4px 5px 4px;
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
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 12px;
		color: #e2e8f0;
		font-size: 0.75rem;
		flex-shrink: 0;
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
		color: #818cf8;
		display: flex;
		align-items: center;
	}

	.preview-file-icon.audio {
		color: #c084fc;
	}

	.preview-file-icon.video {
		color: #38bdf8;
	}

	.preview-file-badge {
		font-size: 0.6rem;
		font-weight: 700;
		padding: 2px 5px;
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.14);
		color: #e2e8f0;
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
		width: 20px;
		height: 20px;
		border-radius: 9999px;
		border: none;
		background: rgba(255, 255, 255, 0.18);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		margin-left: 2px;
		padding: 0;
		-webkit-tap-highlight-color: transparent;
	}

	.preview-chip.is-img .preview-remove-btn {
		position: absolute;
		top: -5px;
		right: -5px;
		background: rgba(15, 15, 20, 0.85);
	}

	.chat-input-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 32px;
		width: 100%;
	}

	.chat-native-input {
		flex: 1 1 0%;
		min-width: 0;
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		font: inherit;
		font-size: 0.95rem;
		line-height: 1.4;
		color: var(--fg, #eee);
		padding: 0.15rem 0;
		margin: 0;
		-webkit-appearance: none;
		appearance: none;
	}

	.chat-native-input::placeholder {
		color: #808080;
		opacity: 1;
	}

	.inline-attach-btn {
		background: transparent;
		border: none;
		color: #ffffff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 9999px;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		opacity: 0.85;
		-webkit-tap-highlight-color: transparent;
	}

	.inline-attach-btn:active {
		transform: scale(0.92);
	}

	.inline-send-btn {
		width: 0;
		height: 30px;
		opacity: 0;
		margin-left: 0;
		padding: 0;
		border: none;
		border-radius: 9999px;
		background: #ffffff;
		color: #111827;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		pointer-events: none;
		transform: scale(0.35) rotate(-15deg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
		flex-shrink: 0;
		overflow: hidden;
		-webkit-tap-highlight-color: transparent;
		transition:
			width 0.28s cubic-bezier(0.16, 1, 0.3, 1),
			transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 0.22s ease,
			margin-left 0.24s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.inline-send-btn.visible {
		width: 30px;
		opacity: 1;
		margin-left: 4px;
		pointer-events: auto;
		transform: scale(1) rotate(0deg);
	}

	.inline-send-btn:active {
		background: #e2e8f0;
		transform: scale(0.92) rotate(0deg);
	}

	.inline-send-btn svg {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}
</style>
