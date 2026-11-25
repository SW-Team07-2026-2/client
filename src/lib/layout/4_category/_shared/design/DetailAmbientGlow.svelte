<script lang="ts">
	interface Props {
		/** 배경을 은은하게 비출 색상 (이미지 평균색 등, 미지정 시 var(--white)) */
		color?: string;
		/** 상단 글로우 레이어 높이 (px, 기본 520) */
		height?: number;
		/** 주/보조 빛 강도 배율 (기본 1) */
		intensity?: number;
	}

	let { color = 'var(--white)', height = 520, intensity = 1 }: Props = $props();
</script>

<!-- 상세 페이지 공용 앰비언트 배경 글로우 (이미지 추출 평균색 기반 · 순수 렌더링) -->
<div
	class="detail-ambient-glow"
	style:--detail-glow-color={color || 'var(--white)'}
	style:--detail-glow-height="{height}px"
	style:--detail-glow-intensity={intensity}
	aria-hidden="true"
>
	<div class="detail-ambient-orb is-primary"></div>
	<div class="detail-ambient-orb is-secondary"></div>
</div>

<style>
	.detail-ambient-glow {
		position: absolute;
		inset: 0 0 auto 0;
		height: var(--detail-glow-height, 520px);
		pointer-events: none;
		overflow: hidden;
		z-index: 0;
	}

	.detail-ambient-orb {
		position: absolute;
		border-radius: 999px;
		background: var(--detail-glow-color, var(--white));
		filter: blur(110px);
		transition: background-color 0.5s ease;
	}

	.detail-ambient-orb.is-primary {
		top: -120px;
		left: 10%;
		width: 460px;
		height: 340px;
		opacity: calc(0.2 * var(--detail-glow-intensity, 1));
	}

	.detail-ambient-orb.is-secondary {
		top: -80px;
		right: 14%;
		width: 360px;
		height: 280px;
		opacity: calc(0.12 * var(--detail-glow-intensity, 1));
	}
</style>
