import { goto } from '$app/navigation';
import { auth } from '#lib/auth/auth.svelte';
import { toast } from '#lib/common/logic/toast.svelte';

export type MyPageNodeId =
	| 'root'
	| 'profile'
	| 'following'
	| 'wishlist'
	| 'tickets'
	| 'orders'
	| 'settings';

export interface MyPageTreeNode {
	id: MyPageNodeId;
	label: string;
	description: string;
	parentId: MyPageNodeId | null;
}

export const MYPAGE_TREE_NODES: Record<MyPageNodeId, MyPageTreeNode> = {
	root: {
		id: 'root',
		label: '마이페이지',
		description: '내 활동과 설정을 한곳에서 관리하세요.',
		parentId: null
	},
	profile: {
		id: 'profile',
		label: '프로필 관리',
		description: '닉네임과 프로필 정보를 확인·수정합니다.',
		parentId: 'root'
	},
	following: {
		id: 'following',
		label: '팔로우 아티스트',
		description: '팔로우 중인 인디 아티스트 목록을 관리합니다.',
		parentId: 'root'
	},
	wishlist: {
		id: 'wishlist',
		label: '관심 목록',
		description: '찜한 공연·앨범·굿즈를 모아봅니다.',
		parentId: 'root'
	},
	tickets: {
		id: 'tickets',
		label: '예매 내역',
		description: '예매한 공연 티켓과 일정을 확인합니다.',
		parentId: 'root'
	},
	orders: {
		id: 'orders',
		label: '주문 / 배송',
		description: '앨범·굿즈 주문 및 배송 현황을 확인합니다.',
		parentId: 'root'
	},
	settings: {
		id: 'settings',
		label: '환경 설정',
		description: '알림·계정·서비스 설정을 관리합니다.',
		parentId: 'root'
	}
};

export const MYPAGE_ROOT_CHILDREN: readonly MyPageTreeNode[] = [
	MYPAGE_TREE_NODES.profile,
	MYPAGE_TREE_NODES.following,
	MYPAGE_TREE_NODES.wishlist,
	MYPAGE_TREE_NODES.tickets,
	MYPAGE_TREE_NODES.orders,
	MYPAGE_TREE_NODES.settings
];

/**
 * 마이페이지 트리 네비게이션 컨트롤러
 * - 허브(root)에서 하위 상세 옵션 노드로 단계적으로 진입·복귀할 수 있는 스택 기반 상태를 관리합니다.
 */
export class MyPageTreeController {
	pathStack = $state<MyPageNodeId[]>(['root']);
	withdrawModalOpen = $state(false);
	withdrawing = $state(false);

	get currentId(): MyPageNodeId {
		return this.pathStack[this.pathStack.length - 1] ?? 'root';
	}

	get currentNode(): MyPageTreeNode {
		return MYPAGE_TREE_NODES[this.currentId];
	}

	get isRoot(): boolean {
		return this.pathStack.length <= 1;
	}

	get breadcrumbs(): MyPageTreeNode[] {
		return this.pathStack.map((id) => MYPAGE_TREE_NODES[id]);
	}

	pushNode = (nodeId: MyPageNodeId): void => {
		if (this.currentId === nodeId) return;
		this.pathStack = [...this.pathStack, nodeId];
	};

	popNode = (): void => {
		if (this.pathStack.length <= 1) return;
		this.pathStack = this.pathStack.slice(0, -1);
	};

	jumpToDepth = (index: number): void => {
		if (index < 0 || index >= this.pathStack.length) return;
		this.pathStack = this.pathStack.slice(0, index + 1);
	};

	resetToRoot = (): void => {
		if (this.pathStack.length === 1 && this.pathStack[0] === 'root') return;
		this.pathStack = ['root'];
	};

	/** 회원탈퇴 확인 모달 열기 */
	openWithdrawModal = (): void => {
		this.withdrawModalOpen = true;
	};

	/** 회원탈퇴 확인 모달 닫기 */
	closeWithdrawModal = (): void => {
		if (this.withdrawing) return;
		this.withdrawModalOpen = false;
	};

	/** 회원탈퇴 확정 (DELETE /api/members/me -> 세션/CSRF 정리 -> 첫 화면 이동) */
	confirmWithdraw = async (): Promise<void> => {
		if (this.withdrawing) return;
		this.withdrawing = true;
		try {
			await auth.withdraw();
			this.withdrawModalOpen = false;
			toast.success('회원탈퇴가 완료되었습니다.');
			await goto('/', { replaceState: true });
		} catch (err) {
			const message =
				err instanceof Error && err.message
					? err.message
					: '회원탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
			toast.error(message);
		} finally {
			this.withdrawing = false;
		}
	};
}
