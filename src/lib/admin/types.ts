// Admin 관련 타입 정의

export interface AdminUser {
	id: string;
	name: string;
	email: string;
	role: string;
}

export interface AdminNavItem {
	href: string;
	label: string;
	icon?: string;
	exact?: boolean;
	description?: string;
}

