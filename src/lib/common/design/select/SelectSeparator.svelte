<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: klass = '' }: Props = $props();
</script>

<div role="separator" data-slot="select-separator" class="aui-select-separator {klass}"></div>

<style>
	.aui-select-separator {
		height: 1px;
		margin: 0.25rem 0.2rem;
		background: color-mix(in srgb, var(--white) 10%, transparent);
		pointer-events: none;
	}
</style>
