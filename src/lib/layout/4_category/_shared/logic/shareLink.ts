import { toast } from '#lib/common/logic';

/**
 * 현재 페이지 URL을 클립보드에 복사하고 결과 토스트를 표시합니다.
 * (아티스트 · 공연 · 앨범 · 굿즈 상세 페이지 공용)
 */
export async function copyCurrentPageLink(successMessage = '링크가 복사되었습니다.'): Promise<void> {
	if (typeof window === 'undefined') return;
	const url = window.location.href;

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
