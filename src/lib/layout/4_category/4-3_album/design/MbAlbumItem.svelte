<script lang="ts">
	import { scrollReveal } from '#lib/common/logic';
	import { formatAlbumPriceRange } from '#lib/common/catalog/albums';
	import type { AlbumCardGroup, AlbumSelectPayload } from '../logic/albumCategory.svelte';

	interface Props {
		group: AlbumCardGroup;
		interactive?: boolean;
		onSelect?: (payload: AlbumSelectPayload) => void;
	}

	let { group, interactive = true, onSelect }: Props = $props();

	let pressed = $state(false);

	const coverUrl = $derived(group.frontCoverUrl);
	const isSoldOut = $derived(group.isSoldOut);

	$effect(() => {
		if (!interactive) {
			pressed = false;
		}
	});

	function handleSelect() {
		onSelect?.({ group });
	}
</script>

<!-- 모바일 전용 가로 풀폭 앨범 행 카드 (좌측 커버 · 우측 상단 제목/아티스트 · 우측 하단 형태/가격 + 공용 스크롤 모션) -->
<article
	use:scrollReveal
	class="mb-album-item mb-scroll-reveal"
	class:is-pressed={interactive && pressed}
	class:is-sold-out={isSoldOut}
>
	<button
		type="button"
		class="album-row-btn"
		aria-label={`${group.title} - ${group.artistName}`}
		onpointerdown={() => {
			pressed = true;
		}}
		onpointerup={() => {
			pressed = false;
		}}
		onpointercancel={() => {
			pressed = false;
		}}
		onpointerleave={() => {
			pressed = false;
		}}
		onclick={handleSelect}
	>
		<!-- 좌측 1:1 앨범 커버 -->
		<div class="album-thumb">
			{#if coverUrl}
				<img
					class="album-cover-img"
					src={coverUrl}
					alt={group.title}
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<div class="album-cover-fallback" aria-hidden="true"></div>
			{/if}
		</div>

		<!-- 우측: 상단 앨범명·아티스트명(+우상단 품절 뱃지) / 하단 형태·가격 -->
		<div class="album-body">
			<div class="album-head">
				<div class="album-head-top">
					<h3 class="album-title">{group.title}</h3>
					{#if isSoldOut}
						<span class="album-soldout-badge">품절</span>
					{/if}
				</div>
				{#if group.artistName}
					<p class="album-artist">{group.artistName}</p>
				{/if}
			</div>

			<div class="album-meta-list">
				{#each group.formatPrices as row (row.format)}
					{@const rowPrice = formatAlbumPriceRange(row.minPrice, row.maxPrice)}
					<div class="album-meta-row" class:is-row-soldout={row.soldOut}>
						<span class="album-format">{row.format}</span>
						{#if rowPrice}
							<span class="album-price">{rowPrice}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</button>
</article>

<style>
	.mb-album-item {
		width: 100%;
		box-sizing: border-box;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.album-row-btn {
		width: 100%;
		padding: 0.72rem 0.25rem;
		margin: 0;
		border: none;
		border-bottom: var(--thin-border);
		background: transparent;
		font: inherit;
		text-align: left;
		color: inherit;
		cursor: pointer;
		outline: none;
		display: flex;
		align-items: stretch;
		gap: 0.9rem;
		box-sizing: border-box;
		transition:
			transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
			background-color 0.18s ease;
	}

	.mb-album-item.is-pressed .album-row-btn {
		transform: scale(0.985);
		background: color-mix(in srgb, var(--surface) 50%, transparent);
		border-radius: 12px;
	}

	.album-thumb {
		position: relative;
		width: 92px;
		height: 92px;
		flex-shrink: 0;
		border-radius: 10px;
		overflow: hidden;
		background: var(--surface);
	}

	.album-cover-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}

	.album-cover-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(145deg, var(--surface-2), var(--surface-dim));
	}

	.mb-album-item.is-sold-out .album-cover-img {
		opacity: 0.58;
	}

	.album-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.45rem;
		padding: 0.1rem 0;
	}

	.album-head {
		display: flex;
		flex-direction: column;
		gap: 0.16rem;
		min-width: 0;
	}

	.album-head-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
	}

	.album-soldout-badge {
		flex-shrink: 0;
		padding: 0.16rem 0.52rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 0.7rem;
		font-weight: var(--fw-semibold);
		line-height: 1.25;
		letter-spacing: 0.02em;
	}

	.album-title {
		margin: 0;
		font-size: 0.96rem;
		font-weight: var(--fw-bold);
		line-height: 1.3;
		letter-spacing: -0.02em;
		color: var(--white);
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: keep-all;
	}

	.album-artist {
		margin: 0;
		font-size: 0.8rem;
		font-weight: var(--fw-medium);
		line-height: 1.25;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.album-meta-list {
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
	}

	.album-meta-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.album-meta-row.is-row-soldout {
		opacity: 0.52;
	}

	.album-meta-row.is-row-soldout .album-format,
	.album-meta-row.is-row-soldout .album-price {
		text-decoration: line-through;
	}

	.album-format {
		padding: 0.1rem 0.44rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-3);
		font-size: 0.7rem;
		font-weight: var(--fw-medium);
		line-height: 1.2;
	}

	.album-price {
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		color: var(--fg);
		letter-spacing: -0.01em;
	}

	@media (prefers-reduced-motion: reduce) {
		.album-row-btn {
			transition: none;
		}
	}
</style>
