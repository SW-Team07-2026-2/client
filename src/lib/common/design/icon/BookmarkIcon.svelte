<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type BookmarkIconAnimation = 'default';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 */
		animation?: BookmarkIconAnimation;
		/** 외부 호버/활성 상태 트리거 (false -> true 전환 시 1회 재생) */
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

	let playKey = $state(0);

	/** 북마크 세로 바운스 모션 재생 (AlbumCollectionButton과 통일) */
	export function play() {
		if (prefersReducedMotion()) return;
		playKey += 1;
	}

	let prevHovered = false;
	$effect(() => {
		if (hovered && !prevHovered) {
			play();
		}
		prevHovered = hovered;
	});

	function handlePointerEnter() {
		if (animateOnHover) play();
	}

	function handlePointerDown() {
		if (animateOnClick) play();
	}
</script>

<!-- 소유 음반 북마크 아이콘 (AlbumCollectionButton과 동일한 북마크 실루엣 및 세로 바운스 모션) -->
<span
	class="bookmark-icon-wrap {klass}"
	aria-hidden="true"
	onpointerenter={handlePointerEnter}
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
			class="bookmark-icon-svg"
		>
			<g class="bookmark-group" class:is-animating={playKey > 0 && animation === 'default'}>
				<path
					d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"
				/>
			</g>
		</svg>
	{/key}
</span>

<style>
	.bookmark-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.bookmark-icon-svg {
		display: block;
		overflow: visible;
	}

	/* AlbumCollectionButton과 동일한 상단 기준(50% 0%) 세로 띠용 애니메이션 */
	.bookmark-group {
		transform-box: fill-box;
		transform-origin: 50% 0%;
		transform: scaleY(1);
	}

	.bookmark-group.is-animating {
		animation: bookmark-bounce 0.5s ease-in-out both;
	}

	@keyframes bookmark-bounce {
		0% {
			transform: scaleY(1);
		}
		33% {
			transform: scaleY(0.82);
		}
		72% {
			transform: scaleY(1.03);
		}
		100% {
			transform: scaleY(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bookmark-group.is-animating {
			animation: none;
		}
	}
</style>
