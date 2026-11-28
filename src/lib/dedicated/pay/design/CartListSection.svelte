<script lang="ts">
	import AnimatedCheckbox from '#lib/common/design/AnimatedCheckbox.svelte';
	import SlidingNumber from '#lib/common/design/SlidingNumber.svelte';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import SpringNumberStepper from '#lib/common/design/SpringNumberStepper.svelte';
	import type { CartLineItem } from '../logic/types';

	interface Props {
		loading: boolean;
		items: readonly CartLineItem[];
		selectedMap: Record<number, boolean>;
		busyOptions: Record<number, boolean>;
		clearing: boolean;
		isAllSelected: boolean;
		selectedCount: number;
		getMaxQty: (item: CartLineItem) => number;
		onToggleSelectAll: () => void;
		onToggleSelect: (optionId: number) => void;
		onStepQty: (optionId: number, delta: number) => void;
		onRemoveItem: (optionId: number) => void;
		onClearCart: () => void;
		onOpenProduct: (item: CartLineItem) => void;
		onGoToCatalog: () => void;
	}

	let {
		loading,
		items,
		selectedMap,
		busyOptions,
		clearing,
		isAllSelected,
		selectedCount,
		getMaxQty,
		onToggleSelectAll,
		onToggleSelect,
		onStepQty,
		onRemoveItem,
		onClearCart,
		onOpenProduct,
		onGoToCatalog
	}: Props = $props();

	const SKELETON_ROWS = [0, 1, 2];

	function formatProductType(type: string): string {
		return type?.toUpperCase() === 'PHYSICAL_ALBUM' ? '음반' : '굿즈';
	}

	function formatOptionMeta(item: CartLineItem): string {
		const parts = [item.optionName];
		if (item.vinylColor && item.vinylColor !== item.optionName) parts.push(item.vinylColor);
		if (item.size && item.size !== item.optionName) parts.push(item.size);
		return parts.filter(Boolean).join(' · ');
	}
</script>

