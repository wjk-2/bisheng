import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}', 'test/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    ignores: ['node_modules', 'dist', 'types', '*.config.js', '*.config.ts']
  }
);
