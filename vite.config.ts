import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Builds a single ES module + one stylesheet into dist/. `public/` (module.json, lang/)
// is copied into dist/ unchanged, so dist/ is a complete Foundry module folder that can
// be symlinked into Data/modules/nimble-hud.
export default defineConfig({
	plugins: [svelte()],
	publicDir: 'public',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: true,
		minify: false,
		cssCodeSplit: false,
		lib: {
			entry: 'src/main.ts',
			formats: ['es'],
			fileName: () => 'nimble-hud.js',
			cssFileName: 'nimble-hud',
		},
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
	},
});
