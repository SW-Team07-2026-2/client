<script lang="ts">
	import { onMount } from 'svelte';
	import { Tabs, TabsContent, TabsContents } from '#lib/common/design/tabs';
	import { ALERT_ROUTE_PATH, CART_ROUTE_PATH } from '#lib/config/routes';
	import {
		MYPAGE_NAV_GROUPS,
		MYPAGE_ROOT_CHILDREN,
		type MyPageSectionId,
		type MyPageTreeController
	} from './logic/myPageTree.svelte';
	import PcSidebar from './design/PcSidebar.svelte';
	import AccountPart from './design/part/AccountPart.svelte';
	import CollectionPart from './design/part/CollectionPart.svelte';
	import OrderPart from './design/part/OrderPart.svelte';
	import TicketPart from './design/part/TicketPart.svelte';
	import AddressPart from './design/part/AddressPart.svelte';

	interface Props {
		ctrl: MyPageTreeController;
	}

	let { ctrl }: Props = $props();

	const MYPAGE_SECTION_ORDER = MYPAGE_ROOT_CHILDREN.map((item) => item.id);
	// 첫 진입 페인트를 막지 않도록 150ms 유휴 시간 뒤 나머지 하위 파트 DOM을 미리 마운트
	let prewarmAllParts = $state(false);

	onMount(() => {
		const timer = setTimeout(() => {
			prewarmAllParts = true;
		}, 150);
		return () => clearTimeout(timer);
	});
</script>

