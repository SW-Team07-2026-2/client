import { toast } from '#lib/common/logic';

export interface SharePageOptions {
	/** OS 공유 시트에 표시할 제목 */
	title?: string;
	/** OS 공유 시트에 함께 전달할 설명 문구 */
	text?: string;
	/** 공유할 URL (미지정 시 현재 페이지 URL) */
	url?: string;
	/** Web Share API 미지원 환경에서 클립보드 복사 폴백 시 표시할 토스트 메시지 */
	fallbackSuccessMessage?: string;
}

/**
 * 현재 페이지 URL을 클립보드에 복사하고 결과 토스트를 표시합니다.
 */
export async function copyCurrentPageLink(
	successMessage = '링크가 복사되었습니다.',
	targetUrl?: string
): Promise<void> {
	if (typeof window === 'undefined') return;
	const url = targetUrl ?? window.location.href;

	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(url);
			toast.success(successMessage);
			return;
		}
	} catch {
		// 클립보드 API 실패 시 폴백 시도
	}

	try {
		const input = document.createElement('input');
		input.value = url;
		document.body.appendChild(input);
		input.select();
		document.execCommand('copy');
		document.body.removeChild(input);
		toast.success(successMessage);
	} catch {
		toast.error('링크를 복사하지 못했습니다.');
	}
}

/**
 * 운영체제 네이티브 공유 시트(Web Share API)를 우선 실행하고,
 * 미지원 브라우저/환경에서는 클립보드 복사 + 토스트로 폴백합니다.
 * (아티스트 · 공연 · 앨범 · 굿즈 상세 페이지 공용)
 */
export async function shareCurrentPage(options: SharePageOptions = {}): Promise<void> {
	if (typeof window === 'undefined') return;
	const url = options.url ?? window.location.href;
	const title = options.title?.trim() || document.title || 'INDIG';
	const text = options.text?.trim() || undefined;
	const fallbackMessage = options.fallbackSuccessMessage ?? '링크가 복사되었습니다.';

	if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
		const shareData: ShareData = text ? { title, text, url } : { title, url };
		try {
			if (typeof navigator.canShare !== 'function' || navigator.canShare(shareData)) {
				await navigator.share(shareData);
				return;
			}
		} catch (err) {
			// 사용자가 OS 공유 시트를 직접 닫은 경우(AbortError)는 조용히 종료
			if (err instanceof DOMException && err.name === 'AbortError') {
				return;
			}
			// 그 외 실행 실패 시 클립보드 복사로 폴백
		}
	}

	await copyCurrentPageLink(fallbackMessage, url);
}
