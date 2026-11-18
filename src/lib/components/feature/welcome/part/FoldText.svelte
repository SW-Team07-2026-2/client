<script module lang="ts">
	export type SplitBy = 'char' | 'word' | 'line';
	export type Hinge = 'top' | 'bottom' | 'left' | 'right';
	export type Trigger = 'mount' | 'hover' | 'scroll' | 'loop';
	export type StaggerFrom = 'start' | 'center' | 'end' | 'edges' | 'random';
	export type FoldStyle = 'paper' | 'blinds' | 'flip';

	export interface FoldTextProps {
		text?: string;
		splitBy?: SplitBy;
		hinge?: Hinge;
		foldStyle?: FoldStyle;
		duration?: number;
		stagger?: number;
		staggerFrom?: StaggerFrom;
		foldAngle?: number;
		ease?: string;
		perspective?: number;
		creaseShading?: number;
		trigger?: Trigger;
		loopDelay?: number;
		hoverRefold?: boolean;
		refoldRadius?: number;
		refoldAngle?: number;
		fontSize?: string | number;
		fontWeight?: string | number;
		color?: string;
		class?: string;
		className?: string;
		style?: string;
	}
</script>

<script lang="ts">
	type Axis = 'rotateX' | 'rotateY';

	type HingeConfig = {
		origin: string;
		axis: Axis;
		sign: number;
	};

	type Piece = {
		element: HTMLElement;
		parts: HTMLElement[];
		t: number;
		f: number;
		r: number;
		aim: number;
	};

	type Point = { x: number; y: number };

	type SegmentNode =
		| { kind: 'piece'; key: string; content: string; isLine: boolean }
		| { kind: 'word'; key: string; chars: { key: string; content: string }[] }
		| { kind: 'space'; key: string; text: string }
		| { kind: 'br'; key: string };

	type EaseFn = (t: number) => number;

	const HINGES: Record<Hinge, HingeConfig> = {
		top: { origin: '50% 0%', axis: 'rotateX', sign: -1 },
		bottom: { origin: '50% 100%', axis: 'rotateX', sign: 1 },
		left: { origin: '0% 50%', axis: 'rotateY', sign: 1 },
		right: { origin: '100% 50%', axis: 'rotateY', sign: -1 }
	};

	const SLATS: Record<Axis, { origins: string[]; clips: string[] }> = {
		rotateX: {
			origins: ['50% 25%', '50% 75%'],
			clips: ['inset(-40% -20% 50% -20%)', 'inset(50% -20% -40% -20%)']
		},
		rotateY: {
			origins: ['25% 50%', '75% 50%'],
			clips: ['inset(-40% 50% -40% -20%)', 'inset(-40% -20% -40% 50%)']
		}
	};

	const FOLD_STYLES: FoldStyle[] = ['paper', 'blinds', 'flip'];
	const SLAT_DELAY = 0.24;
	const LOOP_REPEAT_DELAY = 0.35;

	const clamp = (value: number, min: number, max: number): number =>
		Math.min(max, Math.max(min, value));

	const powIn =
		(p: number): EaseFn =>
		(t) =>
			Math.pow(t, p);
	const powOut =
		(p: number): EaseFn =>
		(t) =>
			1 - Math.pow(1 - t, p);
	const powInOut =
		(p: number): EaseFn =>
		(t) =>
			t < 0.5 ? Math.pow(2, p - 1) * Math.pow(t, p) : 1 - Math.pow(-2 * t + 2, p) / 2;

	const EASE_MAP: Record<string, EaseFn> = {
		none: (t) => t,
		linear: (t) => t,
		'power1.in': powIn(2),
		'power1.out': powOut(2),
		'power1.inOut': powInOut(2),
		'power2.in': powIn(3),
		'power2.out': powOut(3),
		'power2.inOut': powInOut(3),
		'power3.in': powIn(4),
		'power3.out': powOut(4),
		'power3.inOut': powInOut(4),
		'power4.in': powIn(5),
		'power4.out': powOut(5),
		'power4.inOut': powInOut(5),
		'sine.in': (t) => 1 - Math.cos((t * Math.PI) / 2),
		'sine.out': (t) => Math.sin((t * Math.PI) / 2),
		'sine.inOut': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
		'expo.in': (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
		'expo.out': (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
		'expo.inOut': (t) =>
			t === 0
				? 0
				: t === 1
					? 1
					: t < 0.5
						? Math.pow(2, 20 * t - 10) / 2
						: (2 - Math.pow(2, -20 * t + 10)) / 2,
		'circ.in': (t) => 1 - Math.sqrt(Math.max(0, 1 - t * t)),
		'circ.out': (t) => Math.sqrt(Math.max(0, 1 - Math.pow(t - 1, 2))),
		'circ.inOut': (t) =>
			t < 0.5
				? (1 - Math.sqrt(Math.max(0, 1 - Math.pow(2 * t, 2)))) / 2
				: (Math.sqrt(Math.max(0, 1 - Math.pow(-2 * t + 2, 2))) + 1) / 2,
		'back.in': (t) => {
			const c1 = 1.70158;
			return (c1 + 1) * t * t * t - c1 * t * t;
		},
		'back.out': (t) => {
			const c1 = 1.70158;
			return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
		},
		'back.inOut': (t) => {
			const c2 = 1.70158 * 1.525;
			return t < 0.5
				? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
				: (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
		}
	};

	function parseEase(name: string): EaseFn | undefined {
		const normalized = name.trim();
		if (EASE_MAP[normalized]) return EASE_MAP[normalized];
		const lower = normalized.toLowerCase();
		for (const [k, fn] of Object.entries(EASE_MAP)) {
			if (k.toLowerCase() === lower) return fn;
		}
		return undefined;
	}

	function computeStaggerDelays(count: number, each: number, from: StaggerFrom): number[] {
		if (count <= 0) return [];
		if (each <= 0 || count === 1) return new Array(count).fill(0);

		if (from === 'random') {
			const order = Array.from({ length: count }, (_, i) => i);
			for (let i = order.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[order[i], order[j]] = [order[j], order[i]];
			}
			return order.map((rank) => rank * each);
		}

		const center = (count - 1) / 2;
		let raw: number[];

		switch (from) {
			case 'end':
				raw = Array.from({ length: count }, (_, i) => count - 1 - i);
				break;
			case 'center':
				raw = Array.from({ length: count }, (_, i) => Math.abs(i - center));
				break;
			case 'edges':
				raw = Array.from({ length: count }, (_, i) => center - Math.abs(i - center));
				break;
			case 'start':
			default:
				raw = Array.from({ length: count }, (_, i) => i);
				break;
		}

		const minVal = Math.min(...raw);
		return raw.map((v) => (v - minVal) * each);
	}

	let {
		text = 'Design unfolds',
		splitBy = 'char',
		hinge = 'top',
		foldStyle = 'paper',
		duration = 0.65,
		stagger = 0.045,
		staggerFrom = 'start',
		foldAngle = 92,
		ease = 'power3.out',
		perspective = 700,
		creaseShading = 0.55,
		trigger = 'mount',
		loopDelay = 1.4,
		hoverRefold = false,
		refoldRadius = 140,
		refoldAngle = 45,
		fontSize = 80,
		fontWeight = 800,
		color = 'currentColor',
		class: klass = '',
		className = '',
		style = ''
	}: FoldTextProps = $props();

	let rootEl: HTMLSpanElement | null = $state(null);

	const safeHinge = $derived<Hinge>(HINGES[hinge] ? hinge : 'top');
	const hingeConfig = $derived(HINGES[safeHinge]);
	const safeStyle = $derived<FoldStyle>(FOLD_STYLES.includes(foldStyle) ? foldStyle : 'paper');
	const safeCrease = $derived(clamp(creaseShading, 0, 1));
	const safeAngle = $derived(clamp(foldAngle, 0, 180));
	const safeStagger = $derived(Math.max(0, stagger));
	const safeDelay = $derived(Math.max(0, loopDelay));
	const safeRadius = $derived(Math.max(1, refoldRadius));
	const safeRefold = $derived(clamp(refoldAngle, 0, 180));
	const startsFolded = $derived(trigger !== 'hover');
	const mergedClass = $derived([klass, className].filter(Boolean).join(' '));

	const segments = $derived.by<SegmentNode[]>(() => {
		if (splitBy === 'line') {
			return text.split('\n').map((line, index) => ({
				kind: 'piece',
				key: `line-${index}`,
				content: line || '\u00A0',
				isLine: true
			}));
		}

		const result: SegmentNode[] = [];
		const parts = text.split(/(\s+)/);

		parts.forEach((part, partIndex) => {
			if (!part) return;

			if (/^\s+$/.test(part)) {
				part.split('\n').forEach((spaces, lineIndex) => {
					if (lineIndex > 0) {
						result.push({ kind: 'br', key: `br-${partIndex}-${lineIndex}` });
					}
					if (spaces) {
						result.push({ kind: 'space', key: `space-${partIndex}-${lineIndex}`, text: spaces });
					}
				});
				return;
			}

			if (splitBy === 'word') {
				result.push({
					kind: 'piece',
					key: `word-${partIndex}`,
					content: part,
					isLine: false
				});
				return;
			}

			result.push({
				kind: 'word',
				key: `word-${partIndex}`,
				chars: Array.from(part).map((char, charIndex) => ({
					key: `char-${partIndex}-${charIndex}`,
					content: char
				}))
			});
		});

		return result;
	});

	$effect(() => {
		const root = rootEl;
		if (!root) return;

		// segments 및 관련 반응형 파라미터 의존성 추적
		void segments;
		const currentHinge = hingeConfig;
		const currentStyle = safeStyle;
		const currentCrease = safeCrease;
		const currentAngle = safeAngle;
		const currentStagger = safeStagger;
		const currentStaggerFrom = staggerFrom;
		const currentDuration = duration;
		const currentEase = ease;
		const currentTrigger = trigger;
		const currentDelay = safeDelay;
		const currentHoverRefold = hoverRefold;
		const currentRadius = safeRadius;
		const currentRefold = safeRefold;
		const currentStartsFolded = startsFolded;

		const elements = Array.from(root.querySelectorAll<HTMLElement>('.fold-text-piece'));
		if (!elements.length) return;

		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		const { axis, sign, origin } = currentHinge;
		const slats = SLATS[axis];
		const unfoldEase =
			parseEase(reduceMotion ? 'power1.out' : currentEase) ?? parseEase('power3.out')!;
		const foldEase = parseEase(reduceMotion ? 'power1.in' : 'power2.in')!;
		const angle = reduceMotion ? 0 : currentStyle === 'flip' ? 180 : currentAngle;
		const crease = reduceMotion ? 0 : currentCrease;
		const refold = currentHoverRefold && !reduceMotion ? currentRefold : 0;
		const lift = currentStyle === 'flip' && !reduceMotion ? 0.45 : 0;
		const unfoldDuration = Math.max(
			0.001,
			reduceMotion ? Math.min(currentDuration, 0.22) : currentDuration
		);
		const foldDuration = Math.max(0.001, unfoldDuration * 0.75);
		const staggerEach = reduceMotion ? Math.min(currentStagger, 0.02) : currentStagger;

		const pieces: Piece[] = elements.map((element) => {
			const parts =
				currentStyle === 'blinds' ? (Array.from(element.children) as HTMLElement[]) : [element];

			if (currentStyle === 'blinds') {
				element.style.opacity = '1';
				parts.forEach((part, index) => {
					part.style.transformOrigin = slats.origins[index];
					part.style.clipPath = index > 0 ? slats.clips[index] : '';
				});
			} else {
				element.style.transformOrigin = currentStyle === 'flip' ? '50% 50%' : origin;
				element.style.backfaceVisibility = currentStyle === 'flip' ? 'visible' : '';
			}

			return { element, parts, t: currentStartsFolded ? 0 : 1, f: 0, r: 0, aim: 0 };
		});

		const shade = (progress: number, tilt: number) =>
			String(crease * clamp(1 - progress + tilt / 90, 0, 1));

		const render = () => {
			pieces.forEach((piece) => {
				const tilt = piece.r * refold;

				if (currentStyle === 'blinds') {
					let resting = tilt < 0.05;
					piece.parts.forEach((part, index) => {
						const offset = index * SLAT_DELAY;
						const open = unfoldEase(clamp((piece.t - offset) / (1 - SLAT_DELAY), 0, 1));
						const close = foldEase(clamp((piece.f - offset) / (1 - SLAT_DELAY), 0, 1));
						const progress = open * (1 - close);
						if (Math.abs(1 - progress) > 0.002) resting = false;
						part.style.transform = `${axis}(${sign * ((1 - progress) * angle + tilt)}deg)`;
						part.style.opacity = String(clamp(progress, 0, 1));
						part.style.setProperty('--fold-crease', shade(progress, tilt));
					});
					piece.parts[0].style.clipPath = resting ? 'none' : slats.clips[0];
					piece.parts[1].style.visibility = resting ? 'hidden' : 'visible';
					return;
				}

				const progress = unfoldEase(piece.t) * (1 - foldEase(piece.f));
				const rise = lift * Math.sin(Math.PI * clamp(progress, 0, 1));
				const turn = `${axis}(${sign * ((1 - progress) * angle + tilt)}deg)`;
				piece.element.style.transform = rise > 0.001 ? `translateZ(${rise}em) ${turn}` : turn;
				piece.element.style.opacity = String(clamp(progress, 0, 1));
				piece.element.style.setProperty('--fold-crease', shade(progress, tilt));
			});
		};

		/* ── 타임라인 재생 엔진 (rAF 기반, GSAP Timeline 대체) ── */
		let animRafId = 0;

		const stopTimeline = () => {
			if (animRafId) {
				cancelAnimationFrame(animRafId);
				animRafId = 0;
			}
		};

		const play = (loop: boolean) => {
			stopTimeline();

			const delays = computeStaggerDelays(pieces.length, staggerEach, currentStaggerFrom);
			const maxDelay = delays.length ? Math.max(...delays) : 0;
			const unfoldTotal = maxDelay + unfoldDuration;
			const foldStartBase = unfoldTotal + currentDelay;
			const foldTotal = foldStartBase + maxDelay + foldDuration;
			const cycleTotal = loop ? foldTotal + LOOP_REPEAT_DELAY : unfoldTotal;

			pieces.forEach((p) => {
				p.t = 0;
				p.f = 0;
			});
			render();

			let startTime: number | null = null;

			const tickTimeline = (now: number) => {
				if (startTime === null) startTime = now;
				let elapsed = (now - startTime) / 1000;

				if (loop && cycleTotal > 0) {
					elapsed = elapsed % cycleTotal;
				}

				pieces.forEach((piece, i) => {
					const d = delays[i];
					piece.t = clamp((elapsed - d) / unfoldDuration, 0, 1);
					piece.f = loop ? clamp((elapsed - (foldStartBase + d)) / foldDuration, 0, 1) : 0;
				});

				render();

				if (loop || elapsed < unfoldTotal) {
					animRafId = requestAnimationFrame(tickTimeline);
				} else {
					animRafId = 0;
				}
			};

			animRafId = requestAnimationFrame(tickTimeline);
		};

		const handleEnter = () => play(false);

		let observer: IntersectionObserver | null = null;

		if (currentTrigger === 'hover') {
			render();
			root.addEventListener('mouseenter', handleEnter);
		} else if (currentTrigger === 'scroll') {
			render();
			if (typeof IntersectionObserver !== 'undefined') {
				observer = new IntersectionObserver(
					(entries) => {
						if (entries.some((entry) => entry.isIntersecting)) {
							observer?.disconnect();
							observer = null;
							handleEnter();
						}
					},
					{ rootMargin: '0px 0px -18% 0px', threshold: 0 }
				);
				observer.observe(root);
			} else {
				handleEnter();
			}
		} else {
			play(currentTrigger === 'loop');
		}

		/* ── 호버 근접 리폴드(Refold) 물리 엔진 ── */
		let pointer: Point | null = null;
		let centers: Point[] | null = null;
		let measured: { width: number; height: number } | null = null;
		let relaxing = false;
		let relaxRafId = 0;
		let lastRelaxTime = 0;

		const measure = (box: DOMRect) => {
			centers = pieces.map((piece) => {
				const rect = (piece.element.parentElement ?? piece.element).getBoundingClientRect();
				return {
					x: rect.left - box.left + rect.width / 2,
					y: rect.top - box.top + rect.height / 2
				};
			});
			measured = { width: box.width, height: box.height };
		};

		const relax = (now: number) => {
			const deltaTime = lastRelaxTime ? now - lastRelaxTime : 16;
			lastRelaxTime = now;
			const step = Math.min(deltaTime, 64) / 1000;
			let moving = false;

			pieces.forEach((piece) => {
				const rate = piece.aim > piece.r ? 14 : 6;
				piece.r += (piece.aim - piece.r) * (1 - Math.exp(-rate * step));
				if (Math.abs(piece.aim - piece.r) > 0.001) {
					moving = true;
				} else {
					piece.r = piece.aim;
				}
			});

			render();

			if (moving) {
				relaxRafId = requestAnimationFrame(relax);
			} else {
				relaxing = false;
				relaxRafId = 0;
				lastRelaxTime = 0;
			}
		};

		const aim = () => {
			const box = root.getBoundingClientRect();
			const near =
				pointer !== null &&
				pointer.x > box.left - currentRadius &&
				pointer.x < box.right + currentRadius &&
				pointer.y > box.top - currentRadius &&
				pointer.y < box.bottom + currentRadius;

			if (
				near &&
				(!centers ||
					!measured ||
					Math.abs(box.width - measured.width) + Math.abs(box.height - measured.height) > 1)
			) {
				measure(box);
			}

			let changed = false;
			pieces.forEach((piece, index) => {
				let value = 0;
				if (near && pointer && centers) {
					const center = centers[index];
					const distance =
						Math.hypot(box.left + center.x - pointer.x, box.top + center.y - pointer.y) /
						currentRadius;
					if (distance < 1) {
						value = 1 - distance * distance * (3 - 2 * distance);
					}
				}
				if (value !== piece.aim) changed = true;
				piece.aim = value;
			});

			if (changed && !relaxing) {
				relaxing = true;
				lastRelaxTime = performance.now();
				relaxRafId = requestAnimationFrame(relax);
			}
		};

		const handleMove = (event: PointerEvent) => {
			pointer = { x: event.clientX, y: event.clientY };
			aim();
		};

		const handleLeave = () => {
			pointer = null;
			aim();
		};

		const handleScroll = () => {
			if (pointer) aim();
		};

		if (refold) {
			window.addEventListener('pointermove', handleMove, { passive: true });
			window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
			document.documentElement.addEventListener('pointerleave', handleLeave);
		}

		return () => {
			root.removeEventListener('mouseenter', handleEnter);
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('scroll', handleScroll, { capture: true });
			document.documentElement.removeEventListener('pointerleave', handleLeave);
			stopTimeline();
			if (relaxRafId) {
				cancelAnimationFrame(relaxRafId);
				relaxRafId = 0;
			}
			observer?.disconnect();
		};
	});
</script>

{#snippet pieceNode(content: string, isLine: boolean)}
	<span class="fold-text-segment" data-fold-split={isLine ? 'line' : undefined}>
		{#if safeStyle === 'blinds'}
			<span
				class="fold-text-piece"
				data-fold-hinge={safeHinge}
				data-fold-style="blinds"
				style:opacity={startsFolded ? 0 : undefined}
			>
				<span class="fold-text-slat" data-fold-text={content}>{content}</span>
				<span class="fold-text-slat" data-fold-slat="b" data-fold-text={content}>{content}</span>
			</span>
		{:else}
			<span
				class="fold-text-piece"
				data-fold-hinge={safeHinge}
				data-fold-style={safeStyle}
				data-fold-text={content}
				style:opacity={startsFolded ? 0 : undefined}
			>
				{content}
			</span>
		{/if}
	</span>
{/snippet}

<span
	bind:this={rootEl}
	class="fold-text {mergedClass}"
	style:--fold-text-font-size={typeof fontSize === 'number' ? `${fontSize}px` : fontSize}
	style:--fold-text-font-weight={fontWeight}
	style:--fold-text-color={color}
	style:--fold-perspective="{Math.max(120, perspective)}px"
	{style}
>
	<span class="fold-text-sr-only">{text}</span>
	<span class="fold-text-visual" aria-hidden="true">
		{#each segments as seg (seg.key)}
			{#if seg.kind === 'piece'}
				{@render pieceNode(seg.content, seg.isLine)}
			{:else if seg.kind === 'word'}
				<span class="fold-text-word">
					{#each seg.chars as ch (ch.key)}
						{@render pieceNode(ch.content, false)}
					{/each}
				</span>
			{:else if seg.kind === 'space'}
				{seg.text}
			{:else if seg.kind === 'br'}
				<br />
			{/if}
		{/each}
	</span>
</span>

<style>
	.fold-text {
		position: relative;
		display: inline-block;
		font-size: var(--fold-text-font-size);
		font-weight: var(--fold-text-font-weight);
		color: var(--fold-text-color);
		line-height: 1.15;
	}

	.fold-text-sr-only {
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

	.fold-text-visual {
		display: inline-block;
		perspective: var(--fold-perspective, 700px);
		transform-style: preserve-3d;
	}

	.fold-text-word {
		display: inline-block;
		white-space: nowrap;
		transform-style: preserve-3d;
	}

	.fold-text-segment {
		display: inline-block;
		transform-style: preserve-3d;
	}

	.fold-text-segment[data-fold-split='line'] {
		display: block;
	}

	.fold-text-piece {
		position: relative;
		display: inline-block;
		transform-style: preserve-3d;
		will-change: transform, opacity;
	}

	.fold-text-slat {
		position: relative;
		display: inline-block;
		will-change: transform, opacity;
	}

	.fold-text-slat[data-fold-slat='b'] {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	/* 접힘 각도(--fold-crease)에 따른 글자 음영(Crease Shading) 오버레이 */
	.fold-text-piece[data-fold-text]::after,
	.fold-text-slat[data-fold-text]::after {
		content: attr(data-fold-text);
		position: absolute;
		inset: 0;
		color: #000000;
		opacity: var(--fold-crease, 0);
		pointer-events: none;
		user-select: none;
	}
</style>
