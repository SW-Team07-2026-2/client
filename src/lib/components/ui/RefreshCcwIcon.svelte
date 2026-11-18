<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 외부 제어 호버 상태 (버튼 등 래퍼 호버 연동 시 사용) */
		hovered?: boolean;
		/** 호버 시 살짝 기울어지는(@animate-ui default) 모션 활성화 여부 */
		animateOnHover?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	const HOVER_STIFFNESS = 150;
	const HOVER_DAMPING = 25;
	const ROTATE_STIFFNESS = 100;
	const ROTATE_DAMPING = 25;

	let {
		size = 18,
		strokeWidth = 2,
		hovered = false,
		animateOnHover = true,
		class: className = ''
	}: Props = $props();

	let currentAngle = $state(0);

	// 스프링 물리 상태 (Motion spring { stiffness, damping } 재현)
	let angle = 0;
	let velocity = 0;
	let targetAngle = 0;
	let baseAngle = 0;
	let stiffness: number = HOVER_STIFFNESS;
	let damping: number = HOVER_DAMPING;
	let suppressHoverTilt = false;
	let rafId = 0;
	let lastTime = 0;

	function prefersReducedMotion(): boolean {
		return (
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	function stopLoop() {
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
	}

	function tick(now: number) {
		rafId = 0;
		const dt = Math.min((now - lastTime) / 1000, 1 / 30) || 1 / 60;
		lastTime = now;

		const sub = 4;
		const subDt = dt / sub;
		for (let i = 0; i < sub; i++) {
			const accel = -stiffness * (angle - targetAngle) - damping * velocity;
			velocity += accel * subDt;
			angle += velocity * subDt;
		}

		if (Math.abs(angle - targetAngle) < 0.05 && Math.abs(velocity) < 0.2) {
			angle = targetAngle;
			velocity = 0;
			currentAngle = angle;
			return;
		}

		currentAngle = angle;
		rafId = requestAnimationFrame(tick);
	}

	function wakeSpring(nextTarget: number, nextStiffness: number, nextDamping: number) {
		targetAngle = nextTarget;
		stiffness = nextStiffness;
		damping = nextDamping;

		if (prefersReducedMotion()) {
			stopLoop();
			angle = nextTarget;
			velocity = 0;
			currentAngle = nextTarget;
			return;
		}

		if (rafId) return;
		lastTime = performance.now();
		rafId = requestAnimationFrame(tick);
	}

	$effect(() => {
		const isHovered = hovered;
		const allowHover = animateOnHover;

		if (!isHovered) {
			suppressHoverTilt = false;
			wakeSpring(baseAngle, HOVER_STIFFNESS, HOVER_DAMPING);
			return;
		}

		if (allowHover && !suppressHoverTilt) {
			wakeSpring(baseAngle - 45, HOVER_STIFFNESS, HOVER_DAMPING);
		}
	});

	/** 클릭 시 반시계 방향(-360deg) 스프링 회전 트리거 */
	export function rotate() {
		suppressHoverTilt = true;
		baseAngle -= 360;
		wakeSpring(baseAngle, ROTATE_STIFFNESS, ROTATE_DAMPING);
	}

	onDestroy(() => {
		stopLoop();
	});
</script>

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
	class="refresh-ccw-icon {className}"
	style:transform="rotate({currentAngle}deg)"
	aria-hidden="true"
>
	<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
	<path d="M3 3v5h5" />
	<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
	<path d="M16 16h5v5" />
</svg>

<style>
	.refresh-ccw-icon {
		display: block;
		transform-origin: center center;
		will-change: transform;
	}
</style>
