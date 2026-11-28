<script lang="ts">
	import AnimatedCheckbox from '#lib/common/design/AnimatedCheckbox.svelte';
	import { ShippingAddressCard, ShippingAddressForm } from '#lib/common/design/address';
	import { SmoothTab, type SmoothTabItem } from '#lib/common/design/smooth_tab';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import type {
		CheckoutItemSnapshot,
		ShippingAddress,
		ShippingFormInput
	} from '../logic/types';

	interface Props {
		mobile?: boolean;
		loading: boolean;
		errorMessage: string | null;
		items: readonly CheckoutItemSnapshot[];
		totalQty: number;
		addresses: readonly ShippingAddress[];
		selectedAddressId: number | 'manual';
		shipping: ShippingFormInput;
		saveAsNewAddress: boolean;
		validationError: string | null;
		widgetLoading: boolean;
		widgetError: string | null;
		paymentMethodsId: string;
		agreementId: string;
		onSelectAddress: (id: number | 'manual') => void;
		onUpdateShipping: (field: keyof ShippingFormInput, value: string) => void;
		onToggleSaveAddress: (checked: boolean) => void;
		onSearchAddress: () => Promise<boolean>;
	}

	let {
		mobile = false,
		loading,
		errorMessage,
		items,
		totalQty,
		addresses,
		selectedAddressId,
		shipping,
		saveAsNewAddress,
		validationError,
		widgetLoading,
		widgetError,
		paymentMethodsId,
		agreementId,
		onSelectAddress,
		onUpdateShipping,
		onToggleSaveAddress,
		onSearchAddress
	}: Props = $props();

	const selectedAddressValue = $derived(
		selectedAddressId === 'manual' ? 'manual' : String(selectedAddressId)
	);
	const addressTabItems = $derived<SmoothTabItem[]>([
		...addresses.map((addr) => ({
			id: String(addr.id),
			title: addr.label || addr.recipientName,
			badge: addr.isDefault ? '기본' : undefined
		})),
		{
			id: 'manual',
			title: '직접 입력하기'
		}
	]);
	const addressById = $derived(new Map(addresses.map((addr) => [String(addr.id), addr])));

	function handleSelectAddressValue(val: string) {
		if (val === 'manual') {
			onSelectAddress('manual');
			return;
		}
		const numId = Number(val);
		if (Number.isFinite(numId)) {
			onSelectAddress(numId);
		}
	}
</script>

