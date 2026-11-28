import { goto } from '$app/navigation';
import { page } from '$app/state';
import { auth } from '#lib/auth/auth.svelte';
import { alertDialog } from '#lib/common/logic/alertDialog.svelte';
import { toast } from '#lib/common/logic/toast.svelte';
import {
	MYPAGE_ROUTE_PATH,
	MYPAGE_SUB_ROUTES,
	parseMyPageSubRoute,
	type MyPageRouteKey
} from '#lib/config/routes';
import { AccountPartController } from './accountPart.svelte';
import { AddressPartController } from './addressPart.svelte';
import { CollectionPartController } from './collectionPart.svelte';
import { OrderPartController } from './orderPart.svelte';
import { TicketPartController } from './ticketPart.svelte';

export type MyPageSectionId = MyPageRouteKey;

export type MyPageNodeId = 'root' | MyPageSectionId;

export interface MyPageTreeNode {
	id: MyPageNodeId;
	label: string;
	href: string;
	description: string;
	parentId: MyPageNodeId | null;
}

export interface MyPageSectionItem extends MyPageTreeNode {
	id: MyPageSectionId;
	parentId: 'root';
}

export const MYPAGE_TREE_NODES: Record<MyPageNodeId, MyPageTreeNode> = {
	root: {
		id: 'root',
		label: '마이페이지',
		href: MYPAGE_ROUTE_PATH,
		description: '내 활동과 설정을 한곳에서 관리하세요.',
		parentId: null
	},
	account: {
		id: 'account',
		label: '계정 관리',
		href: MYPAGE_SUB_ROUTES.account,
		description: '닉네임과 프로필·약관 동의·계정 정보를 관리합니다.',
		parentId: 'root'
	},
	collection: {
		id: 'collection',
		label: '보유 음반',
		href: MYPAGE_SUB_ROUTES.collection,
		description: '보유 중인 실물 앨범(LP·CD·카세트)을 모아봅니다.',
		parentId: 'root'
	},
	order: {
		id: 'order',
		label: '주문 · 배송 내역',
		href: MYPAGE_SUB_ROUTES.order,
		description: '앨범·굿즈 주문 및 배송 현황을 확인합니다.',
		parentId: 'root'
	},
	ticket: {
		id: 'ticket',
		label: '공연 예매 내역',
		href: MYPAGE_SUB_ROUTES.ticket,
		description: '예매한 공연 티켓과 일정을 확인합니다.',
		parentId: 'root'
	},
	address: {
		id: 'address',
		label: '배송지 관리',
		href: MYPAGE_SUB_ROUTES.address,
		description: '자주 사용하는 배송지를 등록·관리합니다.',
		parentId: 'root'
	}
};

export const MYPAGE_ROOT_CHILDREN: readonly MyPageSectionItem[] = [
	MYPAGE_TREE_NODES.account as MyPageSectionItem,
	MYPAGE_TREE_NODES.collection as MyPageSectionItem,
	MYPAGE_TREE_NODES.order as MyPageSectionItem,
	MYPAGE_TREE_NODES.ticket as MyPageSectionItem,
	MYPAGE_TREE_NODES.address as MyPageSectionItem
];

export interface MyPageNavGroup {
	id: string;
	title: string;
	items: readonly MyPageSectionItem[];
}

export const MYPAGE_NAV_GROUPS: readonly MyPageNavGroup[] = [
	{
		id: 'activity',
		title: '내 활동',
		items: [
			MYPAGE_TREE_NODES.account as MyPageSectionItem,
			MYPAGE_TREE_NODES.collection as MyPageSectionItem
		]
	},
	{
		id: 'commerce',
		title: '쇼핑 · 예매',
		items: [
			MYPAGE_TREE_NODES.order as MyPageSectionItem,
			MYPAGE_TREE_NODES.ticket as MyPageSectionItem,
			MYPAGE_TREE_NODES.address as MyPageSectionItem
		]
	}
];

export const DEFAULT_MYPAGE_SECTION_ID: MyPageSectionId = 'account';

/** 모바일에서 다른 카테고리·라우트로 이동했다가 `/mypage`로 돌아올 때 직전 하위 화면을 복원하기 위한 메모리 상태 */
let rememberedMobileSectionId: MyPageSectionId | null = null;

function normalizePathname(pathname?: string | null): string {
	if (!pathname) return '/';
	return pathname.replace(/\/+$/, '') || '/';
}

export interface SyncPathnameOptions {
	mobile?: boolean;
	enteringFromOtherCategory?: boolean;
}

/**
 * 마이페이지 통합 컨트롤러
 * - PC(좌측 사이드바 + 우측 파트)와 모바일(허브 <-> 하위 스택 전환) 상태를 URL(`/mypage/*`)과 양방향 동기화합니다.
 * - 회원 프로필 요약, 로그아웃, 회원탈퇴 등 계정 액션을 전담합니다.
 */
export class MyPageTreeController {
	activeSectionId = $state<MyPageSectionId>(DEFAULT_MYPAGE_SECTION_ID);
	/** 모바일 스택 패널에서 하위 섹션 화면으로 진입했는지 여부 */
	narrowDetailOpen = $state(false);
	loggingOut = $state(false);
	readonly accountCtrl = new AccountPartController();
	readonly collectionCtrl = new CollectionPartController();
	readonly orderCtrl = new OrderPartController();
	readonly ticketCtrl = new TicketPartController();
	readonly addressCtrl = new AddressPartController();

