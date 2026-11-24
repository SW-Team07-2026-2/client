<script lang="ts">
	interface Props {
		onShare?: () => void;
	}

	let { onShare }: Props = $props();
</script>

<!-- 아티스트 상세 링크 공유 버튼 (순수 렌더링) -->
<button
	type="button"
	class="artist-detail-action-btn"
	aria-label="링크 공유"
	onclick={() => onShare?.()}
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
		aria-hidden="true"
	>
		<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
		<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
	</svg>
	<span>공유</span>
</button>

<style>
	.artist-detail-action-btn {
		height: 40px;
		padding: 0 1rem;
		border-radius: 999px;
		border: var(--thin-border);
		background: color-mix(in srgb, var(--surface) 78%, transparent);
		color: var(--fg);
		font: inherit;
		font-size: 0.86rem;
		font-weight: var(--fw-medium);
		display: inline-flex;
		align-items: center;
		gap: 0.42rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 0.18s ease,
			color 0.18s ease,
			transform 0.14s ease;
	}

	.artist-detail-action-btn:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.artist-detail-action-btn:active {
		transform: scale(0.97);
	}
</style>
