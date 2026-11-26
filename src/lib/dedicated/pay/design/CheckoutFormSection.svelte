<script lang="ts">
	import AnimatedCheckbox from '#lib/common/design/AnimatedCheckbox.svelte';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import type {
		CheckoutItemSnapshot,
		ShippingAddress,
		ShippingFormInput
	} from '../logic/types';

	interface Props {
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

	let detailInputEl = $state<HTMLInputElement | undefined>(undefined);

	async function handleSearchAddress() {
		const picked = await onSearchAddress();
		if (picked) {
			detailInputEl?.focus();
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

			{#if addresses.length > 0}
				<div class="address-chips" role="radiogroup" aria-label="저장된 배송지">
					{#each addresses as addr (addr.id)}
						<button
							type="button"
							class="addr-chip"
							class:is-selected={selectedAddressId === addr.id}
							onclick={() => onSelectAddress(addr.id)}
						>
							<span>{addr.label || addr.recipientName}</span>
							{#if addr.isDefault}
								<span class="chip-badge">기본</span>
							{/if}
						</button>
					{/each}
					<button
						type="button"
						class="addr-chip"
						class:is-selected={selectedAddressId === 'manual'}
						onclick={() => onSelectAddress('manual')}
					>
						직접 입력
					</button>
				</div>
			{/if}

			<div class="shipping-form">
				<div class="form-row-2">
					<label class="field-group">
						<span class="field-label">수령인</span>
						<input
							type="text"
							class="field-input"
							placeholder="이름 입력"
							value={shipping.recipientName}
							oninput={(e) => onUpdateShipping('recipientName', e.currentTarget.value)}
						/>
					</label>

					<label class="field-group">
						<span class="field-label">연락처</span>
						<input
							type="tel"
							class="field-input"
							placeholder="010-0000-0000"
							value={shipping.phone}
							oninput={(e) => onUpdateShipping('phone', e.currentTarget.value)}
						/>
					</label>
				</div>

				<div class="form-row-zone">
					<label class="field-group">
						<span class="field-label">우편번호 (5자리)</span>
						<input
							type="text"
							inputmode="numeric"
							maxlength="5"
							class="field-input"
							placeholder="06236"
							value={shipping.zonecode}
							onclick={() => {
								if (!shipping.zonecode.trim()) void handleSearchAddress();
							}}
							oninput={(e) => onUpdateShipping('zonecode', e.currentTarget.value)}
						/>
					</label>

					<div class="field-group is-search-btn">
						<span class="field-label" aria-hidden="true">&nbsp;</span>
						<button type="button" class="addr-search-btn" onclick={handleSearchAddress}>
							<svg
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
								<circle cx="11" cy="11" r="8" />
								<path d="m21 21-4.3-4.3" />
							</svg>
							<span>주소 검색</span>
						</button>
					</div>
				</div>

				<label class="field-group">
					<span class="field-label">기본 주소</span>
					<input
						type="text"
						class="field-input"
						placeholder="주소 검색을 눌러 도로명 주소를 입력해 주세요"
						value={shipping.address}
						onclick={() => {
							if (!shipping.address.trim()) void handleSearchAddress();
						}}
						oninput={(e) => onUpdateShipping('address', e.currentTarget.value)}
					/>
				</label>

				<label class="field-group">
					<span class="field-label">상세 주소 (선택)</span>
					<input
						bind:this={detailInputEl}
						type="text"
						class="field-input"
						placeholder="동 · 호수 등 상세 주소"
						value={shipping.addressDetail}
						oninput={(e) => onUpdateShipping('addressDetail', e.currentTarget.value)}
					/>
				</label>

				{#if selectedAddressId === 'manual'}
					<label class="save-addr-check">
						<AnimatedCheckbox
							checked={saveAsNewAddress}
							ariaLabel="이 배송지를 주소록에 저장"
							onChange={onToggleSaveAddress}
						/>
						<span>이 배송지를 주소록에 저장</span>
					</label>
				{/if}

				{#if validationError}
					<p class="validation-error" role="alert">{validationError}</p>
				{/if}
			</div>
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

			{#if widgetLoading}
				<div class="widget-status">
					<LoadingSpinner size={20} />
					<span>결제 위젯을 불러오는 중입니다...</span>
				</div>
			{/if}

			{#if widgetError}
				<div class="widget-notice" role="alert">
					<p>{widgetError}</p>
				</div>
			{/if}

			<div class="toss-widget-box" class:is-hidden={Boolean(widgetError)}>
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

	.address-chips {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.addr-chip {
		height: 36px;
		padding: 0 0.85rem;
		border: none;
		border-radius: 999px;
		background: var(--surface);
		color: var(--muted);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			color 0.16s ease;
	}

	.addr-chip.is-selected {
		background: var(--white-2);
		color: var(--bg);
	}

	.chip-badge {
		font-size: 0.7rem;
		opacity: 0.8;
	}

	.shipping-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.form-row-2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.form-row-zone {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: end;
	}

	.field-group.is-search-btn {
		flex-shrink: 0;
	}

	.addr-search-btn {
		height: 46px;
		padding: 0 1.05rem;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface);
		color: var(--white-2);
		font: inherit;
		font-size: 0.88rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		white-space: nowrap;
		cursor: pointer;
		box-sizing: border-box;
		transition:
			background-color 0.16s ease,
			border-color 0.16s ease,
			color 0.16s ease,
			transform 0.14s ease;
	}

	.addr-search-btn:hover {
		background: var(--surface-2);
		border-color: var(--line-wave);
		color: var(--white);
	}

	.addr-search-btn:active {
		background: var(--surface-3);
		transform: scale(0.985);
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}

	.field-label {
		font-size: 0.78rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.field-input {
		height: 46px;
		padding: 0 0.9rem;
		border: none;
		border-radius: 12px;
		background: var(--surface);
		color: var(--white);
		font: inherit;
		font-size: 0.92rem;
		box-sizing: border-box;
		outline: none;
		transition: background-color 0.15s ease;
	}

	.field-input:focus {
		background: var(--surface-2);
	}

	.field-input::placeholder {
		color: var(--muted);
		opacity: 0.75;
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
		background: var(--surface);
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

	.widget-status {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 1.25rem;
		border-radius: 14px;
		background: var(--surface);
		color: var(--muted);
		font-size: 0.88rem;
	}

	.widget-notice {
		padding: 1.1rem 1.25rem;
		border-radius: 14px;
		background: var(--surface);
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

	@container pay-flow (max-width: 540px) {
		.form-row-2,
		.form-row-zone {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
