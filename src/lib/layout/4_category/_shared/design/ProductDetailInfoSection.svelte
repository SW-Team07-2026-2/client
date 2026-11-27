<script lang="ts">
	import MarkdownViewer from '#lib/common/design/MarkdownViewer.svelte';

	interface Props {
		/** 마크다운 설명 섹션 제목 (예: '상품 정보', 'LP 판본 정보') */
		heading?: string;
		/** 마크다운 본문 */
		description?: string;
		/** 상세 이미지 URL 목록 (최대 10개) */
		detailImageUrls?: readonly string[];
		/** 이미지 alt 텍스트용 상품명 */
		itemName?: string;
	}

	let {
		heading = '상세 정보',
		description = '',
		detailImageUrls = [],
		itemName = ''
	}: Props = $props();
</script>

<!-- 굿즈 · 앨범 판본 공용 v2 상세 설명(마크다운) 및 상세 이미지 갤러리 (순수 렌더링) -->
{#if description}
	<section class="product-info-section" aria-label={heading}>
		<h2 class="section-title">{heading}</h2>
		<MarkdownViewer content={description} class="product-detail-md" />
	</section>
{/if}

{#if detailImageUrls.length > 0}
	<section class="product-info-section" aria-label="상세 이미지">
		<div class="section-head">
			<h2 class="section-title">상세 이미지</h2>
			<span class="section-count">{detailImageUrls.length}장</span>
		</div>
		<div class="detail-image-grid" class:is-single={detailImageUrls.length === 1}>
			{#each detailImageUrls as url, idx (`${url}-${idx}`)}
				<img
					class="detail-image"
					src={url}
					alt={`${itemName || '상품'} 상세 이미지 ${idx + 1}`}
					loading="lazy"
					decoding="async"
				/>
			{/each}
		</div>
	</section>
{/if}

<style>
	.product-info-section {
		margin-top: 2.75rem;
		padding-top: 2rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.section-title {
		margin: 0;
		font-size: 1.12rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		letter-spacing: -0.02em;
	}

	.section-count {
		font-size: 0.82rem;
		color: var(--muted);
	}

	.product-info-section :global(.product-detail-md) {
		color: var(--fg);
		font-size: 0.94rem;
		line-height: 1.72;
		word-break: keep-all;
	}

	.detail-image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.9rem;
		align-items: start;
	}

	.detail-image-grid.is-single {
		grid-template-columns: minmax(0, 640px);
	}

	.detail-image {
		width: 100%;
		height: auto;
		border-radius: 16px;
		display: block;
		background: var(--surface);
	}
</style>
