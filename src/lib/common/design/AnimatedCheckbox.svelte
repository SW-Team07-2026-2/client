<script lang="ts">
	interface Props {
		/** 체크 여부 */
		checked?: boolean;
		/** 부분 선택(indeterminate) 여부 */
		indeterminate?: boolean;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 체크 표시 애니메이션 스타일 ('draw': 선 그리기, 'pop': 탄성 팝) */
		checkAnimation?: 'draw' | 'pop';
		/** 상자 크기(px, 기본 18) */
		size?: number;
		/** HTML id */
		id?: string;
		/** 접근성 라벨 */
		ariaLabel?: string;
		/** 값 변경 콜백 */
		onChange?: (nextChecked: boolean) => void;
	}

	let {
		checked = false,
		indeterminate = false,
		disabled = false,
		checkAnimation = 'draw',
		size = 18,
		id,
		ariaLabel,
		onChange
	}: Props = $props();

	const isActive = $derived(checked || indeterminate);

	function handleClick() {
		if (disabled) return;
		onChange?.(!checked);
	}
</script>

<!-- 공용 애니메이션 체크박스 상자 (스케일·페이드 배경 채움 + 체크 드로우/팝 애니메이션, 순수 렌더링) -->
<button
	{id}
	type="button"
	role="checkbox"
	class="animated-checkbox"
	class:is-checked={isActive}
	class:is-indeterminate={indeterminate}
	class:anim-draw={checkAnimation === 'draw'}
	class:anim-pop={checkAnimation === 'pop'}
	style:--cb-size="{size}px"
	aria-checked={indeterminate ? 'mixed' : checked}
	aria-label={ariaLabel}
	{disabled}
	onclick={handleClick}
>
	<span class="cb-indicator" aria-hidden="true">
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{#if indeterminate}
				<path class="cb-stroke" d="M6 12h12" pathLength="1" />
			{:else}
				<path class="cb-stroke" d="M5 12.5 9.5 17 19 7" pathLength="1" />
			{/if}
		</svg>
	</span>
</button>

<style>
	.animated-checkbox {
		position: relative;
		width: var(--cb-size, 18px);
		height: var(--cb-size, 18px);
		padding: 0;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 5px;
		border: 1px solid color-mix(in srgb, var(--white) 24%, transparent);
		background: color-mix(in srgb, var(--surface-2) 55%, transparent);
		color: var(--bg);
		cursor: pointer;
		outline: none;
		transition:
			border-color 0.25s ease,
			opacity 0.2s ease;
		-webkit-tap-highlight-color: transparent;
	}

	/* 터치/클릭 편의용 확장 히트 영역 */
	.animated-checkbox::after {
		content: '';
		position: absolute;
		inset: -6px -8px;
	}

	/* 체크 시 중앙에서 부드럽게 차오르는 배경 레이어 (scale 0.7 -> 1, opacity 0 -> 1) */
	.animated-checkbox::before {
		content: '';
		position: absolute;
		inset: -1px;
		border-radius: inherit;
		background: var(--white-2);
		opacity: 0;
		transform: scale(0.7);
		transition:
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.24s ease;
	}

	.animated-checkbox:hover:not(:disabled):not(.is-checked) {
		border-color: color-mix(in srgb, var(--white) 46%, transparent);
	}

	.animated-checkbox.is-checked {
		border-color: var(--white-2);
	}

	.animated-checkbox.is-checked::before {
		opacity: 1;
		transform: scale(1);
	}

	.animated-checkbox:focus-visible {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--white) 24%, transparent);
	}

	.animated-checkbox:disabled {
		cursor: not-allowed;
		opacity: 0.42;
	}

	.cb-indicator {
		position: relative;
		z-index: 1;
		width: 78%;
		height: 78%;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.cb-indicator svg {
		width: 100%;
		height: 100%;
		display: block;
		overflow: visible;
	}

	/* draw 애니메이션: 체크 선이 pathLength 0 -> 1로 그려짐 */
	.animated-checkbox.anim-draw .cb-stroke {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		opacity: 0;
		transition:
			stroke-dashoffset 0.24s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.14s ease;
	}

	.animated-checkbox.anim-draw.is-checked .cb-stroke {
		stroke-dashoffset: 0;
		opacity: 1;
		transition:
			stroke-dashoffset 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.05s,
			opacity 0.14s ease 0.03s;
	}

	/* pop 애니메이션: 체크 아이콘이 탄성 있게 확대 */
	.animated-checkbox.anim-pop .cb-indicator {
		opacity: 0;
		transform: scale(0.5);
		transition:
			transform 0.22s cubic-bezier(0.22, 1.25, 0.36, 1),
			opacity 0.16s ease;
	}

	.animated-checkbox.anim-pop.is-checked .cb-indicator {
		opacity: 1;
		transform: scale(1);
	}

	@media (prefers-reduced-motion: reduce) {
		.animated-checkbox::before {
			transform: scale(1);
			transition: opacity 0.12s ease;
		}

		.animated-checkbox.anim-draw .cb-stroke,
		.animated-checkbox.anim-draw.is-checked .cb-stroke,
		.animated-checkbox.anim-pop .cb-indicator,
		.animated-checkbox.anim-pop.is-checked .cb-indicator {
			transition: none;
		}
	}
</style>