<!-- 장바구니 좌측 섹션 (스켈레톤 · 전체선택 툴바 · 상품 리스트 · 빈 상태, 순수 렌더링) -->
{#if loading && items.length === 0}
	<div class="cart-list-col" role="status" aria-busy="true" aria-label="장바구니 불러오는 중">
		<div class="cart-toolbar">
			<span class="skel-bar skeleton-shimmer" style="width: 112px; height: 18px;"></span>
			<span class="skel-bar skeleton-shimmer" style="width: 68px; height: 16px;"></span>
		</div>

		<ul class="cart-items" aria-hidden="true">
			{#each SKELETON_ROWS as idx (idx)}
				<li class="cart-item" style:--skeleton-delay="{idx * 80}ms">
					<div class="item-check-col">
						<span class="skel-check skeleton-shimmer"></span>
					</div>
					<div class="skel-thumb skeleton-shimmer"></div>
					<div class="item-body">
						<div class="item-top">
							<span class="skel-pill skeleton-shimmer"></span>
							<span class="skel-icon skeleton-shimmer"></span>
						</div>
						<span class="skel-bar skeleton-shimmer" style="width: 66%; height: 19px;"></span>
						<span class="skel-bar skeleton-shimmer" style="width: 40%; height: 15px;"></span>
						<div class="item-controls">
							<span class="skel-stepper skeleton-shimmer"></span>
							<span class="skel-bar skeleton-shimmer" style="width: 82px; height: 22px;"></span>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<section class="cart-list-col" aria-label="장바구니 상품 목록">
		<div class="cart-toolbar">
			<label class="select-all-label">
				<AnimatedCheckbox
					checked={isAllSelected}
					indeterminate={!isAllSelected && selectedCount > 0}
					disabled={items.length === 0}
					ariaLabel="전체 선택"
					onChange={onToggleSelectAll}
				/>
				<span>
					전체 선택 (<SlidingNumber value={selectedCount} thousandSeparator="" />/<SlidingNumber
						value={items.length}
						thousandSeparator=""
					/>)
				</span>
			</label>

			<button
				type="button"
				class="text-action-btn"
				disabled={clearing || items.length === 0}
				onclick={onClearCart}
			>
				전체 비우기
			</button>
		</div>

		{#if items.length === 0}
			<div class="cart-empty-box">
				<div class="empty-icon" aria-hidden="true">
					<svg
						width="34"
						height="34"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"
						/>
						<path d="M3.103 6.034h17.794" />
						<path d="M16 10a4 4 0 0 1-8 0" />
					</svg>
				</div>
				<p class="empty-title">장바구니가 비어 있습니다.</p>
				<p class="empty-sub">마음에 드는 음반과 굿즈를 담아보세요.</p>
				<button type="button" class="empty-browse-btn" onclick={onGoToCatalog}>
					카탈로그 둘러보기
				</button>
			</div>
		{:else}
			<ul class="cart-items">
				{#each items as item (item.optionId)}
					{@const checked = Boolean(selectedMap[item.optionId])}
					{@const busy = Boolean(busyOptions[item.optionId])}
					<li class="cart-item" class:is-soldout={item.soldOut} class:is-busy={busy}>
						<div class="item-check-col">
							<AnimatedCheckbox
								{checked}
								disabled={item.soldOut}
								ariaLabel={`${item.productName} 선택`}
								onChange={() => onToggleSelect(item.optionId)}
							/>
						</div>

						<button
							type="button"
							class="item-thumb-btn"
							onclick={() => onOpenProduct(item)}
							aria-label={`${item.productName} 상세 보기`}
						>
							{#if item.thumbnailUrl}
								<img src={item.thumbnailUrl} alt={item.productName} crossorigin="anonymous" loading="lazy" />
							{:else}
								<span class="thumb-placeholder" aria-hidden="true"></span>
							{/if}
						</button>

						<div class="item-body">
							<div class="item-top">
								<div class="item-meta">
									<span class="type-pill">{formatProductType(item.productType)}</span>
									{#if item.soldOut}
										<span class="type-pill is-soldout">품절</span>
									{/if}
								</div>

								<button
									type="button"
									class="item-remove-btn"
									disabled={busy}
									aria-label={`${item.productName} 삭제`}
									title="삭제"
									onclick={() => onRemoveItem(item.optionId)}
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
										<path d="M18 6 6 18" />
										<path d="m6 6 12 12" />
									</svg>
								</button>
							</div>

							<button
								type="button"
								class="item-title-btn"
								onclick={() => onOpenProduct(item)}
							>
								{item.productName}
							</button>

							{#if formatOptionMeta(item)}
								<p class="item-option">{formatOptionMeta(item)}</p>
							{/if}

							<div class="item-controls">
								<SpringNumberStepper
									value={item.qty}
									min={1}
									max={getMaxQty(item)}
									disabled={item.soldOut || busy}
									onStep={(delta) => onStepQty(item.optionId, delta)}
								/>

								<div class="item-price">
									<SlidingPrice value={item.price * item.qty} soldOut={item.soldOut} />
								</div>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.cart-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.9rem;
		border-bottom: var(--thin-border);
	}

	.select-all-label {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.88rem;
		font-weight: var(--fw-semibold);
		color: var(--fg);
		cursor: pointer;
		user-select: none;
	}

	.text-action-btn {
		padding: 0.25rem 0.4rem;
		border: none;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.84rem;
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.text-action-btn:hover:not(:disabled) {
		color: var(--white);
	}

	.text-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cart-empty-box {
		min-height: 280px;
		padding: 2rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.6rem;
	}

	.empty-icon {
		color: var(--muted);
		opacity: 0.7;
		margin-bottom: 0.25rem;
	}

	.empty-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.empty-sub {
		margin: 0;
		font-size: 0.88rem;
		color: var(--muted);
	}

	.empty-browse-btn {
		margin-top: 0.75rem;
		height: 42px;
		padding: 0 1.25rem;
		border: none;
		border-radius: 12px;
		background: var(--surface-dim);
		color: var(--white-2);
		font: inherit;
		font-size: 0.88rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background-color 0.16s ease;
	}

	.empty-browse-btn:hover {
		background: var(--surface-1);
	}

	.cart-items {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.cart-item {
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
		padding: 1.15rem 0;
		border-bottom: var(--thin-border);
		transition: opacity 0.18s ease;
	}

	.cart-item.is-soldout {
		opacity: 0.58;
	}

	.cart-item.is-busy {
		opacity: 0.72;
	}

	.item-check-col {
		padding-top: 0.2rem;
		flex-shrink: 0;
	}

	.item-thumb-btn {
		width: 84px;
		height: 84px;
		padding: 0;
		border: none;
		border-radius: 14px;
		overflow: hidden;
		background: var(--surface-dim);
		flex-shrink: 0;
		cursor: pointer;
	}

	.item-thumb-btn img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.thumb-placeholder {
		display: block;
		width: 100%;
		height: 100%;
		background: var(--surface-2);
	}

	.item-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.item-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.item-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.type-pill {
		padding: 0.12rem 0.48rem;
		border-radius: 999px;
		background: var(--surface-dim);
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: var(--fw-semibold);
	}

	.type-pill.is-soldout {
		background: var(--surface-2);
		color: var(--white-2);
	}

	.item-remove-btn {
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.item-remove-btn:hover:not(:disabled) {
		color: var(--white);
	}

	.item-title-btn {
		padding: 0;
		border: none;
		background: transparent;
		color: var(--white);
		font: inherit;
		font-size: 0.98rem;
		font-weight: var(--fw-bold);
		text-align: left;
		line-height: 1.3;
		cursor: pointer;
		word-break: keep-all;
	}

	.item-title-btn:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.item-option {
		margin: 0;
		font-size: 0.84rem;
		color: var(--muted);
	}

	.item-controls {
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.item-price {
		margin-left: auto;
	}

	.skel-bar {
		display: block;
		border-radius: 6px;
	}

	.skel-check {
		display: block;
		width: 18px;
		height: 18px;
		border-radius: 4px;
	}

	.skel-thumb {
		width: 84px;
		height: 84px;
		border-radius: 14px;
		flex-shrink: 0;
	}

	.skel-pill {
		display: inline-block;
		width: 40px;
		height: 20px;
		border-radius: 999px;
	}

	.skel-icon {
		display: inline-block;
		width: 20px;
		height: 20px;
		border-radius: 6px;
	}

	.skel-stepper {
		display: inline-block;
		width: 112px;
		height: 44px;
		border-radius: 14px;
	}
</style>
