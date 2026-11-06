import age14Content from './age14.md?raw';
import tosContent from './tos.md?raw';
import privacyContent from './privacy.md?raw';
import marketingContent from './marketing.md?raw';
import { api } from '#lib/auth';

export type TermsCode = 'AGE14' | 'TOS' | 'PRIVACY' | 'MARKETING';

export interface TermsItem {
	termsId: number;
	code: TermsCode;
	version: string;
	title: string;
	content: string;
	required: boolean;
}

/**
 * 로컬 폴더(src/lib/terms/*.md)에서 불러온 기본 약관 목록
 * (M24 기본 규격 호환)
 */
export const LOCAL_TERMS: TermsItem[] = [
	{
		termsId: 1,
		code: 'AGE14',
		version: 'v1',
		title: '만 14세 이상입니다',
		content: age14Content,
		required: true
	},
	{
		termsId: 2,
		code: 'TOS',
		version: 'v1',
		title: '이용약관 동의',
		content: tosContent,
		required: true
	},
	{
		termsId: 3,
		code: 'PRIVACY',
		version: 'v1',
		title: '개인정보 수집 및 이용 동의',
		content: privacyContent,
		required: true
	},
	{
		termsId: 4,
		code: 'MARKETING',
		version: 'v1',
		title: '마케팅 정보 수신 동의',
		content: marketingContent,
		required: false
	}
];

/**
 * M24 GET /api/members/terms 호출
 * - 백엔드에서 약관 목록을 가져오며, 네트워크 에러 또는 서버 오프라인 시 로컬 문서 목록으로 안전하게 fallback합니다.
 */
export async function fetchTermsList(): Promise<TermsItem[]> {
	try {
		const res = await api<{ items: TermsItem[] }>('/api/members/terms');
		if (res && Array.isArray(res.items) && res.items.length > 0) {
			return res.items;
		}
	} catch (err) {
		console.warn('Failed to fetch terms from API, using local terms:', err);
	}
	return LOCAL_TERMS;
}

