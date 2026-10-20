import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }]
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: globals.mocha }
  }
];
