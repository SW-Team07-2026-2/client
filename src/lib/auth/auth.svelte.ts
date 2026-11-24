import { BASE_API_URL } from '#lib/config/api.ts';

/**
 * G3 GET /api/auth/me 응답 타입 (명세서 §1 G3)
 */
export interface AuthMe {
	userId: string; // 문자열 (M1의 userId는 숫자)
	nickname: string | null;
	profileImageUrl: string | null;
	roles: string[]; // ["USER"]
	xsrfToken: string; // 이후 POST · PUT · PATCH · DELETE의 X-XSRF-TOKEN 헤더 값
	stale?: true; // 회원 서비스 장애 시 nickname · profileImageUrl이 null (로그인은 유지)
}

/**
 * 프론트엔드 전역 사용자 상태 인터페이스 (기존 필드 하위 호환 포함)
 */
export interface User extends AuthMe {
	id: string;
	email?: string | null;
	role?: string;
}

/**
 * 공통 응답 봉투 (명세서 §0-4)
 */
export interface ApiEnvelope<T = unknown> {
	isSuccess: boolean;
	code: string;
	message: string;
	result?: T;
	correlationId?: string;
}

/**
 * M24 / M25 약관 코드 (명세서 §2-0)
 */
export type TermsCode = 'AGE14' | 'TOS' | 'PRIVACY' | 'MARKETING' | 'PRIVACY_POLICY';

/**
 * M24 가입 약관 항목 (명세서 §2-6 M24)
 */
export interface TermsItem {
	termsId: number;
	code: TermsCode;
	version: string;
	title: string;
	content: string;
	required: boolean;
}

/**
 * G13 가입 완료 약관 동의 항목 (명세서 §1 G13)
 */
export interface SignupAgreementInput {
	termsId: number;
	agreed: boolean;
}

/**
 * G13 가입 완료 응답 (명세서 §1 G13)
 */
export interface SignupResult {
	userId: number;
	nickname: string;
	newUser: boolean;
}

/** 카카오 로그인 시작 ~ 가입 완료 사이에만 존재하는 sessionStorage 표식 */
export const SIGNUP_FLOW_KEY = 'indig_signup_flow';
/** 약관 동의 결과 (G13 전송용) */
export const SIGNUP_AGREEMENTS_KEY = 'signup_agreements';

/** 가입 진행 상태 정리 (가입 완료 · 만료 · 취소 시) */
export function clearSignupFlow(): void {
	if (typeof window === 'undefined') return;
	sessionStorage.removeItem(SIGNUP_FLOW_KEY);
	sessionStorage.removeItem(SIGNUP_AGREEMENTS_KEY);
}

/** 가입 진행 중인지 (카카오 로그인을 거쳤는지) */
export function isSignupFlowActive(): boolean {
	return typeof window !== 'undefined' && sessionStorage.getItem(SIGNUP_FLOW_KEY) === '1';
}

const STORAGE_KEY_USER = 'indig_user';
const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

class AuthStore {
	user = $state<User | null>(null);
	token = $state<string | null>(null);
	xsrfToken = $state<string | null>(null); // 메모리에만 보관 (명세 및 백엔드 가이드 준수)
	isLoading = $state<boolean>(false);
	isVerified = $state<boolean>(false);
	isLoggedIn = $derived(Boolean(this.user));
	private refreshPromise: Promise<'OK' | 'UNAUTHORIZED' | 'UNAVAILABLE'> | null = null;

	get apiBaseUrl(): string {
		return BASE_API_URL.replace(/\/+$/, '');
	}

	constructor() {
		if (typeof window !== 'undefined') {
			this.captureXsrfFromUrl();
			this.restoreFromStorage();
		}
	}

