<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import SlidingNumber from '#lib/common/design/SlidingNumber.svelte';

	interface Props {
		/** 표시할 정수 금액 (원) */
		value: number | null;
		/** 품절 여부 (true면 '품절' 텍스트로 슬라이드 전환) */
		soldOut?: boolean;
		/** 품절 시 표시 문구 */
		soldOutText?: string;
		/** 천 단위 구분자 */
		thousandSeparator?: string;
		/** 접미사 (예: '원') */
		suffix?: string;
	}

	let {
		value,
		soldOut = false,
		soldOutText = '품절',
		thousandSeparator = ',',
		suffix = '원'
	}: Props = $props();
</script>

<!-- 금액 전용 래퍼: 공용 SlidingNumber + 품절 상태 전환 (순수 렌더링) -->
<div class="sliding-price-stage" aria-live="polite">
	{#if soldOut}
		<span
			class="sliding-soldout"
			in:fly={{ y: 12, duration: 240, easing: cubicOut }}
			out:fly={{ y: -12, duration: 150, easing: cubicOut }}
		>
			{soldOutText}
		</span>
	{:else if value !== null && Number.isFinite(value)}
		<span
			class="sliding-price-value"
			in:fly={{ y: 12, duration: 240, easing: cubicOut }}
			out:fly={{ y: -12, duration: 150, easing: cubicOut }}
		>
			<SlidingNumber {value} {thousandSeparator} {suffix} />
		</span>
	{/if}
</div>

<style>
	.sliding-price-stage {
		position: relative;
		display: inline-grid;
		align-items: center;
		justify-items: end;
		min-height: 1.95rem;
		overflow: hidden;
	}

	.sliding-price-value,
	.sliding-soldout {
		grid-area: 1 / 1;
		display: inline-flex;
		align-items: baseline;
	}

	.sliding-price-value {
		font-size: 1.45rem;
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.02em;
		color: var(--white);
	}

	.sliding-soldout {
		font-size: 1.08rem;
		font-weight: var(--fw-bold);
		color: var(--muted);
		line-height: 1.15;
	}
</style>
