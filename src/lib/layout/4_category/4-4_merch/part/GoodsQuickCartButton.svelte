<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import CheckIcon from '#lib/common/design/icon/CheckIcon.svelte';
	import ShoppingBagIcon from '#lib/common/design/icon/ShoppingBagIcon.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';

	interface Props {
		/** 버튼 노출 여부 (카드 호버/포커스/로딩/완료 시 true) */
		visible: boolean;
		/** 장바구니 요청 진행 중 여부 */
		loading?: boolean;
		/** 장바구니 담기 완료 체크 표시 여부 (2초 유지) */
		completed?: boolean;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 접근성 라벨 */
		ariaLabel?: string;
		/** 클릭 콜백 */
		onclick?: () => void;
	}

	let {
		visible,
		loading = false,
		completed = false,
		disabled = false,
		ariaLabel = '장바구니에 바로 담기',
		onclick
	}: Props = $props();

	let bagAnimating = $state(false);
	let bagTimer: ReturnType<typeof setTimeout> | null = null;

	const isBlocked = $derived(disabled || loading || completed);

	// 어두운 물결 + 로딩 시 크고 빠른 회전 물결로 전환되는 원형 FdButton 설정
	const fdSetting = $derived.by(() => {
		const base = {
			radius: 999,
			inset: 6,
			color: 'var(--white-2)',
			hoverColor: 'var(--white)',
			pressColor: 'var(--white-3)',
			textColor: 'var(--bg)',
			waveColor: 'var(--muted)',
			hoverWaveColor: 'var(--muted)',
			borderWidth: 0,
			layers: 2,
			bulge: loading ? 0 : 4,
			reach: loading ? 0 : 22,
			clickReactive: !loading && !completed
		};

		if (loading) {
			return new FluidSetting({
				...base,
				layerGap: 5.5,
				waveAmp: 4.5,
				waveLength: 32,
				spin: 4.2,
				pauseWhenIdle: false
			});
		}

		return new FluidSetting({
			...base,
			layerGap: 2.6,
			waveAmp: 2.1,
			waveLength: 42,
			spin: 1.2,
			pauseWhenIdle: !visible
		});
	});

	function triggerBagAnimation() {
		if (loading || completed || disabled) return;
		if (bagTimer) clearTimeout(bagTimer);
		bagAnimating = false;
		requestAnimationFrame(() => {
			bagAnimating = true;
			bagTimer = setTimeout(() => {
				bagAnimating = false;
				bagTimer = null;
			}, 620);
		});
	}

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		if (isBlocked) return;
		onclick?.();
	}

	onDestroy(() => {
		if (bagTimer) clearTimeout(bagTimer);
	});
</script>

<!-- PC 굿즈 카드 하단 중앙 원형 FdButton 빠른 장바구니 버튼 (호버 바운스 · 로딩 축소/고속 회전 물결 · 완료 체크 2초 유지, 순수 렌더링) -->
<div
	class="quick-cart-stage"
	class:is-visible={visible}
	class:is-loading={loading}
	class:is-completed={completed}
	role="presentation"
	onpointerenter={triggerBagAnimation}
>
	<FdButton
		class="goods-quick-cart-fd-btn"
		setting={fdSetting}
		tabindex={visible ? 0 : -1}
		aria-label={completed ? '장바구니에 담김' : loading ? '장바구니에 담는 중' : ariaLabel}
		aria-busy={loading || undefined}
		title={completed ? '장바구니에 담김' : ariaLabel}
		onclick={handleClick}
	>
		<span class="icon-stage">
			{#if completed}
				<span
					class="icon-slot"
					in:scale={{ start: 0.72, duration: 220 }}
					out:fade={{ duration: 180 }}
				>
					<CheckIcon size={18} animating={true} />
				</span>
			{:else if !loading}
				<span
					class="icon-slot"
					in:scale={{ start: 0.8, duration: 220 }}
					out:fade={{ duration: 140 }}
				>
					<ShoppingBagIcon size={17} animating={bagAnimating} />
				</span>
			{/if}
		</span>
	</FdButton>
</div>

<style>
	.quick-cart-stage {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		pointer-events: none;
		transform: translate3d(0, 14px, 0) scale(0.84);
		will-change: transform, opacity;
		transition:
			transform 0.36s cubic-bezier(0.22, 1.15, 0.36, 1),
			opacity 0.22s ease;
	}

	.quick-cart-stage.is-visible {
		opacity: 1;
		pointer-events: auto;
		transform: translate3d(0, 0, 0) scale(1);
	}

	/* 로딩 중에는 버튼을 작게 축소해 빠르고 큰 회전 물결이 로딩 상태를 표현하도록 연출 */
	.quick-cart-stage.is-visible.is-loading {
		transform: translate3d(0, 0, 0) scale(0.7);
	}

	.quick-cart-stage :global(.fd-wrap) {
		margin: -6px;
	}

	.quick-cart-stage :global(.fd-btn.goods-quick-cart-fd-btn) {
		width: 40px;
		height: 40px;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.quick-cart-stage.is-loading :global(.fd-btn.goods-quick-cart-fd-btn),
	.quick-cart-stage.is-completed :global(.fd-btn.goods-quick-cart-fd-btn) {
		cursor: default;
	}

	.icon-stage {
		position: relative;
		width: 18px;
		height: 18px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.icon-slot {
		position: absolute;
		inset: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	@media (prefers-reduced-motion: reduce) {
		.quick-cart-stage {
			transition: none;
		}
	}
</style>
