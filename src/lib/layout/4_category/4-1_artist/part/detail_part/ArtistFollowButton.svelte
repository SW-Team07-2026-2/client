<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';

	interface Props {
		following: boolean;
		loading?: boolean;
		/** 현재 사용자 제외 기준 팔로워 수 */
		count?: number;
		onToggle?: () => void;
	}

	let { following, loading = false, count = 0, onToggle }: Props = $props();

	const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

	const displayCount = $derived(Math.max(0, count) + (following ? 1 : 0));
	const rollingChars = $derived.by(() => {
		const text = displayCount.toLocaleString('en-US');
		return text.split('').map((char, i) => ({
			// 오른쪽(일의 자리) 기준 키 고정으로 자릿수 증감 시 자연스럽게 롤링
			key: text.length - i,
			char,
			digit: char >= '0' && char <= '9' ? Number(char) : null
		}));
	});

	// 이중 진자(종 + 종추) 충돌 물리 상수 (Kokonut UI BellButton 기반)
	const STEP = 1 / 240;
	const BELL_STIFFNESS = 380;
	const BELL_DAMPING = 5;
	const CLAPPER_STIFFNESS = 150;
	const CLAPPER_DAMPING = 4;
	const LIP = 13;
	const RESTITUTION = 0.45;
	const RECOIL = 0.18;
	const STRIKE_SPEED = 260;
	const RING_KICK = 600;
	const NUDGE_KICK = 160;
	const MUTE_KICK = 300;
	const REST = 0.05;
	const PIVOT = { x: 12, y: 2.5 };
	const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

	let bellEl = $state<SVGGElement | null>(null);
	let clapperEl = $state<SVGPathElement | null>(null);
	let leftWaveEl = $state<SVGPathElement | null>(null);
	let rightWaveEl = $state<SVGPathElement | null>(null);

	const sim = {
		bell: 0,
		bellSpeed: 0,
		clapper: 0,
		clapperSpeed: 0,
		muffled: true,
		raf: 0,
		last: 0,
		carry: 0,
		lastNudge: 0,
		reduceMotion: false
	};

	// FdDiv 내장 ws(호버/유휴 물결 스프링) · cs(색상 크로스페이드 스프링)를 그대로 활용
	// - pauseWhenIdle: !following -> 미팔로우 시 호버할 때만 물결, 팔로잉 시 항상 물결
	// - waveColor 미지정 -> 본체 색상과 동일하게 자연스럽게 연동
	// - pressColor: transparent -> 클릭 순간 cPress 스냅 없이 cs 크로스페이드가 부드럽게 보이도록 유지
	const fdSetting = $derived.by(() => {
		const shared = {
			radius: 999,
			inset: 8,
			bulge: 4,
			reach: 26,
			waveLength: 56,
			borderWidth: 0,
			layers: 2,
			layerGap: 2.5,
			waveAmp: 2.4,
			spin: 1.25,
			pressColor: 'transparent',
			pauseWhenIdle: !following
		};

		if (following) {
			return new FluidSetting({
				...shared,
				color: 'var(--white-2)',
				hoverColor: 'var(--white)',
				textColor: 'var(--bg)'
			});
		}

		return new FluidSetting({
			...shared,
			color: 'var(--surface-3)',
			hoverColor: 'var(--surface-4)',
			textColor: 'var(--fg)'
		});
	});

	function haptic(ms: number) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(ms);
			} catch {
				// 진동 미지원 환경 무시
			}
		}
	}

	function draw() {
		bellEl?.setAttribute('transform', `rotate(${sim.bell.toFixed(2)} ${PIVOT.x} ${PIVOT.y})`);
		clapperEl?.setAttribute(
			'transform',
			`rotate(${sim.clapper.toFixed(2)} ${PIVOT.x} ${PIVOT.y})`
		);
	}

	function flare(side: 1 | -1, strength: number) {
		const wave = side > 0 ? rightWaveEl : leftWaveEl;
		if (!wave?.animate) return;
		const peak = Math.min(1, 0.45 + strength * 0.55);
		wave.animate(
			[
				{ opacity: peak, transform: 'translateX(0px)' },
				{ opacity: 0, transform: `translateX(${side * 3}px)` }
			],
			{ duration: 420, easing: EASE_OUT }
		);
	}

	function step() {
		sim.bellSpeed += (-sim.bell * BELL_STIFFNESS - sim.bellSpeed * BELL_DAMPING) * STEP;
		sim.bell += sim.bellSpeed * STEP;
		if (sim.muffled) {
			sim.clapper = sim.bell;
			sim.clapperSpeed = sim.bellSpeed;
			return;
		}
		sim.clapperSpeed +=
			(-sim.clapper * CLAPPER_STIFFNESS - sim.clapperSpeed * CLAPPER_DAMPING) * STEP;
		sim.clapper += sim.clapperSpeed * STEP;

		const relative = sim.clapper - sim.bell;
		if (Math.abs(relative) <= LIP) return;

		const side = (relative > 0 ? 1 : -1) as 1 | -1;
		const impact = (sim.clapperSpeed - sim.bellSpeed) * side;
		sim.clapper = sim.bell + side * LIP;
		if (impact <= 0) return;

		sim.clapperSpeed -= side * impact * (1 + RESTITUTION);
		sim.bellSpeed += side * impact * RECOIL;
		if (impact > STRIKE_SPEED) {
			flare(side, impact / 1600);
			haptic(6);
		}
	}

	function tick(now: number) {
		sim.raf = 0;
		const elapsed = sim.last ? Math.min((now - sim.last) / 1000, 0.05) : STEP;
		sim.last = now;
		sim.carry += elapsed;
		while (sim.carry >= STEP) {
			step();
			sim.carry -= STEP;
		}
		draw();

		const energy =
			Math.abs(sim.bell) +
			Math.abs(sim.bellSpeed) * 0.02 +
			Math.abs(sim.clapper) +
			Math.abs(sim.clapperSpeed) * 0.02;

		if (energy < REST) {
			sim.bell = 0;
			sim.bellSpeed = 0;
			sim.clapper = 0;
			sim.clapperSpeed = 0;
			sim.last = 0;
			draw();
			return;
		}
		sim.raf = requestAnimationFrame(tick);
	}

	function kick(speed: number) {
		if (sim.reduceMotion) return;
		sim.bellSpeed += speed;
		if (!sim.raf) {
			sim.raf = requestAnimationFrame(tick);
		}
	}

	$effect(() => {
		sim.muffled = !following;
	});

	onMount(() => {
		if (typeof window === 'undefined') return;
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		sim.reduceMotion = query.matches;
		const onChange = () => {
			sim.reduceMotion = query.matches;
		};
		query.addEventListener('change', onChange);
		return () => {
			query.removeEventListener('change', onChange);
		};
	});

	onDestroy(() => {
		if (sim.raf) {
			cancelAnimationFrame(sim.raf);
			sim.raf = 0;
		}
	});

	function handleClick() {
		if (loading) return;
		const next = !following;
		onToggle?.();

		if (next) {
			sim.muffled = false;
			kick(sim.bellSpeed >= 0 ? RING_KICK : -RING_KICK);
			if (sim.reduceMotion) {
				flare(1, 0.6);
				flare(-1, 0.6);
			}
			haptic(10);
		} else {
			sim.muffled = true;
			kick(-MUTE_KICK);
		}
	}

	function handlePointerEnter(event: PointerEvent) {
		if (event.pointerType !== 'mouse' || sim.muffled) return;
		if (event.timeStamp - sim.lastNudge < 700) return;
		sim.lastNudge = event.timeStamp;
		kick(sim.bellSpeed >= 0 ? NUDGE_KICK : -NUDGE_KICK);
	}
