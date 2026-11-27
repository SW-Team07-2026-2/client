<script lang="ts">
	interface Props {
		size?: number;
		class?: string;
	}

	let { size = 24, class: klass = '' }: Props = $props();

	const rawUid = $props.id();
	const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '');
	const firstId = `pulseDotA_${uid}`;
	const lastId = `pulseDotC_${uid}`;
</script>

<!-- 3-도트 펄스 순차 축소·확대 SVG 로딩 스피너 (무한 스크롤 로딩 등, 순수 렌더링) -->
<svg
	class="indig-pulse-dots-spinner {klass}"
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	aria-hidden="true"
>
	<circle cx="4" cy="12" r="3" fill="currentColor">
		<animate
			id={firstId}
			attributeName="r"
			begin="0;{lastId}.end-0.25s"
			dur="0.75s"
			values="3;.2;3"
		/>
	</circle>
	<circle cx="12" cy="12" r="3" fill="currentColor">
		<animate attributeName="r" begin="{firstId}.end-0.6s" dur="0.75s" values="3;.2;3" />
	</circle>
	<circle cx="20" cy="12" r="3" fill="currentColor">
		<animate
			id={lastId}
			attributeName="r"
			begin="{firstId}.end-0.45s"
			dur="0.75s"
			values="3;.2;3"
		/>
	</circle>
</svg>
