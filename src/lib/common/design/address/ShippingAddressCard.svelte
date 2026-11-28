<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ShippingAddress } from '#lib/dedicated/pay/logic/types';

	interface Props {
		/** 배송지 데이터 */
		address: ShippingAddress;
		/** 배송지 별칭(label) 표시 여부 */
		showLabel?: boolean;
		/** 기본 배송지 배지 표시 여부 */
		showDefaultBadge?: boolean;
		/** 강조/수정 중 상태 */
		highlighted?: boolean;
		/** 좌측 슬롯 (드래그/순서 변경 핸들 등) */
		leading?: Snippet;
		/** 우측 상단 액션 버튼 슬롯 (수정 · 삭제 등) */
		actions?: Snippet;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		address,
		showLabel = false,
		showDefaultBadge = false,
		highlighted = false,
		leading,
		actions,
		class: klass = ''
	}: Props = $props();
</script>

<!-- 공용 저장 배송지 카드 블럭 (결제 페이지 · 마이페이지 배송지 관리 공용, 순수 렌더링) -->
<div
	class="saved-addr-card {klass}"
	class:is-highlighted={highlighted}
	class:has-leading={Boolean(leading)}
>
	{#if leading}
		<div class="saved-addr-leading">
			{@render leading()}
		</div>
	{/if}

	<div class="saved-addr-body">
		<div class="saved-addr-head">
			<div class="saved-addr-top">
				{#if showDefaultBadge && address.isDefault}
					<span class="saved-addr-default-badge">기본</span>
				{/if}
				{#if showLabel && address.label}
					<span class="saved-addr-label" title={address.label}>{address.label}</span>
				{/if}
				<span class="saved-addr-recipient" title={address.recipientName}>{address.recipientName}</span>
				<span class="saved-addr-phone">{address.phone}</span>
			</div>

			{#if actions}
				<div class="saved-addr-actions">
					{@render actions()}
				</div>
			{/if}
		</div>

		<p class="saved-addr-line" title="[{address.zonecode}] {address.address}">
			<span class="saved-addr-zone">[{address.zonecode}]</span>
			<span>{address.address}</span>
		</p>

		{#if address.addressDetail}
			<p class="saved-addr-detail" title={address.addressDetail}>{address.addressDetail}</p>
		{/if}
	</div>
</div>

<style>
	.saved-addr-card {
		height: 112px;
		box-sizing: border-box;
		padding: 0.9rem 1.15rem;
		border-radius: 14px;
		background: var(--surface-dim);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		overflow: hidden;
		transition: background-color 0.16s ease;
	}

	.saved-addr-card.has-leading {
		padding-left: 0.75rem;
	}

	.saved-addr-card.is-highlighted {
		background: var(--surface-1);
	}

	.saved-addr-leading {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.saved-addr-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.saved-addr-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 30px;
	}

	.saved-addr-top {
		flex: 1;
		min-width: 0;
		color: var(--muted);
		line-height: 1.5;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.saved-addr-default-badge {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		margin-right: 0.45rem;
		padding: 0.12rem 0.48rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--white) 14%, transparent);
		color: var(--white);
		font-size: 0.7rem;
		font-weight: var(--fw-semibold);
		line-height: 1.3;
	}

	.saved-addr-label {
		display: inline;
		vertical-align: middle;
		margin-right: 0.45rem;
		font-size: 0.78rem;
		font-weight: var(--fw-semibold);
		color: var(--white-2);
		padding: 0.14rem 0.5rem;
		border-radius: 999px;
		background: var(--surface-1);
	}

	.saved-addr-recipient {
		display: inline;
		vertical-align: middle;
		margin-right: 0.45rem;
		font-size: 0.96rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.saved-addr-phone {
		display: inline;
		vertical-align: middle;
		font-size: 0.84rem;
		color: var(--muted);
	}

	.saved-addr-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	.saved-addr-line {
		margin: 0;
		font-size: 0.9rem;
		color: var(--fg);
		line-height: 1.45;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.saved-addr-zone {
		color: var(--muted);
		margin-right: 0.35rem;
	}

	.saved-addr-detail {
		margin: 0;
		font-size: 0.86rem;
		color: var(--muted);
		line-height: 1.4;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
