import type { TranslationTree } from './locales/en';

/** Same shape as the English tree, but every leaf is a plain string. */
export type Translations = {
  [K in keyof TranslationTree]: {
    [L in keyof TranslationTree[K]]: string;
  };
};

/** Dotted key paths, e.g. 'common.appName'. */
export type TranslationKey = {
  [K in keyof TranslationTree & string]: {
    [L in keyof TranslationTree[K] & string]: `${K}.${L}`;
  }[keyof TranslationTree[K] & string];
}[keyof TranslationTree & string];

export type TranslateFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;