</script>

<!-- 아티스트 상세 팔로우/팔로잉 벨 버튼 (FdDiv 배경 + 이중 진자 벨 물리, 순수 렌더링) -->
<FdDiv class="artist-bell-fd-wrap" bodyClass="artist-bell-fd-body" setting={fdSetting}>
	<button
		type="button"
		class="artist-bell-btn"
		class:is-following={following}
		aria-pressed={following}
		aria-disabled={loading || undefined}
		aria-busy={loading || undefined}
		onclick={handleClick}
		onpointerenter={handlePointerEnter}
	>
		<svg
			aria-hidden="true"
			class="bell-svg"
			fill="none"
			stroke="currentColor"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			viewBox="0 0 24 24"
		>
			<path
				bind:this={rightWaveEl}
				class="bell-wave"
				d="M21.5 4.5c1.2 1.6 1.8 3.4 1.8 5.5"
			/>
			<path bind:this={leftWaveEl} class="bell-wave" d="M2.5 4.5C1.3 6.1.7 7.9.7 10" />
			<path bind:this={clapperEl} d="M10.27 21a2 2 0 0 0 3.46 0" />
			<g bind:this={bellEl}>
				<path
					class="bell-body"
					class:is-filled={following}
					d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"
				/>
				<path
					class="bell-slash"
					d="M3 3l18 18"
					stroke-dasharray="26"
					stroke-dashoffset={following ? 26 : 0}
				/>
			</g>
		</svg>

		<span class="sr-only">팔로우</span>
		<span aria-hidden="true" class="bell-label-stack">
			<span class="bell-label" class:is-active={!following}>팔로우</span>
			<span class="bell-label" class:is-active={following}>팔로잉</span>
		</span>

		<span class="bell-count-badge" class:is-following={following}>
			<span aria-hidden="true" class="rolling-number">
				{#each rollingChars as item (item.key)}
					{#if item.digit === null}
						<span>{item.char}</span>
					{:else}
						<span class="rolling-digit-slot">
							<span
								class="rolling-digit-track"
								style:transform="translateY({-item.digit * 10}%)"
							>
								{#each DIGITS as d (d)}
									<span class="rolling-digit">{d}</span>
								{/each}
							</span>
						</span>
					{/if}
				{/each}
			</span>
			<span class="sr-only">{displayCount.toLocaleString('en-US')} 팔로워</span>
		</span>
	</button>
</FdDiv>

<style>
	:global(.artist-bell-fd-wrap) {
		display: inline-flex;
		vertical-align: middle;
	}

	:global(.artist-bell-fd-body) {
		padding: 0 !important;
	}

	.artist-bell-btn {
		appearance: none;
		border: none;
		background: transparent;
		margin: 0;
		padding: 0.34rem 0.42rem 0.34rem 0.95rem;
		border-radius: 999px;
		color: var(--fg);
		font: inherit;
		font-size: 0.875rem;
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		user-select: none;
		outline: none;
		transition: color 0.2s ease-out;
	}

	.artist-bell-btn.is-following {
		color: var(--bg);
	}

	.artist-bell-btn:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--white) 65%, transparent);
	}

	.bell-svg {
		width: 18px;
		height: 18px;
		overflow: visible;
		flex-shrink: 0;
	}

	.bell-wave {
		opacity: 0;
	}

	.bell-body {
		fill: transparent;
		transition: fill 0.2s ease-out;
	}

	.bell-body.is-filled {
		fill: currentColor;
	}

	.bell-slash {
		transition: stroke-dashoffset 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.bell-label-stack {
		position: relative;
		display: inline-grid;
	}

	.bell-label {
		grid-column: 1;
		grid-row: 1;
		white-space: nowrap;
		opacity: 0;
		filter: blur(2px);
		transition:
			opacity 0.2s ease-out,
			filter 0.2s ease-out;
	}

	.bell-label.is-active {
		opacity: 1;
		filter: blur(0px);
	}

	.bell-count-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.22rem 0.62rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: var(--fw-medium);
		background: color-mix(in srgb, var(--bg) 42%, transparent);
		color: var(--muted);
		transition:
			background-color 0.2s ease-out,
			color 0.2s ease-out;
	}

	.bell-count-badge.is-following {
		background: color-mix(in srgb, var(--bg) 12%, transparent);
		color: color-mix(in srgb, var(--bg) 72%, transparent);
	}

	.rolling-number {
		display: inline-flex;
		font-variant-numeric: tabular-nums;
	}

	.rolling-digit-slot {
		position: relative;
		display: inline-block;
		height: 1.25rem;
		overflow: hidden;
	}

	.rolling-digit-track {
		display: flex;
		flex-direction: column;
		transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.rolling-digit {
		height: 1.25rem;
		line-height: 1.25rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.bell-slash,
		.bell-label,
		.bell-body,
		.rolling-digit-track {
			transition: none;
		}
	}
</style>
