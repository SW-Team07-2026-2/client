import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	MODE: {
		public: true,
		static: true
	},
	PUBLIC_API_URL: {
		public: true,
		static: true
	}
});
