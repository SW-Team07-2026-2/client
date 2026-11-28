<script lang="ts">
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { BookmarkIcon } from '#lib/common/design/icon';
	import { prefetchDetailApi, prefetchDetailImage } from '../../../_shared/logic/detailPrefetch';
	import type {
		AlbumCardGroup,
		AlbumSelectPayload
	} from '../../../4-3_album/logic/albumCategory.svelte';
	import PcAlbumItem from '../../../4-3_album/design/PcAlbumItem.svelte';
	import MbAlbumItem from '../../../4-3_album/design/MbAlbumItem.svelte';
	import PcAlbumSkeleton from '../../../4-3_album/design/PcAlbumSkeleton.svelte';
	import MbAlbumSkeleton from '../../../4-3_album/design/MbAlbumSkeleton.svelte';

	interface Props {
		mobile: boolean;
		groups: readonly AlbumCardGroup[];
		totalCount: number;
		isLoading: boolean;
		isLoadingMore: boolean;
		hasNext: boolean;
		errorMessage: string | null;
		onSelectAlbum: (payload: AlbumSelectPayload) => void;
		onLoadMore: () => void;
		onRetry: () => void;
		onBrowseAlbums: () => void;
	}

	let {
		mobile,
		groups,
		totalCount,
		isLoading,
		isLoadingMore,
		hasNext,
		errorMessage,
		onSelectAlbum,
		onLoadMore,
		onRetry,
		onBrowseAlbums
	}: Props = $props();

	const PC_SKELETON_INDICES = Array.from({ length: 8 }, (_, i) => i);
	const MB_SKELETON_INDICES = Array.from({ length: 6 }, (_, i) => i);

	const ACTION_BTN_SETTING = new FluidSetting({
		radius: 12,
		inset: 4,
		reach: 18,
		bulge: 2.5,
		bulgeWidth: 14,
		layers: 2,
		layerGap: 1.5,
		waveAmp: 1.4,
		waveLength: 42,
		spin: 1.1,
		pauseWhenIdle: true,
		color: 'var(--surface-2)',
		hoverColor: 'var(--surface-3)',
		pressColor: 'var(--surface-4)',
		waveColor: 'var(--surface-3)',
		hoverWaveColor: 'var(--surface-4)',
		textColor: 'var(--white)',
		borderWidth: 0
	});

	function prefetchAlbum(group: AlbumCardGroup) {
		prefetchDetailApi(`/api/catalog/products/${group.primaryItem.id}`);
		if (typeof group.albumId === 'number') {
			prefetchDetailApi(`/api/catalog/albums/${group.albumId}`);
		}
		prefetchDetailImage(group.frontCoverUrl);
	}
</script>

<!-- 마이페이지 > 보유 음반 파트 (4-3_album PcAlbumItem · MbAlbumItem 그대로 재사용, 순수 렌더링) -->
<div class="collection-part" data-part="collection">
	{#if isLoading && groups.length === 0}
		<div class="album-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#if mobile}
				{#each MB_SKELETON_INDICES as idx (idx)}
					<MbAlbumSkeleton index={idx} />
				{/each}
			{:else}
				{#each PC_SKELETON_INDICES as idx (idx)}
					<PcAlbumSkeleton index={idx} />
				{/each}
			{/if}
		</div>
	{:else if errorMessage && groups.length === 0}
		<div class="state-box" role="alert">
			<p class="state-title">{errorMessage}</p>
			<div class="state-action">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					class="collection-fd-btn"
					onclick={onRetry}
				>
					다시 시도
				</FdButton>
			</div>
		</div>
	{:else if groups.length === 0}
		<div class="state-box">
			<span class="empty-icon" aria-hidden="true">
				<BookmarkIcon size={24} strokeWidth={1.7} />
			</span>
			<p class="state-title">보유 중인 음반이 없습니다</p>
			<p class="state-desc">
				앨범 상세 페이지에서 보유 음반으로 등록하거나 구매하면 이곳에 자동으로 모여요.
			</p>
			<div class="state-action">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					class="collection-fd-btn"
					onclick={onBrowseAlbums}
				>
					음반 둘러보기
				</FdButton>
			</div>
		</div>
	{:else}
		<div class="collection-summary-bar">
			<span class="summary-count">총 <strong>{totalCount.toLocaleString('ko-KR')}</strong>장 보유</span>
		</div>

		<div class="album-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#each groups as group (group.key)}
				<div
					class="feed-card-slot"
					class:is-mobile={mobile}
					role="presentation"
					onpointerenter={(e) => {
						if (e.pointerType === 'mouse') prefetchAlbum(group);
					}}
					ontouchstart={() => prefetchAlbum(group)}
				>
					{#if mobile}
						<MbAlbumItem {group} interactive={true} onSelect={onSelectAlbum} />
					{:else}
						<PcAlbumItem {group} interactive={true} onSelect={onSelectAlbum} />
					{/if}
				</div>
			{/each}
		</div>

		{#if hasNext}
			<div class="load-more-row">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					disabled={isLoadingMore}
					class="collection-fd-btn"
					onclick={onLoadMore}
				>
					{isLoadingMore ? '불러오는 중...' : '더 보기'}
				</FdButton>
			</div>
		{/if}
	{/if}
</div>

<style>
	.collection-part {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.collection-summary-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.15rem 0.5rem;
	}

	.summary-count {
		font-size: 0.84rem;
		color: var(--muted);
	}

	.summary-count strong {
		color: var(--white);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	/* 4-3_album/AlbumSection.svelte와 동일한 그리드 규격 유지 */
	.album-grid {
		display: grid;
		width: 100%;
		align-items: start;
	}

	.album-grid.is-pc {
		grid-template-columns: repeat(auto-fill, minmax(var(--pc-catalog-card-min-width, 180px), 1fr));
		column-gap: var(--pc-catalog-column-gap, 1.85rem);
		row-gap: 3.25rem;
		padding-top: 2rem;
	}

	.album-grid.is-mobile {
		grid-template-columns: 1fr;
		column-gap: 0;
		row-gap: 0.15rem;
		padding-top: 0.15rem;
	}

	.feed-card-slot {
		min-width: 0;
	}

	.state-box {
		min-height: 280px;
		padding: 2.5rem 1.25rem;
		border-radius: 16px;
		background: var(--surface-dim);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.55rem;
	}

	.empty-icon {
		width: 48px;
		height: 48px;
		border-radius: 999px;
		background: var(--surface-1);
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.25rem;
	}

	.state-title {
		margin: 0;
		font-size: 0.96rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.state-desc {
		margin: 0;
		max-width: 340px;
		font-size: 0.83rem;
		line-height: 1.55;
		color: var(--muted);
		word-break: keep-all;
	}

	.state-action {
		margin-top: 0.65rem;
	}

	.load-more-row {
		margin-top: 2.5rem;
		display: flex;
		justify-content: center;
	}

	.collection-part :global(.fd-btn.collection-fd-btn) {
		height: 38px;
		padding: 0 1.25rem;
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
