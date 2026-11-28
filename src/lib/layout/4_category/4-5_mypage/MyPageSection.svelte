<script lang="ts">
	import { untrack } from 'svelte';
	import { preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import { isMobile } from '#lib/common/logic';
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';
	import { albumDetailState } from '../4-3_album/logic/albumDetailState.svelte';
	import { MyPageTreeController } from './logic/myPageTree.svelte';
	import PcMyPageSection from './PcMyPageSection.svelte';
	import MbMyPageSection from './MbMyPageSection.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	let { section, active }: Props = $props();

	const ctrl = new MyPageTreeController(untrack(() => isMobile.current));
	let wasActive = false;
	let didPreloadSubParts = false;

	$effect.pre(() => {
		const isNowActive = active;
		const entering = isNowActive && !wasActive;
		wasActive = isNowActive;
		ctrl.syncFromPathname(page.url.pathname, {
			mobile: isMobile.current,
			enteringFromOtherCategory: entering
		});
	});

	$effect(() => {
		if (!active) return;
		ctrl.ensureSubRouteUrl(page.url.pathname, isMobile.current);
	});

	$effect(() => {
		// 앨범 상세에서 보유 음반이 변경되었을 때 마이페이지 진입·활성 상태에서 즉시 재조회하도록 추적
		const rev = albumDetailState.collectionRevision;
		if (!active) return;
		if (isMobile.current && !ctrl.narrowDetailOpen) return;

		const sectionId = ctrl.activeSectionId;
		untrack(() => {
			if (sectionId === 'account') {
				void ctrl.accountCtrl.load(rev > 0);
			} else if (sectionId === 'collection') {
				void ctrl.collectionCtrl.load();
			} else if (sectionId === 'order') {
				void ctrl.orderCtrl.load();
			} else if (sectionId === 'ticket') {
				void ctrl.ticketCtrl.load();
			} else if (sectionId === 'address') {
				void ctrl.addressCtrl.load();
			}
		});
	});

	$effect(() => {
		const isTicketVisible =
			active && ctrl.activeSectionId === 'ticket' && (!isMobile.current || ctrl.narrowDetailOpen);
		if (!isTicketVisible) {
			untrack(() => ctrl.ticketCtrl.deactivate());
			return;
		}
		untrack(() => ctrl.ticketCtrl.activate());
		return () => {
			ctrl.ticketCtrl.deactivate();
		};
	});

	const MYPAGE_SUB_ROUTE_IDS = [
		'/(user)/mypage/account',
		'/(user)/mypage/collection',
		'/(user)/mypage/order',
		'/(user)/mypage/ticket',
		'/(user)/mypage/address'
	] as const;

	// 마이페이지 첫 진입 후 유휴 시간에 하위 라우트 청크 + 나머지 파트 목록 데이터를 백그라운드 프리로드
	$effect(() => {
		if (!active || didPreloadSubParts) return;
		didPreloadSubParts = true;

		const timer = setTimeout(() => {
			for (const routeId of MYPAGE_SUB_ROUTE_IDS) {
				void preloadCode(routeId);
			}
			void ctrl.accountCtrl.load();
			void ctrl.collectionCtrl.load();
			void ctrl.orderCtrl.load();
			void ctrl.ticketCtrl.load();
			void ctrl.addressCtrl.load();
		}, 300);

		return () => clearTimeout(timer);
	});
</script>

<!-- 4_category / 4-5_mypage 진입점(Shell): 디바이스 판별에 따라 PcMyPageSection · MbMyPageSection 조립 -->
<section
	class="mypage-section-root"
	data-category="mypage"
	data-node={ctrl.currentId}
	data-active={active ? 'true' : 'false'}
	aria-label={section.label}
>
	{#if isMobile.current}
		<MbMyPageSection {ctrl} />
	{:else}
		<PcMyPageSection {ctrl} />
	{/if}
</section>

<style>
	.mypage-section-root {
		width: 100%;
	}
</style>
