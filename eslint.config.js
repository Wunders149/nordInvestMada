import globals from 'globals';

export default [
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'uploads/', 'data/', 'public/locales/']
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      semi: ['warn', 'always'],
      quotes: ['warn', 'single', { avoidEscape: true }],
      'no-var': 'warn',
      'prefer-const': 'warn'
    }
  },
  {
    files: ['public/admin/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        gtag: 'readonly',
        L: 'readonly',
        dataLayer: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      semi: ['warn', 'always'],
      quotes: ['warn', 'single', { avoidEscape: true }],
      'no-var': 'warn',
      'prefer-const': 'warn'
    }
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        gtag: 'readonly',
        L: 'readonly',
        dataLayer: 'readonly',
        initGA: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { vars: 'local', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      semi: ['warn', 'always'],
      quotes: ['warn', 'single', { avoidEscape: true }],
      'no-var': 'warn',
      'prefer-const': 'warn'
    }
  }
];
