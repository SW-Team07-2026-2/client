import { MODE, PUBLIC_API_URL } from '$app/env/public';

const APP_MODES = ['prod', 'dev', 'dev_ai'] as const;
type AppMode = (typeof APP_MODES)[number];

function resolveAppMode(raw: string | undefined): AppMode {
    const value = raw?.trim() ?? '';
    if ((APP_MODES as readonly string[]).includes(value)) {
        return value as AppMode;
    }
    const message = `[config/api] 유효하지 않은 .env MODE 값입니다: "${raw ?? ''}". 허용값: ${APP_MODES.join(' | ')}`;
    console.error(message);
    throw new Error(message);
}

function resolveBaseApiUrl(raw: string | undefined): string {
    const value = raw?.trim() ?? '';
    if (!value) {
        const message = '[config/api] .env의 PUBLIC_API_URL이 설정되지 않았습니다.';
        console.error(message);
        throw new Error(message);
    }
    return value.replace(/\/+$/, '');
}
//===================================================================================================================================

// 로컬 ai개발 url
const AI_LOCALHOST = 'http://localhost:8000';

/** 현재 실행 모드 ('prod' | 'dev' | 'dev_ai') */
export const APP_MODE: AppMode = resolveAppMode(MODE);

/** 기본 API 주소 (항상 PUBLIC_API_URL 사용) */
export const BASE_API_URL: string = resolveBaseApiUrl(PUBLIC_API_URL);

/** AI API 주소 (dev / prod: BASE_API_URL, dev_ai: AI_LOCALHOST) */
export const AI_API_URL: string = APP_MODE === 'dev_ai' ? AI_LOCALHOST : BASE_API_URL;
