<script lang="ts">
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	let { section, active }: Props = $props();

	const placeholderCards = Array.from({ length: 12 }, (_, idx) => idx + 1);
</script>

<!-- 4_category / album: 앨범·LP 특화 그리드 진입점 -->
<section
	class="album-category"
	data-category="album"
	data-active={active ? 'true' : 'false'}
	aria-label={section.label}
>
	<div class="album-grid-shell">
		{#each placeholderCards as card (card)}
			<div class="album-card-shell">
				<span>앨범 #{card}</span>
			</div>
		{/each}
	</div>
</section>

<style>
	.album-category {
		width: 100%;
	}

	.album-grid-shell {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
		gap: 1.15rem;
	}

	.album-card-shell {
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
