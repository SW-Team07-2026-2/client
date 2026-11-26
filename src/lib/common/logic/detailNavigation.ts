import { goto } from '$app/navigation';
import type { CatalogCategoryKey } from '#lib/common/catalog/catalogFeed';
import { isMobile } from './isMobile.svelte';
import { detailOverlay, parseCatalogDetailRoute } from './detailOverlayState.svelte';

function normalizePath(pathname?: string | null): string {
	if (!pathname) return '';
	return pathname.replace(/\/+$/, '') || '/';
}

/**
 * 상세 페이지 내부 링크/버튼에서 다른 상세 페이지로 이동할 때의 플랫폼별 내비게이션 정책
 * - PC: 상세 히스토리에 기록(markInDetailJump) + 브라우저 히스토리 push ('이전' 버튼으로 직전 상세 복귀)
 * - 모바일: 상세 히스토리 미기록 + replaceState로 이동 (항상 현재 카테고리 목록으로 단번에 복귀)
 */
export function navigateDetailToDetail(targetPath: string): void {
	const normalized = normalizePath(targetPath);
	if (!normalized) return;

	if (isMobile.current) {
		void goto(normalized, { reset: false, replaceState: true });
		return;
	}

	detailOverlay.markInDetailJump(normalized);
	void goto(normalized, { reset: false });
}

export interface CloseDetailStageOptions {
	category: CatalogCategoryKey;
	mobile: boolean;
	returnPath: string | null;
	enteredFromOwnList: boolean;
}

/**
 * 상세 페이지 상단 닫기/이전 버튼(및 PC ESC) 클릭 시 플랫폼별 복귀 정책
 * - 모바일: 항상 현재 보고 있는 카테고리의 목록(`/${category}`)으로 복귀
 *   (자기 목록에서 바로 들어온 경우에만 history.back()으로 중복 히스토리 방지)
 * - PC: 직전 상세(returnPath)가 있으면 history.back()으로 복귀, 없으면 현재 카테고리 목록으로 이동
 */
export function closeDetailStage(opts: CloseDetailStageOptions): void {
	const listPath = `/${opts.category}`;

	if (opts.mobile) {
		if (opts.enteredFromOwnList && typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
			return;
		}
		void goto(listPath, { reset: false, replaceState: true });
		return;
	}

	if (opts.returnPath) {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
			return;
		}
		void goto(opts.returnPath, { reset: false });
		return;
	}

	void goto(listPath, { reset: false });
}

const MOBILE_HOME_LIST_PATH = '/artist';
const MOBILE_NON_HOME_LIST_PATHS = new Set(['/concert', '/album', '/goods', '/mypage']);

/**
 * 모바일 브라우저/OS 뒤로가기(popstate) 시 복귀 목적지를 보정합니다.
 * 1) 상세 페이지에서 뒤로가기 -> 항상 현재 보고 있는 카테고리의 목록(`/${category}`)으로 복귀
 * 2) 아티스트 외 목록/메인 탭(`/concert`, `/album`, `/goods`, `/mypage`)에서 뒤로가기 -> 항상 아티스트 목록(`/artist`)으로 복귀
 * 3) 이미 목표 경로로 정상 이동 중이거나 `/artist` 목록·외부 이탈인 경우 null 반환
 */
export function resolveMobilePopstateRedirect(
	fromPath?: string | null,
	toPath?: string | null
): string | null {
	if (!isMobile.current) return null;

	const normalizedFrom = normalizePath(fromPath);
	const normalizedTo = normalizePath(toPath);
	if (!normalizedFrom) return null;

	// 1) 상세 페이지 -> 현재 카테고리 목록으로 복귀
	const fromDetail = parseCatalogDetailRoute(normalizedFrom);
	if (fromDetail) {
		const targetListPath = `/${fromDetail.category}`;
		return normalizedTo === targetListPath ? null : targetListPath;
	}

	// 2) 아티스트 외 목록/메인 탭 -> 아티스트 목록(`/artist`)으로 복귀
	if (MOBILE_NON_HOME_LIST_PATHS.has(normalizedFrom)) {
		if (!normalizedTo || normalizedTo === MOBILE_HOME_LIST_PATH) return null;
		return MOBILE_HOME_LIST_PATH;
	}

	return null;
}
