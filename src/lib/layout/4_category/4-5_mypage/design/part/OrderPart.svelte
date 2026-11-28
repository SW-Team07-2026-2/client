<script lang="ts">
	import { ShippingAddressCard } from '#lib/common/design/address';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { ShoppingBagIcon, TruckIcon } from '#lib/common/design/icon';
	import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '#lib/common/design/tabs';
	import { FluidSetting } from '#lib/common/type/fluid';
	import type { ShippingAddress } from '#lib/dedicated/pay/logic/types';
	import {
		canCancelOrder,
		formatOrderDate,
		formatOrderDateTime,
		formatOrderPrice,
		getOrderStatusMeta,
		resolveOrderItemName,
		resolveProductTypeLabel,
		type OrderDetailDto,
		type OrderFilterKey,
		type OrderFilterTab,
		type OrderLineItemDto,
		type OrderProductMeta,
		type OrderShippingDto,
		type OrderSummaryDto
	} from '../../logic/orderPart.svelte';

	interface Props {
		mobile: boolean;
		orders: readonly OrderSummaryDto[];
		totalCount: number;
		filterTabs: readonly OrderFilterTab[];
		activeFilter: OrderFilterKey;
		detailsById: Record<number, OrderDetailDto>;
		loadingDetailIds: Record<number, boolean>;
		productsById: Record<number, OrderProductMeta>;
		expandedOrderId: number | null;
		isLoading: boolean;
		isLoadingMore: boolean;
		hasNext: boolean;
		cancellingOrderId: number | null;
		errorMessage: string | null;
		onSelectFilter: (filter: OrderFilterKey) => void;
		onToggleExpand: (orderId: number) => void;
		onCancelOrder: (order: OrderSummaryDto) => void;
		onOpenProduct: (item: OrderLineItemDto) => void;
		onLoadMore: () => void;
		onRetry: () => void;
		onBrowseStore: () => void;
	}

	let {
		mobile,
		orders,
		totalCount,
		filterTabs,
		activeFilter,
		detailsById,
		loadingDetailIds,
		productsById,
		expandedOrderId,
		isLoading,
		isLoadingMore,
		hasNext,
		cancellingOrderId,
		errorMessage,
		onSelectFilter,
		onToggleExpand,
		onCancelOrder,
		onOpenProduct,
		onLoadMore,
		onRetry,
		onBrowseStore
	}: Props = $props();

	const SKELETON_INDICES = [0, 1, 2];

	const ACTION_BTN_SETTING = new FluidSetting({
		radius: 12,
		inset: 4,
		reach: 18,
		bulge: 2.4,
		bulgeWidth: 14,
		layers: 2,
		layerGap: 1.5,
		waveAmp: 1.3,
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

	function toShippingCardAddress(orderId: number, shipping: OrderShippingDto): ShippingAddress {
		return {
			id: orderId,
			label: null,
			recipientName: shipping.recipientName,
			phone: shipping.phone,
			zonecode: shipping.zonecode,
			address: shipping.address,
			addressDetail: shipping.addressDetail ?? null,
			isDefault: false
		};
	}

	function getOrdersForTab(key: OrderFilterKey): readonly OrderSummaryDto[] {
		if (key === 'ALL') return orders;
		if (key === 'CANCELLED') {
			return orders.filter((o) => o.status === 'CANCELLED' || o.status === 'REFUNDED');
		}
		return orders.filter((o) => o.status === key);
	}
</script>

<!-- 마이페이지 > 주문 · 배송 내역 파트 (Animate UI Tabs 적용, 순수 렌더링) -->
<div class="order-part" class:is-mobile={mobile} data-part="order">
	{#if isLoading && totalCount === 0}
		<div class="skeleton-list" aria-busy="true" aria-label="주문 내역 불러오는 중">
			{#each SKELETON_INDICES as idx (idx)}
				<div class="order-skeleton-card">
					<div class="skel-row-top">
						<span class="skel-pill skel-w-sm"></span>
						<span class="skel-pill skel-w-xs"></span>
					</div>
					<div class="skel-row-body">
						<span class="skel-thumb"></span>
						<div class="skel-lines">
							<span class="skel-line skel-w-lg"></span>
							<span class="skel-line skel-w-md"></span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if errorMessage && totalCount === 0}
		<div class="state-box" role="alert">
			<p class="state-title">{errorMessage}</p>
			<div class="state-action">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					class="order-fd-btn"
					onclick={onRetry}
				>
					다시 시도
				</FdButton>
			</div>
		</div>
	{:else if totalCount === 0}
		<div class="state-box">
			<span class="empty-icon" aria-hidden="true">
				<TruckIcon size={24} strokeWidth={1.7} />
			</span>
			<p class="state-title">주문 · 배송 내역이 없습니다</p>
			<p class="state-desc">
				음반이나 굿즈를 주문하시면 이곳에서 결제 상태와 배송 정보를 확인할 수 있어요.
			</p>
			<div class="state-action">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					class="order-fd-btn"
					onclick={onBrowseStore}
				>
					음반 둘러보기
				</FdButton>
			</div>
		</div>
	{:else}
		<Tabs
			value={activeFilter}
			onValueChange={(next) => onSelectFilter(next as OrderFilterKey)}
			class="order-tabs"
		>
			<TabsList ariaLabel="주문 상태 필터" class="order-tabs-list">
				{#each filterTabs as tab (tab.key)}
					<TabsTrigger value={tab.key}>
						<span>{tab.label}</span>
						<span class="filter-count">{tab.count}</span>
					</TabsTrigger>
				{/each}
			</TabsList>

			<TabsContents>
				{#each filterTabs as tab (tab.key)}
					{@const tabOrders = getOrdersForTab(tab.key)}
					<TabsContent value={tab.key}>
						{#if tabOrders.length === 0}
							<div class="state-box is-compact">
								<p class="state-title">해당 상태의 주문 내역이 없습니다</p>
								<button
									type="button"
									class="reset-filter-btn"
									onclick={() => onSelectFilter('ALL')}
								>
									전체 주문 보기
								</button>
							</div>
						{:else}
							<ul class="order-list">
								{#each tabOrders as order (order.orderId)}
				{@const statusMeta = getOrderStatusMeta(order.status)}
				{@const detail = detailsById[order.orderId]}
				{@const detailLoading = Boolean(loadingDetailIds[order.orderId])}
				{@const items = detail?.items ?? []}
				{@const firstItem = items[0]}
				{@const firstMeta = firstItem ? productsById[firstItem.productId] : undefined}
				{@const isExpanded = expandedOrderId === order.orderId}
				{@const isCancelling = cancellingOrderId === order.orderId}
				{@const cancelable = canCancelOrder(order.status)}
				<li class="order-card" class:is-expanded={isExpanded}>
					<!-- 카드 상단: 주문일 · 상태 배지 · 배송 안내 · 상세 토글 -->
					<div class="order-card-head">
						<div class="order-head-left">
							<span class="order-date">{formatOrderDate(order.createdAt)}</span>
							<span class="status-badge" data-tone={statusMeta.tone}>
								{statusMeta.label}
							</span>
							{#if statusMeta.deliveryText}
								<span class="delivery-text">{statusMeta.deliveryText}</span>
							{/if}
						</div>

						<button
							type="button"
							class="expand-toggle-btn"
							aria-expanded={isExpanded}
							onclick={() => onToggleExpand(order.orderId)}
						>
							<span>{isExpanded ? '접기' : '상세 보기'}</span>
							<svg
								class="expand-chevron"
								width="15"
								height="15"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</button>
					</div>

					<!-- 카드 요약 본문 -->
					<div class="order-card-summary">
						<button
							type="button"
							class="summary-main-btn"
							onclick={() => onToggleExpand(order.orderId)}
						>
							<div class="summary-thumb">
								{#if firstMeta?.thumbnailUrl}
									<img
										src={firstMeta.thumbnailUrl}
										alt={firstItem ? resolveOrderItemName(firstItem) : '주문 상품'}
										loading="lazy"
									/>
								{:else}
									<span class="thumb-placeholder" aria-hidden="true">
										<ShoppingBagIcon size={20} />
									</span>
								{/if}
							</div>

							<div class="summary-info">
								<p class="summary-title">
									{#if firstItem}
										{resolveOrderItemName(firstItem)}
										{#if items.length > 1}
											<span class="summary-extra">외 {items.length - 1}건</span>
										{/if}
									{:else}
										주문 #{order.orderId}
									{/if}
								</p>

								<p class="summary-sub">
									{#if firstItem}
										{#if firstItem.optionName?.trim()}
											<span>{firstItem.optionName.trim()}</span>
											<span class="dot-sep" aria-hidden="true">·</span>
										{/if}
										<span>
											총 {items.reduce((sum, it) => sum + (it.qty || 1), 0)}개
										</span>
									{:else}
										<span>주문 상세 정보를 확인하려면 눌러주세요</span>
									{/if}
								</p>

								<p class="summary-price">{formatOrderPrice(order.totalPrice)}</p>
							</div>
						</button>

						{#if cancelable}
							<div class="summary-actions">
								<button
									type="button"
									class="cancel-order-btn"
									disabled={isCancelling}
									onclick={() => onCancelOrder(order)}
								>
									{#if isCancelling}
										처리 중...
									{:else if order.status === 'CONFIRMED'}
										취소 · 환불
									{:else}
										주문 취소
									{/if}
								</button>
							</div>
						{/if}
					</div>

					<!-- 펼침 상세 패널 (주문 상품 전체 · 배송지 · 주문번호) -->
					<div class="order-detail-panel" aria-hidden={!isExpanded}>
						<div class="order-detail-inner">
							<div class="order-detail-content">
								{#if detailLoading && !detail}
									<p class="detail-loading">주문 상세 정보를 불러오는 중입니다...</p>
								{:else if detail}
									<!-- 1) 주문 상품 리스트 -->
									{#if items.length > 0}
										<div class="detail-block">
											<h4 class="detail-block-title">주문 상품 ({items.length})</h4>
											<ul class="order-item-list">
												{#each items as item, idx (`${order.orderId}-${item.productId}-${item.optionId ?? idx}`)}
													{@const meta = productsById[item.productId]}
													{@const typeLabel = resolveProductTypeLabel(
														item.productType ?? meta?.productType,
														meta?.format
													)}
													<li class="order-item-row">
														<button
															type="button"
															class="order-item-link"
															onclick={() => onOpenProduct(item)}
														>
															<div class="item-thumb">
																{#if meta?.thumbnailUrl}
																	<img
																		src={meta.thumbnailUrl}
																		alt={resolveOrderItemName(item)}
																		loading="lazy"
																	/>
																{:else}
																	<span class="thumb-placeholder is-sm" aria-hidden="true">
																		<ShoppingBagIcon size={16} />
																	</span>
																{/if}
															</div>

															<div class="item-body">
																<div class="item-title-row">
																	{#if typeLabel}
																		<span class="item-type-chip">{typeLabel}</span>
																	{/if}
																	<span class="item-name">{resolveOrderItemName(item)}</span>
																</div>

																<div class="item-meta-row">
																	{#if meta?.artistName}
																		<span>{meta.artistName}</span>
																		<span class="dot-sep" aria-hidden="true">·</span>
																	{/if}
																	{#if item.optionName?.trim()}
																		<span>{item.optionName.trim()}</span>
																		<span class="dot-sep" aria-hidden="true">·</span>
																	{/if}
																	<span>{item.qty}개</span>
																</div>
															</div>

															<span class="item-price">
																{formatOrderPrice(item.price * (item.qty || 1))}
															</span>
														</button>
													</li>
												{/each}
											</ul>
										</div>
									{/if}

									<!-- 2) 배송지 정보 (공용 ShippingAddressCard 재사용) -->
									{#if detail.shipping}
										<div class="detail-block">
											<h4 class="detail-block-title">배송지 정보</h4>
											<ShippingAddressCard
												address={toShippingCardAddress(order.orderId, detail.shipping)}
												class="order-shipping-card"
											/>
										</div>
									{/if}

									<!-- 3) 주문 · 결제 메타 정보 -->
									<div class="detail-block">
										<h4 class="detail-block-title">주문 정보</h4>
										<dl class="order-meta-grid">
											<div class="meta-pair">
												<dt>주문번호</dt>
												<dd class="mono-val">{detail.pgOrderId || `#${detail.orderId}`}</dd>
											</div>
											<div class="meta-pair">
												<dt>주문일시</dt>
												<dd>{formatOrderDateTime(detail.createdAt)}</dd>
											</div>
											<div class="meta-pair">
												<dt>총 결제 금액</dt>
												<dd class="strong-val">{formatOrderPrice(detail.totalPrice)}</dd>
											</div>
										</dl>
									</div>
								{:else}
									<p class="detail-loading">주문 상세 정보를 불러올 수 없습니다.</p>
								{/if}
							</div>
						</div>
					</div>
				</li>
								{/each}
							</ul>
						{/if}
					</TabsContent>
				{/each}
			</TabsContents>
		</Tabs>

		{#if hasNext}
			<div class="load-more-wrap">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					class="order-fd-btn"
					disabled={isLoadingMore}
					onclick={onLoadMore}
				>
					{isLoadingMore ? '불러오는 중...' : '더 불러오기'}
				</FdButton>
			</div>
		{/if}
	{/if}
</div>

<style>
	.order-part {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
	}

	/* ── 상태 필터 탭 ── */
	.order-part :global(.ui-tabs.order-tabs) {
		gap: 1rem;
	}

	.filter-count {
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}

	/* ── 스켈레톤 ── */
	.skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.order-skeleton-card {
		padding: 1.15rem 1.2rem;
		border-radius: 16px;
		background: var(--surface-dim);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.skel-row-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.skel-row-body {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.skel-thumb {
		width: 60px;
		height: 60px;
		border-radius: 10px;
		background: var(--surface-2);
		flex-shrink: 0;
		animation: order-skel-pulse 1.4s ease-in-out infinite;
	}

	.skel-lines {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.skel-pill,
	.skel-line {
		display: block;
		height: 14px;
		border-radius: 7px;
		background: var(--surface-2);
		animation: order-skel-pulse 1.4s ease-in-out infinite;
	}

	.skel-w-xs {
		width: 64px;
	}
	.skel-w-sm {
		width: 110px;
	}
	.skel-w-md {
		width: 45%;
	}
	.skel-w-lg {
		width: 72%;
	}

	@keyframes order-skel-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 0.9;
		}
	}

	/* ── 빈 / 에러 상태 ── */
	.state-box {
		padding: 3rem 1.25rem;
		border-radius: 16px;
		background: var(--surface-dim);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.65rem;
	}

	.state-box.is-compact {
		padding: 2.25rem 1.25rem;
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
		margin-bottom: 0.2rem;
	}

	.state-title {
		margin: 0;
		font-size: 0.96rem;
		font-weight: var(--fw-semibold);
		color: var(--white-2);
	}

	.state-desc {
		margin: 0;
		max-width: 340px;
		font-size: 0.84rem;
		color: var(--muted);
		line-height: 1.5;
		word-break: keep-all;
	}

	.state-action {
		margin-top: 0.55rem;
	}

	.reset-filter-btn {
		margin-top: 0.35rem;
		padding: 0.45rem 0.9rem;
		border: var(--thin-border);
		border-radius: 999px;
		background: transparent;
		color: var(--white-2);
		font: inherit;
		font-size: 0.82rem;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.reset-filter-btn:hover {
		background: var(--surface-1);
		color: var(--white);
	}

	/* ── 주문 카드 리스트 ── */
	.order-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.order-card {
		border-radius: 16px;
		background: var(--surface-dim);
		padding: 1.1rem 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		transition: background-color 0.16s ease;
	}

	.order-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: var(--thin-border);
	}

	.order-head-left {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-width: 0;
	}

	.order-date {
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
		font-variant-numeric: tabular-nums;
	}

	.status-badge {
		padding: 0.15rem 0.52rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: var(--fw-semibold);
		line-height: 1.35;
	}

	.status-badge[data-tone='confirmed'] {
		background: color-mix(in srgb, var(--white) 14%, transparent);
		color: var(--white);
	}

	.status-badge[data-tone='pending'] {
		background: var(--surface-2);
		color: var(--white-2);
	}

	.status-badge[data-tone='cancelled'] {
		background: color-mix(in srgb, var(--toast-error-bg) 70%, transparent);
		color: var(--toast-error-fg);
	}

	.delivery-text {
		font-size: 0.78rem;
		color: var(--muted);
	}

	.expand-toggle-btn {
		padding: 0.25rem 0.45rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.expand-toggle-btn:hover {
		color: var(--white);
		background: color-mix(in srgb, var(--white) 6%, transparent);
	}

	.expand-chevron {
		transition: transform 0.28s cubic-bezier(0.215, 0.61, 0.355, 1);
	}

	.order-card.is-expanded .expand-chevron {
		transform: rotate(180deg);
		color: var(--white);
	}

	/* ── 요약 행 ── */
	.order-card-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.9rem;
	}

	.summary-main-btn {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		cursor: pointer;
	}

	.summary-thumb {
		width: 60px;
		height: 60px;
		border-radius: 10px;
		overflow: hidden;
		background: var(--surface-2);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.summary-thumb img,
	.item-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.thumb-placeholder {
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.summary-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
	}

	.summary-title {
		margin: 0;
		font-size: 0.94rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
		line-height: 1.35;
		word-break: keep-all;
	}

	.summary-extra {
		margin-left: 0.3rem;
		font-size: 0.82rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
	}

	.summary-sub {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted);
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.32rem;
	}

	.summary-price {
		margin: 0.1rem 0 0;
		font-size: 0.94rem;
		font-weight: var(--fw-bold);
		color: var(--white-2);
		font-variant-numeric: tabular-nums;
	}

	.dot-sep {
		opacity: 0.5;
	}

	.summary-actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.cancel-order-btn {
		height: 32px;
		padding: 0 0.78rem;
		border: var(--thin-border);
		border-radius: 9px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.78rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.cancel-order-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--toast-error-bg) 70%, transparent);
		border-color: color-mix(in srgb, var(--toast-error-fg) 35%, transparent);
		color: var(--toast-error-fg);
	}

	.cancel-order-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ── 펼침 상세 패널 ── */
	.order-detail-panel {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows 0.3s cubic-bezier(0.215, 0.61, 0.355, 1),
			opacity 0.24s ease;
	}

	.order-card.is-expanded .order-detail-panel {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	.order-detail-inner {
		overflow: hidden;
		min-height: 0;
	}

	.order-detail-content {
		padding-top: 0.95rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.detail-loading {
		margin: 0;
		font-size: 0.83rem;
		color: var(--muted);
	}

	.detail-block {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.detail-block-title {
		margin: 0;
		font-size: 0.8rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
		letter-spacing: -0.01em;
	}

	.order-item-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.order-item-row {
		margin: 0;
	}

	.order-item-link {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border: none;
		border-radius: 12px;
		background: var(--surface-1);
		color: inherit;
		font: inherit;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.order-item-link:hover {
		background: var(--surface-2);
	}

	.item-thumb {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		overflow: hidden;
		background: var(--surface-2);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.item-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.item-title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.item-type-chip {
		padding: 0.08rem 0.4rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: var(--fw-semibold);
		flex-shrink: 0;
	}

	.item-name {
		font-size: 0.86rem;
		font-weight: var(--fw-semibold);
		color: var(--white-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta-row {
		font-size: 0.76rem;
		color: var(--muted);
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.item-price {
		font-size: 0.85rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.order-detail-content :global(.saved-addr-card.order-shipping-card) {
		background: var(--surface-1);
		padding: 0.85rem 1rem;
	}

	.order-meta-grid {
		margin: 0;
		padding: 0.75rem 0.95rem;
		border-radius: 12px;
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.meta-pair {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.82rem;
	}

	.meta-pair dt {
		color: var(--muted);
		flex-shrink: 0;
	}

	.meta-pair dd {
		margin: 0;
		color: var(--fg);
		text-align: right;
		word-break: break-all;
	}

	.meta-pair dd.mono-val {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.78rem;
		color: var(--white-2);
	}

	.meta-pair dd.strong-val {
		font-weight: var(--fw-bold);
		color: var(--white);
		font-variant-numeric: tabular-nums;
	}

	/* ── 더 불러오기 ── */
	.load-more-wrap {
		display: flex;
		justify-content: center;
		padding-top: 0.35rem;
	}

	.order-part :global(.fd-btn.order-fd-btn) {
		height: 38px;
		padding: 0 1.25rem;
		font-size: 0.85rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	/* ── 모바일 반응형 보정 ── */
	.order-part.is-mobile .order-card {
		padding: 1rem;
	}

	.order-part.is-mobile .order-card-summary {
		flex-direction: column;
		align-items: stretch;
		gap: 0.75rem;
	}

	.order-part.is-mobile .summary-actions {
		justify-content: flex-end;
	}

	@media (prefers-reduced-motion: reduce) {
		.expand-chevron,
		.order-detail-panel {
			transition: none;
		}
	}
</style>
