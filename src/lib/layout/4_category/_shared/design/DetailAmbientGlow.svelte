<script lang="ts">
	interface Props {
		/** 배경을 은은하게 비출 색상 (미추출 시 빈 문자열/null이면 꺼진 상태에서 추출 후 서서히 피어오름) */
		color?: string | null;
		/** 상단 글로우 레이어 높이 (px, 기본 760) */
		height?: number;
		/** 주/보조 빛 강도 배율 (기본 1) */
		intensity?: number;
	}

	let { color = '', height = 760, intensity = 1 }: Props = $props();

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
		/* closest-side 기준 가우시안 감쇠로 경계 잘림 없이 부드러운 블러 표현 */
		background: radial-gradient(
			closest-side at 50% 50%,
			color-mix(in srgb, var(--detail-glow-color, transparent) 92%, transparent) 0%,
			color-mix(in srgb, var(--detail-glow-color, transparent) 62%, transparent) 26%,
			color-mix(in srgb, var(--detail-glow-color, transparent) 28%, transparent) 52%,
			color-mix(in srgb, var(--detail-glow-color, transparent) 9%, transparent) 74%,
			color-mix(in srgb, var(--detail-glow-color, transparent) 2%, transparent) 88%,
			transparent 100%
		);
	}

	.detail-ambient-orb.is-primary {
		top: calc(var(--detail-glow-height, 760px) * -0.32);
		left: -14%;
		width: max(1120px, 84%);
		height: calc(var(--detail-glow-height, 760px) * 1.24);
		opacity: calc(0.36 * var(--detail-glow-intensity, 1));
	}

	.detail-ambient-orb.is-secondary {
		top: calc(var(--detail-glow-height, 760px) * -0.22);
		right: -12%;
		width: max(960px, 74%);
		height: calc(var(--detail-glow-height, 760px) * 1.14);
		opacity: calc(0.26 * var(--detail-glow-intensity, 1));
	}

	@media (prefers-reduced-motion: reduce) {
		.detail-ambient-glow {
			transition: none;
		}
	}
</style>
