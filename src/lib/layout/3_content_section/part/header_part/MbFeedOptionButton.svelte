<script lang="ts">
	import SpringDropdown, {
		type SpringDropdownOption
	} from '../../../4_category/_shared/design/SpringDropdown.svelte';
	import { FEED_SEGMENT_ITEMS } from '../../logic/contentSection.svelte';

	interface Props {
		/** 현재 선택된 피드 모드 ('recommend' | 'popular' | 'follow' | 'all') */
		feedMode: string;
		/** 상위 헤더 숨김 여부 (숨겨질 때 열려 있던 메뉴 자동 닫힘) */
		hidden?: boolean;
		/** 피드 모드 선택 콜백 */
		onSelect?: (nextMode: string) => void;
	}

	let { feedMode, hidden = false, onSelect }: Props = $props();

	const options = $derived<SpringDropdownOption[]>(
		FEED_SEGMENT_ITEMS.map((item) => ({
			value: item.value,
			label: item.label
		}))
	);

	const resolvedValue = $derived(
		options.some((opt) => opt.value === feedMode) ? feedMode : (options[0]?.value ?? null)
	);
</script>

<!-- 모바일 콘텐츠 헤더 우측 피드 옵션 SpringDropdown (순수 렌더링) -->
<div class="mb-feed-option-wrap">
	<SpringDropdown
		{options}
		value={resolvedValue}
		label="피드 정렬 옵션"
		placeholder="전체"
		compact={true}
		align="right"
		menuWidth="124px"
		forceClose={hidden}
		onSelect={(val) => onSelect?.(String(val))}
	/>
</div>

<style>
	.mb-feed-option-wrap {
		position: relative;
		flex-shrink: 0;
		width: 82px;
	}

	.mb-feed-option-wrap :global(.dd-menu) {
		background: var(--glass-bg);
		-webkit-backdrop-filter: var(--glass-filter);
		backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
	}
</style>
