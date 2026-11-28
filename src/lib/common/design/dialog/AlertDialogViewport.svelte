<script lang="ts">
	import { alertDialog } from '#lib/common/logic/alertDialog.svelte';
	import AlertDialog from './AlertDialog.svelte';

	const active = $derived(alertDialog.current);
</script>

<!-- 전역 AlertDialog 뷰포트 (ToastViewport와 동일하게 루트 레이아웃에 1회 마운트) -->
{#if active}
	<AlertDialog
		phase={active.phase}
		title={active.title}
		description={active.description}
		confirmText={active.confirmText}
		cancelText={active.cancelText}
		hideCancel={active.hideCancel}
		variant={active.variant}
		from={active.from}
		size={active.size}
		busy={active.busy}
		closeOnOverlay={active.closeOnOverlay}
		closeOnEscape={active.closeOnEscape}
		onConfirm={() => {
			void alertDialog.handleConfirm();
		}}
		onCancel={() => {
			alertDialog.handleCancel();
		}}
	/>
{/if}
