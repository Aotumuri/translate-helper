export type BriefField = {
  number: number;
  total: number;
  title: string;
  key: string;
  length: string;
  limit: string;
  notes: string;
  source: string;
  originalBlock: string;
};

export type Language = { code: string; name: string };

export type ParsedBrief = {
  id: string;
  fileName: string;
  title: string;
  sourceFile: string;
  sourceLanguage: string;
  languages: Language[];
  rules: string;
  fields: BriefField[];
  raw: string;
  loadedAt: number;
};

export type TranslationMap = Record<string, Record<string, string>>;