{#snippet renderPart(sectionId: MyPageSectionId)}
	{#if sectionId === 'account'}
		<AccountPart
			email={ctrl.accountCtrl.displayEmail}
			providerLabel={ctrl.accountCtrl.providerLabel}
			followCount={ctrl.accountCtrl.profile?.followCount ?? null}
			collectionCount={ctrl.accountCtrl.profile?.collectionCount ?? null}
			isLoadingProfile={ctrl.accountCtrl.isLoadingProfile}
			profileError={ctrl.accountCtrl.profileError}
			nicknameDraft={ctrl.accountCtrl.nicknameDraft}
			isNicknameDirty={ctrl.accountCtrl.isNicknameDirty}
			nicknameError={ctrl.accountCtrl.nicknameError}
			isSavingNickname={ctrl.accountCtrl.isSavingNickname}
			marketingAgreement={ctrl.accountCtrl.marketingAgreement}
			policyAgreements={ctrl.accountCtrl.policyAgreements}
			isLoadingAgreements={ctrl.accountCtrl.isLoadingAgreements}
			agreementsError={ctrl.accountCtrl.agreementsError}
			isUpdatingMarketing={ctrl.accountCtrl.isUpdatingMarketing}
			termDocs={ctrl.accountCtrl.termDocs}
			loadingTermCodes={ctrl.accountCtrl.loadingTermCodes}
			onResetNickname={ctrl.accountCtrl.resetNicknameDraft}
			onNicknameDraftChange={ctrl.accountCtrl.setNicknameDraft}
			onSaveNickname={ctrl.accountCtrl.saveNickname}
			onToggleMarketing={ctrl.accountCtrl.toggleMarketing}
			onLoadTerm={ctrl.accountCtrl.ensureTermDocument}
			onRetryLoad={() => void ctrl.accountCtrl.load(true)}
			onOpenWithdraw={ctrl.openWithdrawModal}
		/>
	{:else if sectionId === 'collection'}
		<CollectionPart
			mobile={false}
			groups={ctrl.collectionCtrl.groupedAlbums}
			totalCount={ctrl.collectionCtrl.totalCount}
			isLoading={ctrl.collectionCtrl.isLoading}
			isLoadingMore={ctrl.collectionCtrl.isLoadingMore}
			hasNext={ctrl.collectionCtrl.hasNext}
			errorMessage={ctrl.collectionCtrl.errorMessage}
			onSelectAlbum={ctrl.collectionCtrl.selectAlbum}
			onLoadMore={() => void ctrl.collectionCtrl.loadMore()}
			onRetry={() => void ctrl.collectionCtrl.load(true)}
			onBrowseAlbums={ctrl.collectionCtrl.browseAlbums}
		/>
	{:else if sectionId === 'order'}
		<OrderPart
			mobile={false}
			orders={ctrl.orderCtrl.orders}
			totalCount={ctrl.orderCtrl.orders.length}
			filterTabs={ctrl.orderCtrl.filterTabs}
			activeFilter={ctrl.orderCtrl.activeFilter}
			detailsById={ctrl.orderCtrl.detailsById}
			loadingDetailIds={ctrl.orderCtrl.loadingDetailIds}
			productsById={ctrl.orderCtrl.productsById}
			expandedOrderId={ctrl.orderCtrl.expandedOrderId}
			isLoading={ctrl.orderCtrl.isLoading}
			isLoadingMore={ctrl.orderCtrl.isLoadingMore}
			hasNext={ctrl.orderCtrl.hasNext}
			cancellingOrderId={ctrl.orderCtrl.cancellingOrderId}
			errorMessage={ctrl.orderCtrl.errorMessage}
			onSelectFilter={ctrl.orderCtrl.setFilter}
			onToggleExpand={ctrl.orderCtrl.toggleExpand}
			onCancelOrder={ctrl.orderCtrl.confirmCancel}
			onOpenProduct={ctrl.orderCtrl.openProduct}
			onLoadMore={() => void ctrl.orderCtrl.loadMore()}
			onRetry={() => void ctrl.orderCtrl.load(true)}
			onBrowseStore={ctrl.orderCtrl.browseStore}
		/>
	{:else if sectionId === 'ticket'}
		<TicketPart
			mobile={false}
			bookings={ctrl.ticketCtrl.bookings}
			totalCount={ctrl.ticketCtrl.bookings.length}
			filterTabs={ctrl.ticketCtrl.filterTabs}
			activeFilter={ctrl.ticketCtrl.activeFilter}
			detailsById={ctrl.ticketCtrl.detailsById}
			loadingDetailIds={ctrl.ticketCtrl.loadingDetailIds}
			expandedBookingId={ctrl.ticketCtrl.expandedBookingId}
			serverNowMs={ctrl.ticketCtrl.serverNowMs}
			qrBookingId={ctrl.ticketCtrl.qrBookingId}
			qrToken={ctrl.ticketCtrl.qrToken}
			qrExpiresAt={ctrl.ticketCtrl.qrExpiresAt}
			qrLoading={ctrl.ticketCtrl.qrLoading}
			qrError={ctrl.ticketCtrl.qrError}
			isLoading={ctrl.ticketCtrl.isLoading}
			isLoadingMore={ctrl.ticketCtrl.isLoadingMore}
			hasNext={ctrl.ticketCtrl.hasNext}
			cancellingBookingId={ctrl.ticketCtrl.cancellingBookingId}
			errorMessage={ctrl.ticketCtrl.errorMessage}
			onSelectFilter={ctrl.ticketCtrl.setFilter}
			onToggleExpand={ctrl.ticketCtrl.toggleExpand}
			onRetryQr={ctrl.ticketCtrl.retryEntryQr}
			onCancelBooking={ctrl.ticketCtrl.confirmCancel}
			onOpenConcert={ctrl.ticketCtrl.openConcert}
			onLoadMore={() => void ctrl.ticketCtrl.loadMore()}
			onRetry={() => void ctrl.ticketCtrl.load(true)}
			onBrowseConcerts={ctrl.ticketCtrl.browseConcerts}
		/>
	{:else}
		<AddressPart
			mobile={false}
			addresses={ctrl.addressCtrl.addresses}
			isLoading={ctrl.addressCtrl.isLoading}
			errorMessage={ctrl.addressCtrl.errorMessage}
			editingId={ctrl.addressCtrl.editingId}
			label={ctrl.addressCtrl.label}
			shipping={ctrl.addressCtrl.shipping}
			setAsDefault={ctrl.addressCtrl.setAsDefault}
			validationError={ctrl.addressCtrl.validationError}
			isSaving={ctrl.addressCtrl.isSaving}
			isLimitReached={ctrl.addressCtrl.isLimitReached}
			onUpdateLabel={ctrl.addressCtrl.updateLabel}
			onUpdateField={ctrl.addressCtrl.updateField}
			onSearchAddress={ctrl.addressCtrl.searchAddress}
			onToggleDefault={ctrl.addressCtrl.toggleSetAsDefault}
			onStartEdit={ctrl.addressCtrl.startEdit}
			onCancelEdit={ctrl.addressCtrl.cancelEdit}
			onSubmit={() => void ctrl.addressCtrl.submitForm()}
			onDelete={ctrl.addressCtrl.confirmDelete}
			onReorder={(fromIdx, toIdx, commit) => void ctrl.addressCtrl.reorder(fromIdx, toIdx, commit)}
			onNudgePosition={ctrl.addressCtrl.nudgePosition}
			onRetry={() => void ctrl.addressCtrl.load(true)}
		/>
	{/if}
{/snippet}

<!-- PC 전용 마이페이지 섹션: 좌측 Animate UI Docs 스타일 PcSidebar + 우측 공용 Part -->
<div class="pc-mypage-layout">
	<PcSidebar
		groups={MYPAGE_NAV_GROUPS}
		activeSectionId={ctrl.activeSectionId}
		cartHref={CART_ROUTE_PATH}
		alertHref={ALERT_ROUTE_PATH}
		loggingOut={ctrl.loggingOut}
		onSelectSection={ctrl.selectSection}
		onLogout={ctrl.handleLogout}
	/>

	<div class="pc-mypage-stage">
		<Tabs
			value={ctrl.activeSectionId}
			orientation="vertical"
			order={MYPAGE_SECTION_ORDER}
			class="pc-mypage-tabs"
		>
			<TabsContents>
				{#each MYPAGE_ROOT_CHILDREN as item (item.id)}
					{#if prewarmAllParts || ctrl.activeSectionId === item.id}
						<TabsContent
							value={item.id}
							keepAlive={true}
							slideDistance={14}
							class="pc-mypage-part-frame"
						>
							{@render renderPart(item.id)}
						</TabsContent>
					{/if}
				{/each}
			</TabsContents>
		</Tabs>
	</div>
</div>

<style>
	.pc-mypage-layout {
		display: grid;
		grid-template-columns: 236px minmax(0, 1fr);
		gap: 1.75rem;
		align-items: start;
		width: 100%;
	}

	.pc-mypage-stage {
		min-width: 0;
		min-height: 380px;
		padding: 0.25rem 0.25rem 1.5rem;
	}

	.pc-mypage-part-frame {
		width: 100%;
	}
</style>
