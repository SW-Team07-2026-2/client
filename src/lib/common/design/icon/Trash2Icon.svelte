<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type Trash2IconAnimation = 'default';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 */
		animation?: Trash2IconAnimation;
		/** 외부 호버/활성 상태 제어 */
		hovered?: boolean;
		/** 마우스 호버 시 애니메이션 자동 재생 여부 */
		animateOnHover?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 18,
		strokeWidth = 2,
		animation = 'default',
		hovered = false,
		animateOnHover = false,
		class: klass = ''
	}: Props = $props();

	let selfHovered = $state(false);
	const isActive = $derived(
		!prefersReducedMotion() && animation === 'default' && (hovered || (animateOnHover && selfHovered))
	);
</script>

<!-- 휴지통 아이콘 (@animate-ui Trash2 뚜껑 열림 + 본체 하강 모션 보존) -->
<span
	class="trash2-icon-wrap {klass}"
	aria-hidden="true"
	onpointerenter={() => (selfHovered = true)}
	onpointerleave={() => (selfHovered = false)}
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width={strokeWidth}
		stroke-linecap="round"
		stroke-linejoin="round"
		class="trash2-icon-svg"
	>
		<g class="trash2-lid" class:is-active={isActive}>
			<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
			<path d="M3 6h18" />
		</g>
		<path
			class="trash2-body"
			class:is-active={isActive}
			d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
		/>
		<line class="trash2-line" class:is-active={isActive} x1="10" x2="10" y1="11" y2="17" />
		<line class="trash2-line" class:is-active={isActive} x1="14" x2="14" y1="11" y2="17" />
	</svg>
</span>

<style>
	.trash2-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.trash2-icon-svg {
		display: block;
		overflow: visible;
	}

	.trash2-lid {
		transform: translateY(0);
		transition: transform 0.3s ease-in-out;
	}

	.trash2-lid.is-active {
		transform: translateY(-1.2px);
	}

	.trash2-body {
		d: path('M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6');
		transform: translateY(0);
		transition:
			transform 0.3s ease-in-out,
			d 0.3s ease-in-out;
	}

	.trash2-body.is-active {
		d: path('M19 8v12c0 1-1 2-2 2H7c-1 0-2-1-2-2V8');
		transform: translateY(1px);
	}

	.trash2-line {
		transform: translateY(0);
		transition: transform 0.3s ease-in-out;
	}

	.trash2-line.is-active {
		transform: translateY(1px);
	}

	@media (prefers-reduced-motion: reduce) {
		.trash2-lid,
		.trash2-body,
		.trash2-line {
			transition: none;
		}
	}
</style>
