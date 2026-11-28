<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { createPrimaryCtaSetting } from '#lib/common/design/fluid/ctaPreset';
	import SlidingNumber from '#lib/common/design/SlidingNumber.svelte';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';

	interface Props {
		showSkeleton: boolean;
		heading: string;
		rowLabel: string;
		totalLabel: string;
		itemKinds: number;
		itemQty: number;
		totalPrice: number;
		ctaLabel: string;
		canCta: boolean;
		onPrimaryCta: () => void;
	}

	let {
		showSkeleton,
		heading,
		rowLabel,
		totalLabel,
		itemKinds,
		itemQty,
		totalPrice,
		ctaLabel,
		canCta,
		onPrimaryCta
	}: Props = $props();

	let ctaBtnWidth = $state(240);
	const ctaSetting = $derived(createPrimaryCtaSetting(ctaBtnWidth, !canCta));
</script>

<!-- PC 우측 Sticky 요약 카드: 장바구니 <-> 결제하기 전환 중 그대로 고정 유지 -->
<aside class="pay-summary-col" aria-label={heading}>
	<div class="summary-card">
		{#if showSkeleton}
			<span class="skel-bar skeleton-shimmer" style="width: 84px; height: 20px;"></span>
			<div class="summary-rows">
				<div class="summary-row">
					<span class="skel-bar skeleton-shimmer" style="width: 64px; height: 15px;"></span>
					<span class="skel-bar skeleton-shimmer" style="width: 72px; height: 15px;"></span>
				</div>
				<div class="summary-row">
					<span class="skel-bar skeleton-shimmer" style="width: 48px; height: 15px;"></span>
					<span class="skel-bar skeleton-shimmer" style="width: 36px; height: 15px;"></span>
				</div>
			</div>
			<div class="summary-total">
				<span class="skel-bar skeleton-shimmer" style="width: 96px; height: 16px;"></span>
				<span class="skel-bar skeleton-shimmer" style="width: 104px; height: 24px;"></span>
			</div>
			<span class="skel-cta skeleton-shimmer"></span>
		{:else}
			<div class="summary-heading-stage">
				{#key heading}
					<h2
						class="summary-title"
						in:fly={{ y: 8, duration: 220, easing: cubicOut }}
						out:fly={{ y: -8, duration: 150, easing: cubicOut }}
					>
						{heading}
					</h2>
				{/key}
			</div>

			<dl class="summary-rows">
				<div class="summary-row">
					<dt>{rowLabel}</dt>
					<dd class="summary-count-dd">
						<SlidingNumber
							value={itemKinds}
							thousandSeparator=""
							suffix="종"
							inheritSuffixStyle
						/>
						<span>·</span>
						<SlidingNumber
							value={itemQty}
							thousandSeparator=""
							suffix="개"
							inheritSuffixStyle
						/>
					</dd>
				</div>
				<div class="summary-row">
					<dt>배송비</dt>
					<dd>무료</dd>
				</div>
			</dl>

			<div class="summary-total">
				<span class="summary-total-label">{totalLabel}</span>
				<SlidingPrice value={totalPrice} />
			</div>

			<div class="summary-cta-wrap" bind:clientWidth={ctaBtnWidth}>
				<FdButton
					setting={ctaSetting}
					fullWidth
					disabled={!canCta}
					class="pay-cta-fd-btn"
					onclick={onPrimaryCta}
				>
					<span class="btn-label-stage">
						{#key ctaLabel}
							<span
								class="btn-label-slide"
								in:fly={{ y: 12, duration: 220, easing: cubicOut }}
								out:fly={{ y: -12, duration: 150, easing: cubicOut }}
							>
								{ctaLabel}
							</span>
						{/key}
					</span>
				</FdButton>
			</div>
		{/if}
	</div>
</aside>

<style>
	.pay-summary-col {
		position: sticky;
		top: calc(var(--pc-header-height, 70px) + 1.5rem);
	}

	.summary-card {
		padding: 1.5rem;
		border-radius: 20px;
		background: var(--surface-dim);
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.summary-heading-stage {
		display: grid;
		overflow: hidden;
	}

	.summary-title {
		grid-area: 1 / 1;
		margin: 0;
		font-size: 1.05rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.summary-rows {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding-bottom: 1rem;
		border-bottom: var(--thin-border);
	}

	.summary-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.88rem;
	}

	.summary-row dt {
		color: var(--muted);
	}

	.summary-row dd {
		margin: 0;
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.summary-count-dd {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
	}

	.summary-total {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.summary-total-label {
		font-size: 0.9rem;
		font-weight: var(--fw-semibold);
		color: var(--white-2);
	}

	.summary-cta-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.summary-cta-wrap :global(.fd-btn.pay-cta-fd-btn) {
		width: 100%;
		height: 48px;
		padding: 0 1.25rem;
		font-size: 0.95rem;
		font-weight: var(--fw-bold);
	}

	.btn-label-stage {
		position: relative;
		display: inline-grid;
		align-items: center;
		justify-items: center;
		overflow: hidden;
		line-height: 1.3;
	}

	.btn-label-slide {
		grid-area: 1 / 1;
		white-space: nowrap;
	}

	.skel-bar {
		display: block;
		border-radius: 6px;
	}

	.skel-cta {
		display: block;
		width: 100%;
		height: 48px;
		border-radius: 14px;
	}

	@container pay-flow (max-width: 820px) {
		.pay-summary-col {
			position: static;
		}
	}
</style>