	/**
	 * 리다이렉트 URL 쿼리(?xsrfToken= 또는 ?xsrf=)로 전달된 CSRF 토큰 자동 추출
	 */
	captureXsrfFromUrl(): void {
		if (typeof window === 'undefined') return;
		const urlParams = new URLSearchParams(window.location.search);
		const urlXsrf = urlParams.get('xsrfToken') || urlParams.get('xsrf');
		if (urlXsrf) {
			this.xsrfToken = urlXsrf;
			urlParams.delete('xsrfToken');
			urlParams.delete('xsrf');
			const cleanQuery = urlParams.toString();
			const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '');
			window.history.replaceState({}, '', cleanUrl);
		}
	}

	/**
	 * 응답 헤더(X-XSRF-TOKEN) 또는 응답 바디에서 xsrfToken을 추출해 메모리에 보관
	 */
	captureXsrfFromResponse(res: Response, body?: any): void {
		const headerXsrf = res.headers.get('X-XSRF-TOKEN') || res.headers.get('x-xsrf-token');
		const bodyXsrf =
			typeof body?.result?.xsrfToken === 'string'
				? body.result.xsrfToken
				: typeof body?.xsrfToken === 'string'
					? body.xsrfToken
					: null;
		const resolved = headerXsrf || bodyXsrf || this.readXsrfCookie();
		if (resolved) {
			this.xsrfToken = resolved;
		}
	}

	/**
	 * 브라우저 쿠키에서 XSRF-TOKEN 값을 읽어옵니다 (동일 도메인 배포 환경용)
	 */
	readXsrfCookie(): string | null {
		if (typeof document === 'undefined') return null;
		const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
		return match ? decodeURIComponent(match[1]) : null;
	}

	/**
	 * 현재 메모리에 보관된 CSRF 토큰(또는 동일 도메인 쿠키) 반환
	 */
	getXsrfToken(): string | null {
		return this.xsrfToken || (this.user?.xsrfToken ? this.user.xsrfToken : null) || this.readXsrfCookie();
	}

	private restoreFromStorage() {
		try {
			const savedUser = localStorage.getItem(STORAGE_KEY_USER);
			const cookieXsrf = this.readXsrfCookie();
			if (cookieXsrf) {
				this.xsrfToken = cookieXsrf;
			}
			if (savedUser) {
				this.user = JSON.parse(savedUser);
				this.token = 'cookie_session';
				if (this.user?.xsrfToken && !this.xsrfToken) {
					this.xsrfToken = this.user.xsrfToken;
				}
			}
		} catch (e) {
			console.error('Failed to restore auth from storage:', e);
			this.clearAuth();
		}
	}

	clearAuth(clearXsrf: boolean = false): void {
		this.token = null;
		this.user = null;
		this.isVerified = false;
		const cookieXsrf = this.readXsrfCookie();
		if (clearXsrf) {
			this.xsrfToken = cookieXsrf;
		} else if (cookieXsrf) {
			this.xsrfToken = cookieXsrf;
		}
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY_USER);
			localStorage.removeItem('indig_xsrf');
			localStorage.removeItem('indig_token');
		}
	}

	private applyAuthMe(raw: Partial<AuthMe> & Record<string, unknown>): User {
		const resolvedXsrf =
			(typeof raw.xsrfToken === 'string' && raw.xsrfToken) ||
			this.readXsrfCookie() ||
			this.xsrfToken ||
			'';
		const userId = String(raw.userId ?? raw.id ?? '');
		const roles = Array.isArray(raw.roles)
			? (raw.roles as string[])
			: typeof raw.role === 'string'
				? [raw.role]
				: ['USER'];

		const userData: User = {
			userId,
			id: userId,
			nickname: typeof raw.nickname === 'string' ? raw.nickname : null,
			profileImageUrl: typeof raw.profileImageUrl === 'string' ? raw.profileImageUrl : null,
			roles,
			xsrfToken: resolvedXsrf,
			...(raw.stale === true ? { stale: true as const } : {}),
			email: typeof raw.email === 'string' ? raw.email : null,
			role: roles[0] ?? 'USER'
		};

		this.user = userData;
		this.token = 'cookie_session';
		if (resolvedXsrf) {
			this.xsrfToken = resolvedXsrf;
		}
		this.isVerified = true;
		clearSignupFlow();

		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
		}

		return userData;
	}

	/**
	 * G1 ✅ 소셜 로그인 시작 (GET /oauth2/authorization/kakao 페이지 이동)
	 */
	startKakaoLogin(): void {
		if (typeof window !== 'undefined') {
			this.isLoading = true;
			// SIGNUP 쿠키는 HttpOnly 라 JS 로 못 읽음 → 카카오 로그인을 거쳐 돌아왔는지 표시
			sessionStorage.setItem(SIGNUP_FLOW_KEY, '1');
			// 로그인 뒤 돌아올 곳 — localhost 는 ?frontend=local, 운영(indig.co.kr)은 파라미터 없음
			const frontend = window.location.hostname === 'localhost' ? '?frontend=local' : '';
			window.location.href = `${this.apiBaseUrl}/oauth2/authorization/kakao${frontend}`;
		}
	}

	/**
	 * 카카오 소셜 로그인 호출 (기존 호출부 호환)
	 */
	async login(): Promise<boolean> {
		this.startKakaoLogin();
		return false;
	}

	/**
	 * G5 ✅ 토큰 재발급 (POST /api/auth/refresh)
	 * - 동시 다발적인 401 응답 시 단일 요청으로 병합(single-flight)하여 RT 중복 사용(REFRESH_REUSED) 방지
	 * - 200: 새 쿠키 발급 -> 'OK'
	 * - 401 REFRESH_INVALID · REFRESH_REUSED: 세션 만료 -> 'UNAUTHORIZED'
	 * - 503: 일시적 장애 (쿠키 유지) -> 'UNAVAILABLE'
	 */
	async refresh(): Promise<'OK' | 'UNAUTHORIZED' | 'UNAVAILABLE'> {
		if (this.refreshPromise) {
			return this.refreshPromise;
		}

		this.refreshPromise = (async () => {
			try {
				const headers: Record<string, string> = {};
				const xsrf = this.getXsrfToken();
				if (xsrf) {
					headers['X-XSRF-TOKEN'] = xsrf;
				}

				const res = await fetch(`${this.apiBaseUrl}/api/auth/refresh`, {
					method: 'POST',
					headers,
					credentials: 'include'
				});

				if (res.ok) {
					this.captureXsrfFromResponse(res);
					return 'OK';
				}

				if (res.status === 503) {
					return 'UNAVAILABLE';
				}

				this.clearAuth();
				return 'UNAUTHORIZED';
			} catch (err) {
				console.warn('Token refresh error:', err);
				return 'UNAVAILABLE';
			} finally {
				this.refreshPromise = null;
			}
		})();

		return this.refreshPromise;
	}

	/**
	 * G3 ✅ 로그인 상태 · 내 정보 · CSRF 토큰 조회 (GET /api/auth/me)
	 * - 비로그인 401은 정상 분기
	 * - 401 수신 시 기존 세션/쿠키 흔적이 있으면 G5(/api/auth/refresh) 1회 시도 후 재요청
	 */
	async checkAuth(allowRefresh: boolean = true): Promise<boolean> {
		try {
			const res = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
				method: 'GET',
				credentials: 'include'
			});

			const body = await res.json().catch(() => null);
			this.captureXsrfFromResponse(res, body);

			if (res.ok) {
				if (!body || (typeof body.isSuccess === 'boolean' && !body.isSuccess)) {
					this.clearAuth();
					return false;
				}

				const rawUser = body.result ?? body;
				if (!rawUser || (!rawUser.userId && !rawUser.id)) {
					this.clearAuth();
					return false;
				}

				this.applyAuthMe(rawUser);
				return true;
			}

			// 401: AT 만료 가능성 -> 기존 로그인 흔적이나 XSRF 쿠키가 있으면 G5 refresh 1회 시도
			if (res.status === 401) {
				const hasSessionHint = Boolean(this.user || this.getXsrfToken());
				if (allowRefresh && hasSessionHint) {
					const refreshResult = await this.refresh();
					if (refreshResult === 'OK') {
						return this.checkAuth(false);
					}
					if (refreshResult === 'UNAVAILABLE') {
						return Boolean(this.user);
					}
				}
				this.clearAuth();
				return false;
			}

			// 503: 서버 일시 장애 시 쿠키 유지 (명세서 §0-6)
			if (res.status === 503 && this.user && this.isVerified) {
				return true;
			}

			this.clearAuth();
			return false;
		} catch (err) {
			console.warn('checkAuth failed or server unreachable:', err);
			this.clearAuth();
			return false;
		}
	}

	/**
	 * G13 ✅ 가입 완료 (POST /api/auth/signup)
	 * - SIGNUP 쿠키 + X-XSRF-TOKEN 헤더 필요
	 * - 토큰이 없으면 가입 요청을 보내지 않고 쿠키 차단·로그인 상태 확인 에러 반환
	 */
	async signup(
		artistIds: number[],
		agreements: SignupAgreementInput[]
	): Promise<SignupResult> {
		const xsrfToken = this.getXsrfToken();
		if (!xsrfToken) {
			throw Object.assign(
				new Error(
					'인증 토큰(X-XSRF-TOKEN)이 없습니다. 쿠키 차단 설정이나 로그인 상태를 확인하거나 페이지를 새로고침해 주세요.'
				),
				{ code: 'CSRF_TOKEN_MISSING', status: 403 }
			);
		}

		const result = await api<SignupResult>('/api/auth/signup', {
			method: 'POST',
			headers: {
				'X-XSRF-TOKEN': xsrfToken
			},
			body: JSON.stringify({ artistIds, agreements })
		});
		clearSignupFlow();
		if (result && result.userId !== undefined) {
			this.applyAuthMe({
				userId: String(result.userId),
				nickname: result.nickname ?? null
			});
		}
		await this.checkAuth(false);
		return result;
	}

	/**
	 * G4 ✅ 로그아웃 (POST /api/auth/logout)
	 * - 만료된 AT로도 호출 가능 · 항상 200 · 쿠키 삭제
	 */
	async logout(): Promise<void> {
		try {
			const headers: Record<string, string> = {};
			const xsrf = this.getXsrfToken();
			if (xsrf) {
				headers['X-XSRF-TOKEN'] = xsrf;
			}

			await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
				method: 'POST',
				headers,
				credentials: 'include'
			});
		} catch (err) {
			console.warn('Logout API call failed:', err);
		} finally {
			this.clearAuth(true);
		}
	}
}

