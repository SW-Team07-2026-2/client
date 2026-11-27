// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			botOpen?: boolean;
			mobileOverlay?: 'chatbot' | 'notifications' | null;
			postcodeModalOpen?: boolean;
		}
		// interface Platform {}
	}
}

export { };
