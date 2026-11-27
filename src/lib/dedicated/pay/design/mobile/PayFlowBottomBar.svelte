<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { createPrimaryCtaSetting } from '#lib/common/design/fluid/ctaPreset';
	import SlidingNumber from '#lib/common/design/SlidingNumber.svelte';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';

	interface Props {
		step: 'cart' | 'checkout';
		showSkeleton: boolean;
		itemQty: number;
		totalPrice: number;
		ctaLabel: string;
		canCta: boolean;
		onPrimaryCta: () => void;
	}

	let { step, showSkeleton, itemQty, totalPrice, ctaLabel, canCta, onPrimaryCta }: Props = $props();

	let ctaBtnWidth = $state(200);
	const ctaSetting = $derived(createPrimaryCtaSetting(ctaBtnWidth, !canCta));
</script>

<!-- 모바일 하단 고정 바: 장바구니 <-> 결제하기 전환 중 그대로 고정 유지 -->
<div class="mobile-bottom-cta">
	{#if showSkeleton}
		<div class="mobile-cta-price" aria-hidden="true">
			<span class="skel-bar skeleton-shimmer" style="width: 44px; height: 12px;"></span>
			<span class="skel-bar skeleton-shimmer" style="width: 96px; height: 22px;"></span>
		</div>
		<div class="mobile-cta-btn-wrap" aria-hidden="true">
			<span class="skel-cta skeleton-shimmer"></span>
		</div>
	{:else}
		<div class="mobile-cta-price">
			<span class="mobile-cta-meta">
				{#if step === 'cart'}
					총 <SlidingNumber
						value={itemQty}
						thousandSeparator=""
						suffix="개"
						inheritSuffixStyle
					/>
				{:else}
					총 결제 금액
				{/if}
			</span>
			<SlidingPrice value={totalPrice} />
		</div>
		<div class="mobile-cta-btn-wrap" bind:clientWidth={ctaBtnWidth}>
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

<style>
	.mobile-bottom-cta {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		padding: 0.75rem var(--content-padding-x-mobile)
			calc(0.85rem + env(safe-area-inset-bottom, 0px));
		background: var(--glass-bg);
		-webkit-backdrop-filter: var(--glass-filter);
		backdrop-filter: var(--glass-filter);
		border-top: var(--thin-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.mobile-cta-price {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		flex-shrink: 0;
	}

	.mobile-cta-meta {
		font-size: 0.74rem;
		color: var(--muted);
		font-weight: var(--fw-medium);
	}

	.mobile-cta-btn-wrap {
		flex: 1;
		max-width: 220px;
	}

	.mobile-cta-btn-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.mobile-cta-btn-wrap :global(.fd-btn.pay-cta-fd-btn) {
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
</style>