export const auth = new AuthStore();

/**
 * 공통 API 호출 래퍼 (명세서 §0-7 기준)
 * - credentials: 'include' 필수 적용
 * - POST · PUT · PATCH · DELETE 요청 시 X-XSRF-TOKEN 헤더 자동 주입
 * - 401 발생 시 POST /api/auth/refresh (G5) 1회 호출 후 원래 요청 재시도
 * - 403 CSRF_* 발생 시 GET /api/auth/me (G3)로 토큰 갱신 후 1회 재시도
 * - 응답 봉투 { isSuccess, code, message, result, correlationId } 언래핑
 */
export async function api<T = unknown>(
	path: string,
	init: RequestInit = {},
	retried: boolean = false
): Promise<T> {
	const method = (init.method ?? 'GET').toUpperCase();
	const headers = new Headers(init.headers);

	if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	if (MUTATING_METHODS.includes(method)) {
		const xsrf = auth.getXsrfToken();
		if (xsrf) {
			headers.set('X-XSRF-TOKEN', xsrf);
		}
	}

	const url = path.startsWith('http') ? path : `${auth.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
	const res = await fetch(url, {
		...init,
		method,
		headers,
		credentials: 'include'
	});

	if (res.status === 204) {
		return undefined as T;
	}

	const body = await res.json().catch(() => null);
	auth.captureXsrfFromResponse(res, body);

	// Cloudflare 엣지 차단(429 · 403 HTML 응답 등) 처리
	if (!body) {
		const message =
			res.status === 429
				? '요청이 너무 많아요. 잠시 후 다시 시도해 주세요'
				: '요청을 처리하지 못했어요';
		throw Object.assign(new Error(message), {
			code: `EDGE_${res.status}`,
			status: res.status
		});
	}

	// 401: 보호 API 토큰 만료 시 G5(/api/auth/refresh) 1회 시도 후 재요청
	if (res.status === 401 && !retried && path !== '/api/auth/refresh' && path !== '/api/auth/signup') {
		const refreshStatus = await auth.refresh();
		if (refreshStatus === 'OK') {
			return api<T>(path, init, true);
		}
	}

	// 403 CSRF 에러 시 G3(/api/auth/me)로 토큰 재동기화 후 1회 재시도 (명세서 §8-1)
	if (
		res.status === 403 &&
		!retried &&
		typeof body.code === 'string' &&
		body.code.startsWith('CSRF_')
	) {
		const authed = await auth.checkAuth(false);
		if (authed || auth.getXsrfToken()) {
			return api<T>(path, init, true);
		}
	}

	if (!body.isSuccess) {
		throw Object.assign(new Error(body.message || '요청 처리에 실패했습니다.'), {
			...body,
			status: res.status
		});
	}

	return body.result as T;
}

/**
 * M24 GET /api/members/terms — 가입 약관 목록 조회 (공개)
 */
export async function fetchTermsList(): Promise<TermsItem[]> {
	const res = await api<{ items: TermsItem[] }>('/api/members/terms');
	return res?.items ?? [];
}
