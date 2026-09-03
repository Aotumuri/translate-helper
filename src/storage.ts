import type { ParsedBrief, TranslationMap } from "./types";

const BRIEFS_KEY = "briefly:briefs:v1";
const TRANSLATIONS_KEY = "briefly:translations:v1";

export function loadBriefs(): ParsedBrief[] {
  try {
    return JSON.parse(localStorage.getItem(BRIEFS_KEY) ?? "[]") as ParsedBrief[];
  } catch {
    return [];
  }
}

export function saveBriefs(briefs: ParsedBrief[]) {
  localStorage.setItem(BRIEFS_KEY, JSON.stringify(briefs));
}

export function loadTranslations(): TranslationMap {
  try {
    return JSON.parse(localStorage.getItem(TRANSLATIONS_KEY) ?? "{}") as TranslationMap;
  } catch {
    return {};
  }
}

export function saveTranslations(translations: TranslationMap) {
  localStorage.setItem(TRANSLATIONS_KEY, JSON.stringify(translations));
}
