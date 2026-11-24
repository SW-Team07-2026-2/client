<script lang="ts">
	interface Props {
		open: boolean;
		onToggle?: () => void;
	}

	let { open, onToggle }: Props = $props();
</script>

<!-- 아티스트 상세 정보 펼치기/접기 버튼 (순수 렌더링) -->
<button
	type="button"
	class="artist-more-toggle-btn"
	class:is-open={open}
	aria-expanded={open}
	onclick={() => onToggle?.()}
>
	<span>{open ? '상세 닫기' : '상세 보기'}</span>
	<svg
		class="chevron-icon"
		width="15"
		height="15"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="m6 9 6 6 6-6" />
	</svg>
</button>

<style>
	.artist-more-toggle-btn {
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
		gap: 0.35rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 0.18s ease,
			color 0.18s ease,
			transform 0.14s ease;
	}

	.artist-more-toggle-btn:hover,
	.artist-more-toggle-btn.is-open {
		background: var(--surface-2);
		color: var(--white);
	}

	.artist-more-toggle-btn:active {
		transform: scale(0.97);
	}

	.chevron-icon {
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.artist-more-toggle-btn.is-open .chevron-icon {
		transform: rotate(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron-icon {
			transition: none;
		}
	}
</style>
