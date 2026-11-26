<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from '#lib/common/type/spring';

	interface Props {
		/** 표시할 정수 값 */
		value: number;
		/** 천 단위 구분자 (빈 문자열이면 구분자 미표시) */
		thousandSeparator?: string;
		/** 접두사 (예: '₩') */
		prefix?: string;
		/** 접미사 (예: '원', '개') */
		suffix?: string;
		/** true면 접미사가 주변 텍스트의 크기·색상을 그대로 상속 (인라인 카운트용) */
		inheritSuffixStyle?: boolean;
		/** 스크린 리더 접근성 라벨 (미전달 시 자동 생성) */
		ariaLabel?: string;
	}

	let {
		value,
		thousandSeparator = ',',
		prefix = '',
		suffix = '',
		inheritSuffixStyle = false,
		ariaLabel
	}: Props = $props();

	interface NumberToken {
		key: string;
		type: 'digit' | 'sep';
		digit: number;
		char: string;
		place: number;
	}

	const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

	const normalizedValue = $derived(Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

	// 값 증감 방향 추적 (+1: 증가, -1: 감소) — 자릿수 추가/제거 시 롤링 방향 동기화
	let prevValue = untrack(() => normalizedValue);
	let trend = $state<1 | -1>(1);

	$effect.pre(() => {
		const next = normalizedValue;
		if (next !== prevValue) {
			trend = next > prevValue ? 1 : -1;
			prevValue = next;
		}
	});

	const tokens = $derived.by<NumberToken[]>(() => {
		const raw = String(normalizedValue);
		const len = raw.length;
		const result: NumberToken[] = [];

		for (let i = 0; i < len; i++) {
			const placeFromRight = len - 1 - i;
			result.push({
				key: `d-${placeFromRight}`,
				type: 'digit',
				digit: Number(raw[i]),
				char: raw[i],
				place: placeFromRight
			});
			if (thousandSeparator && placeFromRight > 0 && placeFromRight % 3 === 0) {
				result.push({
					key: `s-${placeFromRight}`,
					type: 'sep',
					digit: 0,
					char: thousandSeparator,
					place: placeFromRight
				});
			}
		}

		return result;
	});

	const computedAriaLabel = $derived(
		ariaLabel ?? `${prefix}${normalizedValue.toLocaleString('ko-KR')}${suffix}`
	);

	/**
	 * 자릿수 추가/제거 시 폭(width) 수축·확장과 전체 높이(105%) 세로 롤링을 함께 적용하는 커스텀 트랜지션
	 * - 증가(trend = 1): 새 자릿수가 아래(+105%)에서 위로 롤링하며 진입
	 * - 감소(trend = -1): 사라지는 자릿수가 아래(+105%)로 롤링하며 자연스럽게 접힘
	 */
	function digitSlot(
		node: Element,
		params: { kind: 'in' | 'out'; place: number }
	) {
		if (prefersReducedMotion()) {
			return { duration: 0 };
		}

		const el = node as HTMLElement;
		const width = el.getBoundingClientRect().width || el.offsetWidth;
		const delay = Math.min(params.place, 5) * 18;
		const duration = params.kind === 'in' ? 380 : 320;
		const dir = trend;
		// in: 증가 시 +105% -> 0 (아래에서 위로), 감소 시 -105% -> 0 (위에서 아래로)
		// out: 감소 시 0 -> +105% (아래로 내려가며 퇴장), 증가 시 0 -> -105% (위로 올라가며 퇴장)
		const travelPct = params.kind === 'in' ? dir * 105 : -dir * 105;

		return {
			delay,
			duration,
			easing: cubicOut,
			css: (t: number, u: number) => {
				// 폭은 롤링보다 약간 빠르게 열리고 천천히 닫혀 숫자가 옆으로 찌그러지지 않게 유지
				const widthFactor = Math.min(1, t * 1.35);
				const opacity = Math.min(1, t * 1.25);
				const yPct = (u * travelPct).toFixed(2);
				return `width: ${(width * widthFactor).toFixed(2)}px; opacity: ${opacity.toFixed(3)}; transform: translate3d(0, ${yPct}%, 0);`;
			}
		};
	}
</script>

<!-- 범용 자릿수 롤링 + 자릿수 추가/제거 애니메이션 숫자 컴포넌트 (순수 렌더링) -->
<span class="sliding-number" aria-label={computedAriaLabel}>
	{#if prefix}
		<span class="sliding-affix is-prefix" aria-hidden="true">{prefix}</span>
	{/if}

	<span class="sliding-digits-clip" aria-hidden="true">
		{#each tokens as token (token.key)}
			<!-- Svelte 5 로컬 트랜지션은 직계 제어 블록({#each})의 직접 자식에 붙어야 자릿수 추가·제거 시 정상 동작합니다 -->
			<span
				class="token-slot"
				class:is-sep={token.type === 'sep'}
				class:is-digit={token.type === 'digit'}
				in:digitSlot={{ kind: 'in', place: token.place }}
				out:digitSlot={{ kind: 'out', place: token.place }}
			>
				{#if token.type === 'sep'}
					<span class="sliding-sep">{token.char}</span>
				{:else}
					<span class="digit-window">
						<span
							class="digit-column"
							style:transform="translate3d(0, -{token.digit * 10}%, 0)"
							style:transition-delay="{Math.min(token.place, 5) * 18}ms"
						>
							{#each DIGITS as d (d)}
								<span class="digit-cell">{d}</span>
							{/each}
						</span>
					</span>
				{/if}
			</span>
		{/each}
	</span>

	{#if suffix}
		<span
			class="sliding-affix is-suffix"
			class:is-inherit={inheritSuffixStyle}
			aria-hidden="true"
		>
			{suffix}
		</span>
	{/if}
</span>

<style>
	.sliding-number {
		display: inline-flex;
		align-items: baseline;
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
	}

	.sliding-digits-clip {
		display: inline-flex;
		align-items: baseline;
		height: 1.15em;
		overflow: hidden;
		vertical-align: bottom;
	}

	.token-slot {
		display: inline-flex;
		align-items: flex-start;
		justify-content: center;
		height: 1.15em;
		flex-shrink: 0;
		will-change: transform, width, opacity;
	}

	.digit-window {
		position: relative;
		display: inline-block;
		height: 1.15em;
		overflow: hidden;
		flex-shrink: 0;
	}

	.digit-column {
		display: flex;
		flex-direction: column;
		will-change: transform;
		transition: transform 0.44s cubic-bezier(0.22, 1.08, 0.36, 1);
	}

	.digit-cell {
		height: 1.15em;
		line-height: 1.15em;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sliding-sep {
		display: inline-block;
		height: 1.15em;
		line-height: 1.15em;
		flex-shrink: 0;
	}

	.sliding-affix {
		line-height: 1.15em;
	}

	.sliding-affix.is-prefix {
		margin-right: 0.06em;
	}

	.sliding-affix.is-suffix {
		margin-left: 0.06em;
		font-size: 0.78em;
		font-weight: var(--fw-bold);
		color: var(--white-2);
	}

	.sliding-affix.is-suffix.is-inherit {
		margin-left: 0;
		font-size: 1em;
		font-weight: inherit;
		color: inherit;
	}

	@media (prefers-reduced-motion: reduce) {
		.digit-column {
			transition: none;
		}
	}
</style>
