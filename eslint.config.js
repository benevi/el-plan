// ESLint (configuración plana). Errores reales y variables sin declarar → error; variables sin usar → aviso.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**', 'css/**', 'icons/**', 'fonts/**', 'tests/e2e/legado/**', 'docs/qa/scripts/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      ...js.configs.recommended.rules,
      // Asignaciones que nadie lee: hoy son inofensivas (estado.js, temporizador.js); aviso, no error.
      'no-useless-assignment': 'warn',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  // La app (navegador, módulos ES).
  { files: ['js/**/*.js'], languageOptions: { globals: { ...globals.browser } } },
  // Vigilante de arranque (script clásico, no módulo).
  { files: ['js/arranque.js'], languageOptions: { sourceType: 'script' } },
  // Scripts de mantenimiento (node).
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
  // Service worker (script clásico).
  { files: ['sw.js'], languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } } },
  // Funciones de Vercel (node).
  { files: ['api/**/*.js'], languageOptions: { globals: { ...globals.node } } },
  // Pruebas y configuración (node; las e2e evalúan código en el navegador).
  { files: ['tests/**/*.mjs', '*.config.js', 'eslint.config.js'], languageOptions: { globals: { ...globals.node } } },
  { files: ['tests/e2e/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
