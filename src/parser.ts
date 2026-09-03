import type { BriefField, Language, ParsedBrief } from "./types";

const LINE = "(?:={10,}|-{10,})";

function valueAfter(label: string, text: string) {
  return text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "mi"))?.[1]?.trim() ?? "";
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseLanguages(text: string): Language[] {
  const section = text.match(/TARGET LANGUAGES[\s\S]*?\n-+\n([\s\S]*?)(?=\n={10,})/i)?.[1] ?? "";
  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^\s{2,}([a-z][a-z0-9_]*)\s{2,}(.+?)\s*$/i))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ code: match[1], name: match[2] }));
}

function parseField(block: string): BriefField | null {
  const heading = block.match(/FIELD\s+(\d+)\s+of\s+(\d+)\s*\|\s*(.+?)\s*(?:\r?\n|$)/i);
  if (!heading) return null;

  const source = block.match(/ENGLISH SOURCE\s*\r?\n-+\s*\r?\n([\s\S]*?)(?=\r?\n-+\s*\r?\nTRANSLATION)/i)?.[1]?.trim() ?? "";
  return {
    number: Number(heading[1]),
    total: Number(heading[2]),
    title: heading[3].trim(),
    key: valueAfter("KEY", block),
    length: valueAfter("LENGTH", block),
    limit: valueAfter("LIMIT", block),
    notes: valueAfter("NOTES", block),
    source,
    originalBlock: block,
  };
}

export function parseBrief(rawInput: string, fileName: string): ParsedBrief {
  const raw = rawInput.replace(/\r\n/g, "\n");
  const fieldStart = /^={10,}\nFIELD\s+\d+\s+of\s+\d+\s*\|/gim;
  const starts = [...raw.matchAll(fieldStart)].map((match) => match.index ?? 0);
  const fields = starts
    .map((start, index) => raw.slice(start, starts[index + 1] ?? raw.length))
    .map(parseField)
    .filter((field): field is BriefField => field !== null);

  if (!fields.length) {
    throw new Error("No FIELD sections were found. Make sure the file uses the expected brief format.");
  }

  const firstField = starts[0] ?? raw.length;
  const preamble = raw.slice(0, firstField);
  const rulesStart = preamble.search(/={10,}\nHOW TO WORK IN THIS FILE/i);
  const rules = rulesStart >= 0 ? preamble.slice(rulesStart).trim() : preamble.trim();
  const title = raw.match(/^={10,}\n([^\n]+LOCALISATION BRIEF[^\n]*)/im)?.[1]?.trim()
    ?? fileName.replace(/\.[^.]+$/, "");

  return {
    id: hashString(`${fileName}:${raw}`),
    fileName,
    title,
    sourceFile: valueAfter("Source file", preamble),
    sourceLanguage: valueAfter("Source language", preamble) || "English",
    languages: parseLanguages(preamble),
    rules,
    fields,
    raw,
    loadedAt: Date.now(),
  };
}

export function replaceTranslation(block: string, translation: string) {
  const pattern = /(\n-+\nTRANSLATION\n-+\n)([\s\S]*?)(?=\n={10,}|$)/i;
  return block.replace(pattern, `$1\n${translation.trim()}\n\n`);
}

export function exportBrief(brief: ParsedBrief, translations: Record<string, string>) {
  const starts = [...brief.raw.matchAll(/^={10,}\nFIELD\s+\d+\s+of\s+\d+\s*\|/gim)].map((match) => match.index ?? 0);
  if (!starts.length) return brief.raw;
  let output = brief.raw.slice(0, starts[0]);
  brief.fields.forEach((field) => {
    output += replaceTranslation(field.originalBlock, translations[field.key] ?? "");
  });
  return output.replace(/\n{4,}/g, "\n\n\n");
}

export function expectedTags(source: string) {
  return source.match(/\[(?:\/?[a-z0-9*]+)(?:=[^\]]+)?\]/gi) ?? [];
}

export function tagIssues(source: string, translation: string) {
  if (!translation.trim()) return [];
  const sourceTags = expectedTags(source);
  const targetTags = expectedTags(translation);
  const issues: string[] = [];
  if (sourceTags.length) {
    const missing = sourceTags.filter((tag, index) => targetTags[index] !== tag);
    if (sourceTags.length !== targetTags.length) {
      issues.push(`Tag count does not match (source: ${sourceTags.length}, translation: ${targetTags.length})`);
    }
    if (missing.length) issues.push("Tag types or order have changed");
  }
  const sourceEntities = source.match(/&[a-zA-Z0-9#]+;/g) ?? [];
  const targetEntities = translation.match(/&[a-zA-Z0-9#]+;/g) ?? [];
  if (sourceEntities.some((entity, index) => targetEntities[index] !== entity)) {
    issues.push("An HTML entity was removed or changed");
  }
  return issues;
}

export function maxLength(limit: string) {
  const match = limit.match(/MAX\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}
