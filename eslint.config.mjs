import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-electron', 'release', 'build', 'node_modules'] },

  // Renderer: browser globals, React hook rules.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  // Main process and shared logic: Node globals.
  {
    files: ['electron/**/*.ts', 'shared/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // The Electron smoke test and the build hook are CommonJS scripts.
  {
    files: ['**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
  },
);
