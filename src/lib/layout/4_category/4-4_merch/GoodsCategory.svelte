<script lang="ts">
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	let { section, active }: Props = $props();

	const placeholderCards = Array.from({ length: 12 }, (_, idx) => idx + 1);
</script>

<!-- 4_category / goods: 굿즈 특화 그리드 진입점 -->
<section
	class="goods-category"
	data-category="goods"
	data-active={active ? 'true' : 'false'}
	aria-label={section.label}
>
	<div class="goods-grid-shell">
		{#each placeholderCards as card (card)}
			<div class="goods-card-shell">
				<span>굿즈 #{card}</span>
			</div>
		{/each}
	</div>
</section>

<style>
	.goods-category {
		width: 100%;
	}

	.goods-grid-shell {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
		gap: 1.15rem;
	}

	.goods-card-shell {
		aspect-ratio: 1 / 1.2;
		border-radius: 18px;
		background: var(--surface);
		border: var(--thin-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		font-size: 0.88rem;
	}
</style>
