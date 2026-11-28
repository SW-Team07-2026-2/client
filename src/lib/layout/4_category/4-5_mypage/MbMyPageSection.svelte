<script lang="ts">
	import { CART_ROUTE_PATH } from '#lib/config/routes';
	import {
		MYPAGE_NAV_GROUPS,
		type MyPageSectionId,
		type MyPageTreeController
	} from './logic/myPageTree.svelte';
	import MbStackPanel from './design/MbStackPanel.svelte';
	import AccountPart from './design/part/AccountPart.svelte';
	import CollectionPart from './design/part/CollectionPart.svelte';
	import OrderPart from './design/part/OrderPart.svelte';
	import TicketPart from './design/part/TicketPart.svelte';
	import AddressPart from './design/part/AddressPart.svelte';

	interface Props {
		ctrl: MyPageTreeController;
	}

	let { ctrl }: Props = $props();
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
			mobile={true}
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
			mobile={true}
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
			mobile={true}
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
			mobile={true}
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

<!-- 모바일 전용 마이페이지 섹션: Kokonut UI MbStackPanel + 공용 Part -->
<MbStackPanel
	groups={MYPAGE_NAV_GROUPS}
	activeSectionId={ctrl.activeSectionId}
	detailOpen={ctrl.narrowDetailOpen}
	cartHref={CART_ROUTE_PATH}
	loggingOut={ctrl.loggingOut}
	onSelectSection={ctrl.selectSection}
	onBackToHub={ctrl.backToHub}
	onLogout={ctrl.handleLogout}
>
	{#snippet detailContent({ sectionId })}
		{@render renderPart(sectionId)}
	{/snippet}
</MbStackPanel>
