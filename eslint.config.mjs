import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { files: ['tests/unit/**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  globalIgnores(['.next/**', 'out/**', '.build/**', 'next-env.d.ts', '.venv/**', 'test-results/**', 'playwright-report/**', 'src/themes/seshat/seshat.d.ts']),
]);
