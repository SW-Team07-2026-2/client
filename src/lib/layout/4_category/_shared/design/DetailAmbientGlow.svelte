<script lang="ts">
	interface Props {
		/** 배경을 은은하게 비출 색상 (미추출 시 빈 문자열/null이면 꺼진 상태에서 추출 후 서서히 피어오름) */
		color?: string | null;
		/** 상단 글로우 레이어 높이 (px, 기본 520) */
		height?: number;
		/** 주/보조 빛 강도 배율 (기본 1) */
		intensity?: number;
	}

	let { color = '', height = 520, intensity = 1 }: Props = $props();

	const normalizedColor = $derived.by(() => {
		const c = color?.trim() ?? '';
		if (!c || c === 'var(--muted-wave)' || c === 'var(--white)') return '';
		return c;
	});
	const isReady = $derived(normalizedColor.length > 0);
</script>

<!-- 상세 페이지 공용 앰비언트 배경 글로우 (GPU blur 필터 제거 · 순수 radial-gradient로 슬라이드 프레임 드롭 차단) -->
<div
	class="detail-ambient-glow"
	class:is-ready={isReady}
	style:--detail-glow-color={normalizedColor || 'transparent'}
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
		opacity: 0;
		contain: strict;
		transition: opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.detail-ambient-glow.is-ready {
		opacity: 1;
	}

	.detail-ambient-orb {
		position: absolute;
		border-radius: 50%;
		background: radial-gradient(
			ellipse 64% 64% at 50% 50%,
			color-mix(in srgb, var(--detail-glow-color, transparent) 85%, transparent) 0%,
			color-mix(in srgb, var(--detail-glow-color, transparent) 38%, transparent) 38%,
			color-mix(in srgb, var(--detail-glow-color, transparent) 10%, transparent) 64%,
			transparent 82%
		);
	}

	.detail-ambient-orb.is-primary {
		top: -240px;
		left: -60px;
		width: 740px;
		height: 580px;
		opacity: calc(0.26 * var(--detail-glow-intensity, 1));
	}

	.detail-ambient-orb.is-secondary {
		top: -190px;
		right: -40px;
		width: 620px;
		height: 480px;
		opacity: calc(0.16 * var(--detail-glow-intensity, 1));
	}

	@media (prefers-reduced-motion: reduce) {
		.detail-ambient-glow {
			transition: none;
		}
	}
</style>
