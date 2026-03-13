import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "."),
		},
	},
	test: {
		globals: true,
		include: ["src/__tests__/**/*.test.ts"],
	},
});