	constructor(mobile = false) {
		this.syncFromPathname(page.url.pathname, {
			mobile,
			enteringFromOtherCategory: true
		});
	}

	get nickname(): string {
		return auth.user?.nickname?.trim() || '회원';
	}

	get currentId(): MyPageNodeId {
		return this.narrowDetailOpen ? this.activeSectionId : 'root';
	}

	get activeSection(): MyPageSectionItem {
		return MYPAGE_TREE_NODES[this.activeSectionId] as MyPageSectionItem;
	}

	get currentNode(): MyPageTreeNode {
		return MYPAGE_TREE_NODES[this.currentId];
	}

	get isRoot(): boolean {
		return !this.narrowDetailOpen;
	}

	/** 현재 URL pathname 기준으로 활성 섹션 및 모바일 스택 상태를 동기화 */
	syncFromPathname = (pathname?: string | null, options?: SyncPathnameOptions): void => {
		const normalized = normalizePathname(pathname);
		const subKey = parseMyPageSubRoute(normalized);
		if (subKey) {
			this.activeSectionId = subKey;
			this.narrowDetailOpen = true;
			rememberedMobileSectionId = subKey;
			return;
		}
		if (normalized === MYPAGE_ROUTE_PATH) {
			if (options?.mobile && options?.enteringFromOtherCategory && rememberedMobileSectionId) {
				this.activeSectionId = rememberedMobileSectionId;
				this.narrowDetailOpen = true;
				return;
			}
			this.narrowDetailOpen = false;
			if (options?.mobile) {
				rememberedMobileSectionId = null;
			}
		}
	};

	/** `/mypage` 루트로 진입·재진입 시 PC는 마지막 선택(또는 기본) 하위 경로, 모바일은 직전 열려 있던 하위 경로로 URL을 replaceState 동기화 */
	ensureSubRouteUrl = (pathname?: string | null, mobile = false): void => {
		if (normalizePathname(pathname) !== MYPAGE_ROUTE_PATH) return;
		if (mobile) {
			if (!this.narrowDetailOpen || !rememberedMobileSectionId) return;
			const targetPath = MYPAGE_SUB_ROUTES[rememberedMobileSectionId];
			void goto(targetPath, { replaceState: true, reset: false });
			return;
		}
		const targetPath = MYPAGE_SUB_ROUTES[this.activeSectionId];
		void goto(targetPath, { replaceState: true, reset: false });
	};

	selectSection = (sectionId: MyPageSectionId): void => {
		this.activeSectionId = sectionId;
		this.narrowDetailOpen = true;
		rememberedMobileSectionId = sectionId;

		const targetPath = MYPAGE_SUB_ROUTES[sectionId];
		if (normalizePathname(page.url.pathname) !== targetPath) {
			void goto(targetPath, { reset: false });
		}
	};

	backToHub = (): void => {
		this.narrowDetailOpen = false;
		rememberedMobileSectionId = null;
		if (normalizePathname(page.url.pathname) !== MYPAGE_ROUTE_PATH) {
			void goto(MYPAGE_ROUTE_PATH, { reset: false });
		}
	};

	resetToRoot = (): void => {
		this.narrowDetailOpen = false;
		this.activeSectionId = DEFAULT_MYPAGE_SECTION_ID;
		rememberedMobileSectionId = null;
	};

	/** 로그아웃 (POST /api/auth/logout -> 첫 화면 이동) */
	handleLogout = async (): Promise<void> => {
		if (this.loggingOut) return;
		this.loggingOut = true;
		try {
			await auth.logout();
			rememberedMobileSectionId = null;
			toast.success('로그아웃되었습니다.');
			await goto('/', { replaceState: true });
		} catch (err) {
			const message =
				err instanceof Error && err.message
					? err.message
					: '로그아웃 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
			toast.error(message);
		} finally {
			this.loggingOut = false;
		}
	};

	/** 회원탈퇴 확인 다이얼로그 (공용 AlertDialog · DELETE /api/members/me -> 첫 화면 이동) */
	openWithdrawModal = (): void => {
		void alertDialog.danger({
			title: '정말 탈퇴하시겠어요?',
			description:
				'탈퇴 시 계정 정보는 즉시 삭제되며 복구할 수 없습니다.\n' +
				'• 결제 전 예매(좌석 선점)는 바로 취소됩니다.\n' +
				'• 결제 완료된 예매 중 회차 시작 24시간 전보다 앞이면 자동 취소 및 전액 환불됩니다.\n' +
				'• 회차 시작 24시간 전부터는 환불 없이 만료되며 입장할 수 없습니다.\n' +
				'• 이미 입장한 예매는 환불되지 않습니다.',
			confirmText: '탈퇴하기',
			cancelText: '취소',
			closeOnOverlay: true,
			onConfirm: async () => {
				try {
					await auth.withdraw();
					toast.success('회원탈퇴가 완료되었습니다.');
					await goto('/', { replaceState: true });
				} catch (err) {
					const message =
						err instanceof Error && err.message
							? err.message
							: '회원탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
					toast.error(message);
					throw err;
				}
			}
		});
	};
}
