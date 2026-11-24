<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import DynamicText from '../part/header_part/DynamicText.svelte';
	import { prefersReducedMotion } from '#lib/common/type/spring';

	type SlideDirection = 1 | -1;

	interface Props {
		/** 다이나믹 모핑 타이틀 텍스트 (예: Artist, Concert, Album, Merchandise, My Page) */
		title: string;
		/** 타이틀 하단 부설명 */
		description?: string;
		/** 방향성 블러 전환용 카테고리 인덱스 */
		sectionIndex?: number;
	}

	let { title, description = '', sectionIndex = 0 }: Props = $props();

	interface SubtitleItem {
		uid: number;
		text: string;
		phase: 'idle' | 'entering' | 'exiting';
		dir: SlideDirection;
	}

	const SUBTITLE_MOTION = {
		distance: 36,
		blur: 6,
		enterMs: 400,
		exitMs: 300,
		ease: 'cubic-bezier(0.22, 1, 0.36, 1)'
	} as const;

	let subtitleItems = $state<SubtitleItem[]>([]);
	let nextUid = 1;
	let lastIdx: number | null = null;
	let cleanupTimer: ReturnType<typeof setTimeout> | undefined;

	function animateSubtitle(
		node: HTMLElement,
		params: { phase: SubtitleItem['phase']; dir: SlideDirection }
	) {
		let curPhase = params.phase;

		function play(next: { phase: SubtitleItem['phase']; dir: SlideDirection }) {
			if (prefersReducedMotion()) return;
			if (next.phase === 'entering') {
				node.getAnimations().forEach((a) => a.cancel());
				node.animate(
					[
						{
							transform: `translate3d(${next.dir * SUBTITLE_MOTION.distance}px, 0, 0)`,
							opacity: 0,
							filter: `blur(${SUBTITLE_MOTION.blur}px)`
						},
						{ transform: 'translate3d(0, 0, 0)', opacity: 1, filter: 'blur(0px)' }
					],
					{ duration: SUBTITLE_MOTION.enterMs, easing: SUBTITLE_MOTION.ease, fill: 'backwards' }
				);
			} else if (next.phase === 'exiting') {
				node.getAnimations().forEach((a) => a.cancel());
				node.animate(
					[
						{ transform: 'translate3d(0, 0, 0)', opacity: 1, filter: 'blur(0px)' },
						{
							transform: `translate3d(${-next.dir * SUBTITLE_MOTION.distance}px, 0, 0)`,
							opacity: 0,
							filter: `blur(${SUBTITLE_MOTION.blur}px)`
						}
					],
					{ duration: SUBTITLE_MOTION.exitMs, easing: SUBTITLE_MOTION.ease, fill: 'forwards' }
				);
			}
		}

		if (curPhase !== 'idle') play(params);

		return {
			update(next: { phase: SubtitleItem['phase']; dir: SlideDirection }) {
				if (next.phase !== curPhase) {
					curPhase = next.phase;
					if (next.phase === 'exiting') play(next);
				}
			}
		};
	}

	$effect.pre(() => {
		const text = description.trim();
		const idx = sectionIndex;

		untrack(() => {
			if (!text) {
				clearTimeout(cleanupTimer);
				subtitleItems = [];
				lastIdx = idx;
				return;
			}

			if (lastIdx === null || prefersReducedMotion()) {
				clearTimeout(cleanupTimer);
				lastIdx = idx;
				subtitleItems = [{ uid: nextUid++, text, phase: 'idle', dir: 1 }];
				return;
			}

			const current = subtitleItems.find((item) => item.phase !== 'exiting');
			if (current && current.text === text && idx === lastIdx) return;

			const dir: SlideDirection = idx >= lastIdx ? 1 : -1;
			lastIdx = idx;

			const nextItems: SubtitleItem[] = subtitleItems
				.filter((item) => item.phase !== 'exiting')
				.map((item) => ({ ...item, phase: 'exiting' as const, dir }));

			nextItems.push({ uid: nextUid++, text, phase: 'entering', dir });
			subtitleItems = nextItems;

			clearTimeout(cleanupTimer);
			cleanupTimer = setTimeout(() => {
				subtitleItems = subtitleItems
					.filter((item) => item.phase !== 'exiting')
					.map((item) => (item.phase === 'entering' ? { ...item, phase: 'idle' as const } : item));
			}, Math.max(SUBTITLE_MOTION.enterMs, SUBTITLE_MOTION.exitMs));
		});
	});

	onDestroy(() => {
		clearTimeout(cleanupTimer);
	});
</script>

<!-- PC 콘텐츠 헤더: 다이나믹 타이틀 + 방향성 블러 부설명 (순수 렌더링) -->
<header class="pc-content-header">
	<h1 class="category-heading">
		<DynamicText mode="morph" text={title} />
	</h1>

	{#if subtitleItems.length > 0}
		<div class="subtitle-wrap">
			{#each subtitleItems as item (item.uid)}
				<p
					class="category-subtitle"
					use:animateSubtitle={{ phase: item.phase, dir: item.dir }}
					aria-hidden={item.phase === 'exiting' || undefined}
					style:pointer-events={item.phase === 'exiting' ? 'none' : undefined}
				>
					{item.text}
				</p>
			{/each}
		</div>
	{/if}
</header>

<style>
	.pc-content-header {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.25rem var(--content-header-padding-x, var(--content-padding-x)) 0.5rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.5rem;
		contain: layout style;
	}

	.category-heading {
		margin: 0;
		width: 100%;
		display: flex;
		justify-content: center;
		font-size: clamp(4.01875rem, 4.37vw, 4.88125rem);
		font-weight: var(--fw-bold);
		letter-spacing: -0.02em;
		line-height: 1;
		color: var(--white);
		contain: layout style;
	}

	.subtitle-wrap {
		position: relative;
		width: 100%;
		min-height: 1.5rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		overflow-x: clip;
		overflow-y: visible;
	}

	.category-subtitle {
		grid-area: 1 / 1;
		width: 100%;
		margin: 0;
		font-size: 1.1625rem;
		font-weight: var(--fw-medium);
		line-height: 1;
		text-align: center;
		color: var(--muted);
		will-change: transform, opacity, filter;
	}
</style>
