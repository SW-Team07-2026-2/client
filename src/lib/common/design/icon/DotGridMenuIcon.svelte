<script lang="ts">
	interface Props {
		/** 아이콘 전체 크기 (px, 기본값: 14) */
		size?: number;
		/** true면 중앙 단일 점이 2×2 메뉴 점 4개로 부드럽게 분리 */
		expanded?: boolean;
		/** 외부 클래스 */
		class?: string;
	}

	let { size = 14, expanded = false, class: className = '' }: Props = $props();
</script>

<!-- 단일 원형 점 ↔ 4개(2×2) 메뉴 아이콘으로 부드럽게 분리되는 모핑 아이콘 -->
<svg
	class="dot-grid-menu-icon {className}"
	class:is-expanded={expanded}
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="currentColor"
	aria-hidden="true"
>
	<circle class="dot dot-tl" cx="8" cy="8" r="2.6" />
	<circle class="dot dot-tr" cx="8" cy="8" r="2.6" />
	<circle class="dot dot-bl" cx="8" cy="8" r="2.6" />
	<circle class="dot dot-br" cx="8" cy="8" r="2.6" />
</svg>

<style>
	.dot-grid-menu-icon {
		display: block;
		flex-shrink: 0;
		overflow: visible;
		color: var(--white);
	}

	.dot {
		transform-box: view-box;
		transform-origin: 8px 8px;
		transform: translate3d(0, 0, 0) scale(1);
		transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
		will-change: transform;
	}

	.dot-grid-menu-icon.is-expanded .dot {
		transition: transform 0.44s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.dot-grid-menu-icon.is-expanded .dot-tl {
		transform: translate3d(-3.3px, -3.3px, 0) scale(0.84);
		transition-delay: 0ms;
	}

	.dot-grid-menu-icon.is-expanded .dot-tr {
		transform: translate3d(3.3px, -3.3px, 0) scale(0.84);
		transition-delay: 25ms;
	}

	.dot-grid-menu-icon.is-expanded .dot-bl {
		transform: translate3d(-3.3px, 3.3px, 0) scale(0.84);
		transition-delay: 45ms;
	}

	.dot-grid-menu-icon.is-expanded .dot-br {
		transform: translate3d(3.3px, 3.3px, 0) scale(0.84);
		transition-delay: 65ms;
	}

	@media (prefers-reduced-motion: reduce) {
		.dot,
		.dot-grid-menu-icon.is-expanded .dot {
			transition: none;
		}
	}
</style>
