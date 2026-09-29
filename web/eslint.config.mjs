/**
 * Правила кода сайта: рекомендации Next.js и TypeScript плюс строгие правила проекта.
 * Форматированием занимается Prettier (npm run format), поэтому его правила ESLint отключены.
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // Только строгое сравнение (0 == "" в JS — true). Исключение — идиома x == null:
      // проверка сразу на null и undefined.
      eqeqeq: ["error", "always", { null: "ignore" }],
      // Отладочный вывод не должен попадать в сборку.
      "no-console": "error",
      // У кнопки явный type: без него кнопка внутри формы отправляет её (так вспышка камеры открывала клавиатуру).
      "react/button-has-type": "error",
      // Импорт типов — отдельно: сборщик выбрасывает его целиком.
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      // Импорт только типов — целиком через «import type», а не «import { type X }».
      "@typescript-eslint/no-import-type-side-effects": "error",
      // Неиспользуемое — ошибка; осознанно пропущенный аргумент начинается с «_».
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Порядок импортов: пакеты → модули проекта (@/) → соседние файлы, по алфавиту, одним блоком.
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "never",
        },
      ],
      "prefer-const": "error",
      "object-shorthand": "error",
    },
  },
  // Скрипты сборки — консольные утилиты: печатать в консоль им можно.
  { files: ["scripts/**"], rules: { "no-console": "off" } },
  globalIgnores([".next/**", "out/**", "build/**", "test-results/**", "next-env.d.ts"]),
]);
