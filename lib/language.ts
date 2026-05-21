export const LANGUAGE_COOKIE_NAME = "preferred-language";
export const LANGUAGE_STORAGE_KEY = "preferred-language";

export type AppLanguage = "ar" | "en";

export const DEFAULT_LANGUAGE: AppLanguage = "ar";
export const LANGUAGE_OPTIONS = ["ar", "en"] as const;

export const LANGUAGE_META: Record<
  AppLanguage,
  {
    dir: "rtl" | "ltr";
    locale: string;
    label: string;
    description: string;
  }
> = {
  ar: {
    dir: "rtl",
    locale: "ar-SA",
    label: "العربية",
    description: "واجهة عربية باتجاه من اليمين إلى اليسار",
  },
  en: {
    dir: "ltr",
    locale: "en-US",
    label: "English",
    description: "Left-to-right interface for English content",
  },
};

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "ar" || value === "en";
}

export function getAppLanguage(value: string | null | undefined): AppLanguage {
  return isAppLanguage(value) ? value : DEFAULT_LANGUAGE;
}
