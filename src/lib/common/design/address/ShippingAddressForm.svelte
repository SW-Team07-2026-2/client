<script lang="ts">
	import type { Snippet } from 'svelte';
	import LetterLimitInput from '../LetterLimitInput.svelte';
	import {
		SHIPPING_ADDRESS_DETAIL_MAX_LENGTH,
		SHIPPING_LABEL_MAX_LENGTH,
		SHIPPING_PHONE_MAX_LENGTH,
		SHIPPING_RECIPIENT_MAX_LENGTH
	} from '#lib/config/pay';
	import type { ShippingFormInput } from '#lib/dedicated/pay/logic/types';

	interface Props {
		/** 배송지 입력 폼 값 */
		shipping: ShippingFormInput;
		/** 배송지 별칭 값 (showLabelField === true일 때 사용) */
		label?: string;
		/** 배송지 별칭 입력 필드 표시 여부 */
		showLabelField?: boolean;
		/** 모바일 레이아웃 여부 */
		mobile?: boolean;
		/** 입력 비활성화 여부 */
		disabled?: boolean;
		/** 필드 값 변경 콜백 */
		onUpdateField: (field: keyof ShippingFormInput, value: string) => void;
		/** 배송지 별칭 변경 콜백 */
		onUpdateLabel?: (value: string) => void;
		/** 카카오 우편번호 검색 콜백 (선택 완료 시 true 반환 -> 상세주소 자동 포커스) */
		onSearchAddress: () => Promise<boolean>;
		/** 폼 하단 커스텀 슬롯 (체크박스 · 저장/취소 버튼 등) */
		footer?: Snippet;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		shipping,
		label = '',
		showLabelField = false,
		mobile = false,
		disabled = false,
		onUpdateField,
		onUpdateLabel,
		onSearchAddress,
		footer,
		class: klass = ''
	}: Props = $props();

	let detailInputEl = $state<HTMLTextAreaElement | HTMLInputElement | undefined>(undefined);

	async function handleSearchAddress() {
		if (disabled) return;
		const picked = await onSearchAddress();
		if (picked) {
			detailInputEl?.focus();
		}
	}
</script>

<!-- 공용 배송지 입력 폼 (결제 페이지 · 마이페이지 배송지 관리 공용, 순수 렌더링) -->
<div class="shipping-form {klass}" class:is-mobile={mobile}>
	{#if showLabelField}
		<label class="field-group">
			<span class="field-label">배송지명 (선택)</span>
			<LetterLimitInput
				mode="plain"
				maxLength={SHIPPING_LABEL_MAX_LENGTH}
				placeholder="예: 집, 회사"
				ariaLabel="배송지명"
				{disabled}
				value={label}
				onChangeValue={(next) => onUpdateLabel?.(next)}
			/>
		</label>
	{/if}

	<div class="form-row-2">
		<label class="field-group">
			<span class="field-label">수령인</span>
			<LetterLimitInput
				mode="plain"
				maxLength={SHIPPING_RECIPIENT_MAX_LENGTH}
				placeholder="이름 입력"
				ariaLabel="수령인"
				{disabled}
				value={shipping.recipientName}
				onChangeValue={(next) => onUpdateField('recipientName', next)}
			/>
		</label>

		<label class="field-group">
			<span class="field-label">연락처</span>
			<LetterLimitInput
				mode="plain"
				type="tel"
				inputmode="numeric"
				maxLength={SHIPPING_PHONE_MAX_LENGTH}
				placeholder="010-0000-0000"
				ariaLabel="연락처"
				{disabled}
				value={shipping.phone}
				onChangeValue={(next) => onUpdateField('phone', next)}
			/>
		</label>
	</div>

	<div class="addr-grid" class:is-mobile={mobile}>
		<label class="field-group addr-zone">
			<span class="field-label">{mobile ? '우편번호' : '우편번호 (5자리)'}</span>
			<input
				type="text"
				readonly
				{disabled}
				class="field-input is-readonly"
				placeholder={mobile ? '우편번호' : '주소 검색으로 입력'}
				value={shipping.zonecode}
				onclick={handleSearchAddress}
			/>
		</label>

		<div class="field-group addr-search">
			{#if !mobile}
				<span class="field-label" aria-hidden="true">&nbsp;</span>
			{/if}
			<button
				type="button"
				class="addr-search-btn"
				{disabled}
				onclick={handleSearchAddress}
			>
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

		<label class="field-group addr-base">
			<span class="field-label">기본 주소</span>
			<input
				type="text"
				readonly
				{disabled}
				class="field-input is-readonly"
				placeholder={mobile
					? '주소 검색으로 입력'
					: '주소 검색을 눌러 도로명 주소를 입력해 주세요'}
				value={shipping.address}
				onclick={handleSearchAddress}
			/>
		</label>
	</div>

	<label class="field-group">
		<span class="field-label">상세 주소 (선택)</span>
		<LetterLimitInput
			mode="plain"
			bind:inputEl={detailInputEl}
			maxLength={SHIPPING_ADDRESS_DETAIL_MAX_LENGTH}
			placeholder="동 · 호수 등 상세 주소"
			ariaLabel="상세 주소"
			{disabled}
			value={shipping.addressDetail}
			onChangeValue={(next) => onUpdateField('addressDetail', next)}
		/>
	</label>

	{#if footer}
		{@render footer()}
	{/if}
</div>

<style>
	.shipping-form {
		container-type: inline-size;
		container-name: shipping-form;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.form-row-2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.addr-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'zone search'
			'base base';
		gap: 0.85rem 0.65rem;
		align-items: end;
	}

	.addr-zone {
		grid-area: zone;
	}

	.addr-search {
		grid-area: search;
	}

	.addr-base {
		grid-area: base;
	}

	.addr-grid.is-mobile {
		grid-template-columns: minmax(5.5rem, 28%) minmax(0, 1fr);
		grid-template-areas:
			'zone base'
			'search search';
		gap: 0.75rem 0.6rem;
	}

	.addr-grid.is-mobile .addr-search-btn {
		width: 100%;
	}

	.addr-search-btn {
		height: 46px;
		padding: 0 1.05rem;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface-dim);
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

	.addr-search-btn:hover:not(:disabled) {
		background: var(--surface-1);
		border-color: var(--line-wave);
		color: var(--white);
	}

	.addr-search-btn:active:not(:disabled) {
		background: var(--surface-2);
		transform: scale(0.985);
	}

	.addr-search-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
		background: var(--surface-dim);
		color: var(--white);
		font: inherit;
		font-size: 0.92rem;
		box-sizing: border-box;
		outline: none;
		transition: background-color 0.15s ease;
	}

	.field-input.is-readonly {
		background: var(--surface-dim);
		color: var(--fg);
		cursor: pointer;
	}

	.field-input:focus {
		background: var(--surface-1);
	}

	.field-input::placeholder {
		color: var(--muted);
		opacity: 0.75;
	}

	.field-input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	@container shipping-form (max-width: 480px) {
		.form-row-2 {
			grid-template-columns: 1fr;
		}
	}
</style>
