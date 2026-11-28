<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type LogOutIconAnimation = 'default' | 'default-loop';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 ('default' | 'default-loop') */
		animation?: LogOutIconAnimation;
		/** 외부 호버/활성 상태 제어 */
		hovered?: boolean;
		/** 마우스 호버 시 애니메이션 자동 재생 여부 */
		animateOnHover?: boolean;
		/** 클릭 시 애니메이션 자동 재생 여부 */
		animateOnClick?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 18,
		strokeWidth = 2,
		animation = 'default',
		hovered = false,
		animateOnHover = false,
		animateOnClick = false,
		class: klass = ''
	}: Props = $props();

	let selfHovered = $state(false);
	let playKey = $state(0);

	const isActive = $derived(hovered || (animateOnHover && selfHovered));

	/** 루프 모션 수동 재생 */
	export function play() {
		if (prefersReducedMotion()) return;
		playKey += 1;
	}

	let prevHovered = false;
	$effect(() => {
		if (hovered && !prevHovered && animation === 'default-loop') {
			play();
		}
		prevHovered = hovered;
	});

	function handlePointerEnter() {
		selfHovered = true;
		if (animateOnHover && animation === 'default-loop') play();
	}

	function handlePointerLeave() {
		selfHovered = false;
	}

	function handlePointerDown() {
		if (animateOnClick) play();
	}
</script>

<!-- 로그아웃 아이콘 (@animate-ui LogOut default / default-loop 보존) -->
<span
	class="logout-icon-wrap {klass}"
	aria-hidden="true"
	onpointerenter={handlePointerEnter}
	onpointerleave={handlePointerLeave}
	onpointerdown={handlePointerDown}
>
	{#key playKey}
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
			class="logout-icon-svg"
		>
			<g
				class="logout-arrow-group"
				class:is-default-active={animation === 'default' && isActive}
				class:is-default-loop={playKey > 0 && animation === 'default-loop'}
			>
				<path d="m16 17 5-5-5-5" />
				<path d="M21 12H9" />
			</g>
			<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		</svg>
	{/key}
</span>

<style>
	.logout-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.logout-icon-svg {
		display: block;
		overflow: visible;
	}

	.logout-arrow-group {
		transform: translateX(0);
		transition: transform 0.3s ease-in-out;
	}

	.logout-arrow-group.is-default-active {
		transform: translateX(2px);
	}

	.logout-arrow-group.is-default-loop {
		animation: logout-arrow-loop 0.6s ease-in-out both;
	}

	@keyframes logout-arrow-loop {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(2px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.logout-arrow-group {
			transition: none;
			animation: none;
		}
	}
</style>
