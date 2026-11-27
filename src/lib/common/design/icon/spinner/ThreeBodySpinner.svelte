<script lang="ts">
	interface Props {
		/** 로더 전체 크기 (px) */
		size?: number;
		/** 기본 애니메이션 주기 (초) */
		speed?: number;
		/** 점 색상 (CSS 색상 또는 테마 변수) */
		color?: string;
		/** 스크린 리더용 상태 안내 레이블 */
		label?: string;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 20,
		speed = 0.8,
		color = 'var(--white)',
		label = '답변 생성 중',
		class: className = ''
	}: Props = $props();
</script>

<!-- 3-바디 궤도 회전 로딩 스피너 (AI 챗봇 답변 생성 중 등, 순수 렌더링) -->
<div
	class="three-body {className}"
	role="status"
	aria-label={label}
	style:--uib-size="{size}px"
	style:--uib-speed="{speed}s"
	style:--uib-color={color}
>
	<div class="three-body__dot"></div>
	<div class="three-body__dot"></div>
	<div class="three-body__dot"></div>
</div>

<style>
	.three-body {
		--uib-size: 20px;
		--uib-speed: 0.8s;
		--uib-color: var(--white);
		position: relative;
		display: inline-block;
		flex-shrink: 0;
		height: var(--uib-size);
		width: var(--uib-size);
		animation: three-body-spin calc(var(--uib-speed) * 2.5) infinite linear;
	}

	.three-body__dot {
		position: absolute;
		height: 100%;
		width: 30%;
	}

	.three-body__dot::after {
		content: '';
		position: absolute;
		height: 0%;
		width: 100%;
		padding-bottom: 100%;
		background-color: var(--uib-color);
		border-radius: 50%;
	}

	.three-body__dot:nth-child(1) {
		bottom: 5%;
		left: 0;
		transform: rotate(60deg);
		transform-origin: 50% 85%;
	}

	.three-body__dot:nth-child(1)::after {
		bottom: 0;
		left: 0;
		animation: three-body-wobble1 var(--uib-speed) infinite ease-in-out;
		animation-delay: calc(var(--uib-speed) * -0.3);
	}

	.three-body__dot:nth-child(2) {
		bottom: 5%;
		right: 0;
		transform: rotate(-60deg);
		transform-origin: 50% 85%;
	}

	.three-body__dot:nth-child(2)::after {
		bottom: 0;
		left: 0;
		animation: three-body-wobble1 var(--uib-speed) infinite calc(var(--uib-speed) * -0.15)
			ease-in-out;
	}

	.three-body__dot:nth-child(3) {
		bottom: -5%;
		left: 0;
		transform: translateX(116.666%);
	}

	.three-body__dot:nth-child(3)::after {
		top: 0;
		left: 0;
		animation: three-body-wobble2 var(--uib-speed) infinite ease-in-out;
	}

	@keyframes three-body-spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes three-body-wobble1 {
		0%,
		100% {
			transform: translateY(0%) scale(1);
			opacity: 1;
		}
		50% {
			transform: translateY(-66%) scale(0.65);
			opacity: 0.8;
		}
	}

	@keyframes three-body-wobble2 {
		0%,
		100% {
			transform: translateY(0%) scale(1);
			opacity: 1;
		}
		50% {
			transform: translateY(66%) scale(0.65);
			opacity: 0.8;
		}
	}
</style>
