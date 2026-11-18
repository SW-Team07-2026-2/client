import {
    PUBLIC_API_URL
} from '$app/env/public';

// 기본 API 주소
export const BASE_API_URL: string = (PUBLIC_API_URL && PUBLIC_API_URL.trim() !== '') ? PUBLIC_API_URL : "http://localhost:8080";

export const CHAT_AI_API_URL: string = "http://localhost:8000/api/chatbot"; //`${BASE_API_URL.replace(/\/+$/, '')}/api/chatbot/chat`;
export const RECOMMEND_API_URL: string = "http://localhost:8000";



