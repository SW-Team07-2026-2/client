import { api, auth, type TermsCode, type TermsItem } from '#lib/auth/auth.svelte';
import { toast } from '#lib/common/logic/toast.svelte';

export interface MemberProfile {
	userId: number;
	nickname: string;
	profileImageUrl: string | null;
	email: string | null;
	provider: 'KAKAO' | 'GOOGLE' | string;
	followCount: number;
	collectionCount: number;
}

export interface MemberAgreementItem {
	termsId: number;
	code: TermsCode;
	version: string;
	title: string;
	required: boolean;
	agreed: boolean;
	at: string | null;
}

export interface ViewingTermDoc {
	code: TermsCode;
	title: string;
	version: string;
	content: string;
}

interface AgreementsResponse {
	items?: MemberAgreementItem[] | null;
}

interface UpdateNicknameResponse {
	userId: number;
	nickname: string;
}

interface UpdateMarketingResponse {
	agreed: boolean;
	at: string;
}

export function formatAccountDate(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, '.');
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}.${m}.${day}`;
}

export function validateNickname(raw: string): string | null {
	const value = raw.trim();
	if (!value) return '닉네임을 입력해 주세요.';
	if (/\s/.test(value)) return '공백은 사용할 수 없습니다.';
	if (value.length < 2) return '닉네임은 2자 이상이어야 합니다.';
	if (value.length > 10) return '닉네임은 10자 이하로 입력해 주세요.';
	return null;
}

function mapNicknameApiError(err: unknown): string {
	const code = (err as { code?: string })?.code;
	switch (code) {
		case 'NICKNAME_TOO_SHORT':
			return '닉네임은 2자 이상이어야 합니다.';
		case 'NICKNAME_TOO_LONG':
			return '닉네임은 10자 이하로 입력해 주세요.';
		case 'INVALID_NICKNAME':
			return '공백이나 사용할 수 없는 문자가 포함되어 있습니다.';
		default:
			return err instanceof Error && err.message
				? err.message
				: '닉네임 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.';
	}
}

/**
 * 마이페이지 > 프로필 · 계정 관리 파트 컨트롤러
 * - GET /api/members/me (프로필·카운트 조회)
 * - PATCH /api/members/me (닉네임 수정 + 전역 auth.user 동기화)
 * - GET /api/members/me/agreements (약관 동의 이력 조회)
 * - PUT /api/members/me/agreements/marketing (마케팅 수신 동의 ON/OFF)
 * - GET /api/members/terms/{code} (약관 원문 조회 및 캐싱)
 */
export class AccountPartController {
	profile = $state<MemberProfile | null>(null);
	isLoadingProfile = $state(false);
	profileError = $state<string | null>(null);

	nicknameDraft = $state(auth.user?.nickname?.trim() || '');
	nicknameError = $state<string | null>(null);
	isSavingNickname = $state(false);

	agreements = $state<MemberAgreementItem[]>([]);
	isLoadingAgreements = $state(false);
	agreementsError = $state<string | null>(null);
	isUpdatingMarketing = $state(false);

	termDocs = $state<Partial<Record<TermsCode, TermsItem>>>({});
	loadingTermCodes = $state<Partial<Record<TermsCode, boolean>>>({});

	private loaded = false;

	get displayNickname(): string {
		return this.profile?.nickname?.trim() || auth.user?.nickname?.trim() || '회원';
	}

	get displayEmail(): string {
		return this.profile?.email?.trim() || auth.user?.email?.trim() || '';
	}

	get providerLabel(): string {
		const p = this.profile?.provider?.toUpperCase();
		if (p === 'KAKAO') return '카카오 계정';
		if (p === 'GOOGLE') return '구글 계정';
		return p ? `${p} 계정` : '카카오 계정';
	}

	get marketingAgreement(): MemberAgreementItem | null {
		return this.agreements.find((it) => it.code === 'MARKETING') ?? null;
	}

	get policyAgreements(): MemberAgreementItem[] {
		return this.agreements.filter((it) => it.code !== 'MARKETING');
	}

	get isNicknameDirty(): boolean {
		return this.nicknameDraft.trim() !== this.displayNickname;
	}

	/** 최초 1회 또는 강제 새로고침 시 프로필과 약관 동의 이력을 병렬 로드 */
	load = async (force = false): Promise<void> => {
		if (this.loaded && !force) return;
		this.loaded = true;
		await Promise.allSettled([this.fetchProfile(), this.fetchAgreements()]);
	};

	fetchProfile = async (): Promise<void> => {
		if (this.isLoadingProfile) return;
		this.isLoadingProfile = true;
		this.profileError = null;
		try {
			const res = await api<MemberProfile>('/api/members/me');
			if (res) {
				const prevNickname = this.displayNickname;
				this.profile = res;
				if (!this.nicknameDraft || this.nicknameDraft.trim() === prevNickname) {
					this.nicknameDraft = res.nickname ?? '';
				}
			}
		} catch (err) {
			console.error('Failed to load member profile:', err);
			this.profileError = '프로필 정보를 불러오지 못했습니다.';
		} finally {
			this.isLoadingProfile = false;
		}
	};

	fetchAgreements = async (): Promise<void> => {
		if (this.isLoadingAgreements) return;
		this.isLoadingAgreements = true;
		this.agreementsError = null;
		try {
			const res = await api<AgreementsResponse>('/api/members/me/agreements');
			this.agreements = Array.isArray(res?.items) ? res.items : [];
		} catch (err) {
			console.error('Failed to load member agreements:', err);
			this.agreementsError = '약관 동의 내역을 불러오지 못했습니다.';
		} finally {
			this.isLoadingAgreements = false;
		}
	};

	resetNicknameDraft = (): void => {
		if (this.isSavingNickname) return;
		this.nicknameError = null;
		this.nicknameDraft = this.displayNickname;
	};

	setNicknameDraft = (next: string): void => {
		this.nicknameDraft = next;
		if (next.trim() === this.displayNickname) {
			this.nicknameError = null;
		} else if (this.nicknameError) {
			this.nicknameError = validateNickname(next);
		}
	};

	saveNickname = async (): Promise<void> => {
		if (this.isSavingNickname) return;
		const trimmed = this.nicknameDraft.trim();
		const validationError = validateNickname(trimmed);
		if (validationError) {
			this.nicknameError = validationError;
			return;
		}
		if (trimmed === this.displayNickname) {
			this.nicknameError = null;
			return;
		}

		this.isSavingNickname = true;
		this.nicknameError = null;
		try {
			const res = await api<UpdateNicknameResponse>('/api/members/me', {
				method: 'PATCH',
				body: JSON.stringify({ nickname: trimmed })
			});
			const nextName = res?.nickname?.trim() || trimmed;
			if (this.profile) {
				this.profile = { ...this.profile, nickname: nextName };
			}
			if (auth.user) {
				auth.user = { ...auth.user, nickname: nextName };
				if (typeof window !== 'undefined') {
					try {
						localStorage.setItem('indig_user', JSON.stringify(auth.user));
					} catch {
						// ignore storage quota errors
					}
				}
			}
			this.nicknameDraft = nextName;
			toast.success('닉네임이 변경되었습니다.');
		} catch (err) {
			const msg = mapNicknameApiError(err);
			this.nicknameError = msg;
			toast.error(msg);
		} finally {
			this.isSavingNickname = false;
		}
	};

	toggleMarketing = async (): Promise<void> => {
		if (this.isUpdatingMarketing) return;
		const current = this.marketingAgreement;
		const nextAgreed = !(current?.agreed ?? false);

		this.isUpdatingMarketing = true;
		const prevAgreements = this.agreements;
		if (current) {
			this.agreements = this.agreements.map((it) =>
				it.code === 'MARKETING' ? { ...it, agreed: nextAgreed } : it
			);
		}

		try {
			const res = await api<UpdateMarketingResponse>('/api/members/me/agreements/marketing', {
				method: 'PUT',
				body: JSON.stringify({ agreed: nextAgreed })
			});
			const agreed = res?.agreed ?? nextAgreed;
			const at = res?.at ?? new Date().toISOString();
			if (current) {
				this.agreements = this.agreements.map((it) =>
					it.code === 'MARKETING' ? { ...it, agreed, at } : it
				);
			} else {
				await this.fetchAgreements();
			}
			const dateStr = formatAccountDate(at);
			toast.success(
				agreed
					? `마케팅 정보 수신에 동의했습니다. (${dateStr})`
					: `마케팅 정보 수신 동의를 철회했습니다. (${dateStr})`
			);
		} catch (err) {
			console.error('Failed to update marketing agreement:', err);
			this.agreements = prevAgreements;
			toast.error('마케팅 수신 설정 변경에 실패했습니다.');
		} finally {
			this.isUpdatingMarketing = false;
		}
	};

	/** 아코디언 펼침 시 해당 약관 원문(마크다운) 지연 로드 및 캐싱 */
	ensureTermDocument = async (code: TermsCode): Promise<void> => {
		if (this.termDocs[code] || this.loadingTermCodes[code]) return;

		this.loadingTermCodes = { ...this.loadingTermCodes, [code]: true };
		try {
			const doc = await api<TermsItem>(`/api/members/terms/${code}`);
			if (doc) {
				this.termDocs = { ...this.termDocs, [code]: doc };
			}
		} catch (err) {
			console.error('Failed to load term document:', err);
			toast.error('약관 문서를 불러오지 못했습니다.');
		} finally {
			this.loadingTermCodes = { ...this.loadingTermCodes, [code]: false };
		}
	};
}
