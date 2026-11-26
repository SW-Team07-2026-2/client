<script lang="ts">
	import type { ChatMessage } from '../logic/types';
	import { formatFileSize, getFileExtension } from '../logic/attachment';

	interface Props {
		message: ChatMessage;
	}

	let { message }: Props = $props();
</script>

<!-- 유저 메시지: 알약 캡슐 말풍선 (#e5e5e5 배경 + 다크 텍스트) -->
<div class="user-bubble-wrap">
	{#if message.attachments && message.attachments.length > 0}
		<div class="user-attachments-grid">
			{#each message.attachments as att, attIdx (att.id || `att-${attIdx}`)}
				{#if att.isImage}
					<div class="user-attached-img-wrap">
						<img
							src={att.url || att.file_uri}
							alt={att.name || '첨부 이미지'}
							class="user-attached-img"
						/>
					</div>
				{:else if att.isAudio}
					<div class="user-attached-audio-card">
						<div class="audio-card-top">
							<svg
								class="audio-icon"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M9 18V5l12-2v13"></path>
								<circle cx="6" cy="18" r="3"></circle>
								<circle cx="18" cy="16" r="3"></circle>
							</svg>
							<div class="file-info">
								<span class="file-name">{att.name || '음원 파일'}</span>
								{#if att.size && formatFileSize(att.size)}
									<span class="file-size">{formatFileSize(att.size)}</span>
								{/if}
							</div>
						</div>
						{#if att.url}
							<audio controls src={att.url} class="user-inline-audio" preload="metadata"></audio>
						{/if}
					</div>
				{:else if att.isVideo}
					<div class="user-attached-video-wrap">
						{#if att.url}
							<video controls src={att.url} preload="metadata" class="user-inline-video">
								<track kind="captions" />
							</video>
						{/if}
						<div class="video-meta">
							<span class="file-name">{att.name || '영상 파일'}</span>
							{#if att.size && formatFileSize(att.size)}
								<span class="file-size">{formatFileSize(att.size)}</span>
							{/if}
						</div>
					</div>
				{:else}
					<div class="user-attached-file-card">
						<div class="file-ext-badge">{getFileExtension(att.name)}</div>
						<div class="file-info">
							<span class="file-name">{att.name || '첨부 파일'}</span>
							{#if att.size && formatFileSize(att.size)}
								<span class="file-size">{formatFileSize(att.size)}</span>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if message.text}
		<div class="user-bubble">
			<p class="user-text">{message.text}</p>
		</div>
	{/if}
</div>

<style>
	.user-bubble-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		max-width: 82%;
		transform-origin: bottom right;
		animation: userBubbleRise 0.36s cubic-bezier(0.16, 1, 0.3, 1) both;
		will-change: transform, opacity;
	}

	@keyframes userBubbleRise {
		from {
			opacity: 0;
			transform: translate3d(0, 22px, 0) scale(0.94);
		}
		to {
			opacity: 1;
			transform: translate3d(0, 0, 0) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.user-bubble-wrap {
			animation: none;
		}
	}

	.user-bubble {
		background: #e5e5e5;
		color: #171717;
		padding: 0.7rem 1rem;
		border-radius: 18px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.user-text {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 500;
		line-height: 1.45;
		color: #111827;
		word-break: break-word;
		white-space: pre-wrap;
	}

	/* 유저 말풍선 내부 첨부파일 표시 */
	.user-attachments-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: flex-end;
		max-width: 100%;
	}

	.user-attached-img-wrap {
		border-radius: 14px;
		overflow: hidden;
		max-width: 220px;
		max-height: 220px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
	}

	.user-attached-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* 오디오 첨부 카드 */
	.user-attached-audio-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 0.65rem 0.85rem;
		background: rgba(28, 28, 36, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 14px;
		color: #f1f5f9;
		width: 100%;
		min-width: 230px;
		max-width: 280px;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
	}

	.audio-card-top {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.audio-card-top .audio-icon {
		width: 18px;
		height: 18px;
		color: #c084fc;
		flex-shrink: 0;
	}

	.file-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.file-name {
		font-weight: 500;
		font-size: 0.8125rem;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-size {
		font-size: 0.7rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.user-inline-audio {
		width: 100%;
		height: 32px;
		border-radius: 8px;
		outline: none;
	}

	/* 비디오 첨부 카드 */
	.user-attached-video-wrap {
		border-radius: 14px;
		overflow: hidden;
		max-width: 260px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: #000;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
	}

	.user-inline-video {
		display: block;
		width: 100%;
		max-height: 180px;
		object-fit: contain;
		background: #000;
	}

	.video-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 5px 8px;
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.7);
		background: rgba(20, 20, 25, 0.9);
	}

	.video-meta .file-name {
		max-width: 160px;
		font-size: 0.72rem;
	}

	.video-meta .file-size {
		color: rgba(255, 255, 255, 0.45);
	}

	/* 일반 문서/코드 첨부 카드 */
	.user-attached-file-card {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0.5rem 0.85rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		color: #f1f5f9;
		font-size: 0.8125rem;
	}

	.file-ext-badge {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(129, 140, 248, 0.2);
		border: 1px solid rgba(129, 140, 248, 0.4);
		color: #c7d2fe;
		letter-spacing: 0.03em;
		flex-shrink: 0;
	}

	.user-attached-file-card .file-name {
		max-width: 140px;
	}
</style>