<!-- 주문·결제 좌측 섹션 (배송지 입력 · 주문 상품 요약 · 토스페이먼츠 위젯, 순수 렌더링) -->
{#if loading && items.length === 0}
	<div class="checkout-state-box" role="status" aria-live="polite">
		<LoadingSpinner size={24} />
	</div>
{:else if errorMessage && items.length === 0}
	<div class="checkout-state-box" role="alert">
		<p class="checkout-state-text">{errorMessage}</p>
	</div>
{:else}
	<div class="checkout-main-col">
		<section class="checkout-section" aria-label="배송지 정보">
			<h2 class="section-heading">배송지 정보</h2>

			<SmoothTab
				items={addressTabItems}
				value={selectedAddressValue}
				onChange={handleSelectAddressValue}
				label="배송지 선택"
			>
				{#snippet panel(tab)}
					{@const savedAddr = tab.id !== 'manual' ? addressById.get(tab.id) : undefined}
					{#if savedAddr}
						<ShippingAddressCard address={savedAddr} />
					{:else}
						<ShippingAddressForm
							{shipping}
							{mobile}
							onUpdateField={onUpdateShipping}
							{onSearchAddress}
						>
							{#snippet footer()}
								<label class="save-addr-check">
									<AnimatedCheckbox
										checked={saveAsNewAddress}
										ariaLabel="이 배송지를 주소록에 저장"
										onChange={onToggleSaveAddress}
									/>
									<span>이 배송지를 주소록에 저장</span>
								</label>
							{/snippet}
						</ShippingAddressForm>
					{/if}
				{/snippet}
			</SmoothTab>

			{#if validationError}
				<p class="validation-error" role="alert">{validationError}</p>
			{/if}
		</section>

		<section class="checkout-section" aria-label="주문 상품">
			<div class="section-head-row">
				<h2 class="section-heading">주문 상품</h2>
				<span class="section-meta">{items.length}종 · {totalQty}개</span>
			</div>

			<ul class="order-items">
				{#each items as item (item.optionId)}
					<li class="order-item">
						<div class="order-thumb">
							{#if item.thumbnailUrl}
								<img src={item.thumbnailUrl} alt={item.productName} crossorigin="anonymous" loading="lazy" />
							{/if}
						</div>
						<div class="order-info">
							<p class="order-name">{item.productName}</p>
							<p class="order-opt">{item.optionName} · {item.qty}개</p>
						</div>
						<div class="order-price">
							<SlidingPrice value={item.price * item.qty} />
						</div>
					</li>
				{/each}
			</ul>
		</section>

		<section class="checkout-section" aria-label="결제 수단">
			<h2 class="section-heading">결제 수단</h2>

			{#if widgetLoading && !widgetError}
				<div class="widget-skeleton" role="status" aria-busy="true" aria-label="결제 수단 불러오는 중">
					<div class="wsk-head skeleton-shimmer"></div>
					<div class="wsk-grid">
						{#each [0, 1, 2, 3, 4, 5] as idx (idx)}
							<div
								class="wsk-tile skeleton-shimmer"
								style:--skeleton-delay="{idx * 55}ms"
							></div>
						{/each}
					</div>
					<div class="wsk-divider"></div>
					<div class="wsk-agree-row">
						<div class="wsk-check skeleton-shimmer"></div>
						<div class="wsk-agree-lines">
							<div class="wsk-line is-long skeleton-shimmer"></div>
							<div class="wsk-line is-short skeleton-shimmer"></div>
						</div>
					</div>
				</div>
			{/if}

			{#if widgetError}
				<div class="widget-notice" role="alert">
					<p>{widgetError}</p>
				</div>
			{/if}

			<div
				class="toss-widget-box"
				class:is-hidden={Boolean(widgetError)}
				class:is-mounting={widgetLoading && !widgetError}
			>
				<div id={paymentMethodsId}></div>
				<div id={agreementId}></div>
			</div>
		</section>
	</div>
{/if}

<style>
	.checkout-state-box {
		min-height: 280px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.checkout-state-text {
		margin: 0;
		color: var(--muted);
		font-size: 0.94rem;
	}

	.checkout-main-col {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.checkout-section {
		padding-top: 1.5rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.checkout-section:first-child {
		padding-top: 0;
		border-top: none;
	}

	.section-head-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.section-heading {
		margin: 0;
		font-size: 1.05rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.section-meta {
		font-size: 0.84rem;
		color: var(--muted);
	}

	.save-addr-check {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.84rem;
		color: var(--muted);
		cursor: pointer;
	}

	.validation-error {
		margin: 0;
		font-size: 0.84rem;
		color: var(--toast-error-wave, var(--white-2));
	}

	.order-items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.order-item {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem;
		border-radius: 14px;
		background: var(--surface-dim);
	}

	.order-thumb {
		width: 56px;
		height: 56px;
		border-radius: 10px;
		overflow: hidden;
		background: var(--surface-2);
		flex-shrink: 0;
	}

	.order-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.order-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.order-name {
		margin: 0;
		font-size: 0.92rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.order-opt {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.order-price {
		flex-shrink: 0;
	}

	.widget-skeleton {
		padding: 1.25rem;
		border-radius: 16px;
		background: var(--surface-dim);
		border: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.wsk-head {
		width: 112px;
		height: 18px;
		border-radius: 6px;
	}

	.wsk-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.wsk-tile {
		height: 48px;
		border-radius: 12px;
	}

	.wsk-divider {
		height: 1px;
		background: color-mix(in srgb, var(--white) 8%, transparent);
		margin: 0.15rem 0;
	}

	.wsk-agree-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.wsk-check {
		width: 20px;
		height: 20px;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.wsk-agree-lines {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.wsk-line {
		height: 13px;
		border-radius: 6px;
	}

	.wsk-line.is-long {
		width: 68%;
	}

	.wsk-line.is-short {
		width: 42%;
	}

	.widget-notice {
		padding: 1.1rem 1.25rem;
		border-radius: 14px;
		background: var(--surface-dim);
		color: var(--muted);
		font-size: 0.88rem;
	}

	.widget-notice p {
		margin: 0;
	}

	.toss-widget-box {
		border-radius: 16px;
		overflow: hidden;
		background: var(--white);
	}

	.toss-widget-box.is-hidden {
		display: none;
	}

	.toss-widget-box.is-mounting {
		height: 0;
		opacity: 0;
		pointer-events: none;
	}

	@container pay-flow (max-width: 540px) {
		.wsk-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
