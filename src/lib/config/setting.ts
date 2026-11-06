import {
    PUBLIC_API_URL
} from '$app/env/public';

// 기본 API 주소 (환경 변수가 있으면 우선 적용, 없으면 로컬 기본값)
export const API_URL: string = (PUBLIC_API_URL && PUBLIC_API_URL.trim() !== '')
    ? PUBLIC_API_URL
    : "http://localhost:8080";
export const CHAT_AI_API_URL: string = "http://localhost:8000";


