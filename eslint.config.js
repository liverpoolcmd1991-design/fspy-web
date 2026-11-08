import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier/flat'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import globals from 'globals'
import { config, configs } from 'typescript-eslint'

const eslintConfig = config(
  {
    name: 'global-ignores',
    ignores: [
      '**/*.snap',
      '**/dist/',
      '**/.yalc/',
      '**/build/',
      '**/temp/',
      '**/.temp/',
      '**/.tmp/',
      '**/.yarn/',
      '**/coverage/',
      'download-stats.js',
      'eslint.config.js',
    ],
  },
  {
    name: `${js.meta.name}/recommended`,
    ...js.configs.recommended,
  },
  configs.strictTypeChecked,
  configs.stylisticTypeChecked,
  {
    name: 'eslint-plugin-react/jsx-runtime',
    ...reactPlugin.configs.flat['jsx-runtime'],
  },
  reactHooksPlugin.configs['recommended-latest'],
  {
    name: 'main',
    linterOptions: {
      reportUnusedDisableDirectives: 2,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      vitest: {
        typecheck: true,
      },
    },
    rules: {
      'no-undef': ['off'],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      '@typescript-eslint/no-inferrable-types': ['off'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_|^React$',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  prettierConfig,

  {
    name: 'Rules not applied in the base repo',
    rules: {
      '@typescript-eslint/consistent-indexed-object-style': ['off'],
      '@typescript-eslint/consistent-type-definitions': ['off'],
      '@typescript-eslint/consistent-type-imports': ['off'],
      '@typescript-eslint/no-confusing-void-expression': ['off'],
      '@typescript-eslint/no-empty-object-type': ['off'],
      '@typescript-eslint/no-explicit-any': ['off'],
      '@typescript-eslint/no-extraneous-class': ['off'],
      '@typescript-eslint/no-misused-spread': ['off'],
      '@typescript-eslint/no-non-null-assertion': ['off'],
      '@typescript-eslint/no-redundant-type-constituents': ['off'],
      '@typescript-eslint/no-unnecessary-condition': ['off'],
      '@typescript-eslint/no-unsafe-argument': ['off'],
      '@typescript-eslint/no-unsafe-assignment': ['off'],
      '@typescript-eslint/no-unsafe-call': ['off'],
      '@typescript-eslint/no-unsafe-enum-assignment': ['off'],
      '@typescript-eslint/no-unsafe-member-access': ['off'],
      '@typescript-eslint/no-unsafe-return': ['off'],
      '@typescript-eslint/no-useless-constructor': ['off'],
      '@typescript-eslint/no-wrapper-object-types': ['off'],
      '@typescript-eslint/non-nullable-type-assertion-style': ['off'],
      '@typescript-eslint/prefer-for-of': ['off'],
      '@typescript-eslint/prefer-includes': ['off'],
      '@typescript-eslint/prefer-nullish-coalescing': ['off'],
      '@typescript-eslint/restrict-plus-operands': ['off'],
      '@typescript-eslint/restrict-template-expressions': ['off'],
      '@typescript-eslint/unbound-method': ['off'],
      'no-case-declarations': ['off'],
      'prefer-const': ['off'],
    },
  },
)

export default eslintConfig
