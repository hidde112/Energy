import { en } from "@/lib/i18n/en";
import { nl } from "@/lib/i18n/nl";

export type Locale = "en" | "nl";
export type TranslationKey = keyof typeof en;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, nl };

export function translate(
  locale: Locale,
  key: TranslationKey,
  values: Record<string, string | number> = {},
) {
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    dictionaries[locale][key],
  );
}
