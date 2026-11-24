import type { ClientInit } from '@sveltejs/kit/hooks';
import { initAnalytics } from '#lib/common/logic/analytics';

export const init: ClientInit = () => {
	initAnalytics();
};
