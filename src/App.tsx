import { useEffect, useMemo, useRef, useState } from "react";
import { exportBrief, maxLength, parseBrief, tagIssues } from "./parser";
import { loadBriefs, loadTranslations, saveBriefs, saveTranslations } from "./storage";
import type { BriefField, ParsedBrief, TranslationMap } from "./types";

type Filter = "all" | "open" | "done" | "warning";

function downloadText(content: string, name: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function getWorkspaceKey(briefId: string, language: string) {
  return `${briefId}:${language}`;
}

function truncate(value: string, length = 44) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function Landing({ onImport }: { onImport: (files: FileList | File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <main className="landing">
      <section className="simple-home" id="top">
        <header className="home-header">
          <h1>Briefly</h1>
          <p>Translation brief workspace</p>
        </header>
        <div
          className={`drop-card ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            onImport(event.dataTransfer.files);
          }}
        >
          <h2>Open a brief</h2>
          <p>Drop a .txt file here, or choose one.</p>
          <button className="primary-button" onClick={() => inputRef.current?.click()}>Choose file</button>
          <input ref={inputRef} type="file" accept=".txt,text/plain" multiple hidden onChange={(event) => event.target.files && onImport(event.target.files)} />
          <small>Files and progress stay in this browser.</small>
        </div>
      </section>
    </main>
  );
}

function FieldCard({
  field,
  value,
  onChange,
}: {
  field: BriefField;
  value: string;
  onChange: (value: string) => void;
}) {
  const issues = tagIssues(field.source, value);
  const limit = maxLength(field.limit);
  const overLimit = limit !== null && value.length > limit;
  const hasWarning = issues.length > 0 || overLimit;
  const [copied, setCopied] = useState(false);

  return (
    <article className={`field-card ${hasWarning ? "has-warning" : ""}`} id={`field-${field.number}`}>
      <header className="field-header">
        <div className="field-index">{String(field.number).padStart(2, "0")}</div>
        <div className="field-heading">
          <p>FIELD {field.number} OF {field.total}</p>
          <h2>{field.title}</h2>
        </div>
        <div className={`status-pill ${hasWarning ? "warning" : value.trim() ? "done" : ""}`}>
          {hasWarning ? "Review" : value.trim() ? "Done" : "Not started"}
        </div>
      </header>

      <div className="field-meta">
        <span><b>KEY</b><code>{field.key}</code></span>
        <span><b>LIMIT</b>{field.limit}</span>
        {field.notes && <span><b>NOTES</b>{field.notes}</span>}
      </div>

      <div className="translation-grid">
        <section className="source-pane">
          <div className="pane-label"><span>ENGLISH SOURCE</span><span>{field.source.length} chars</span></div>
          <div className="source-text">{field.source}</div>
          <button
            className="copy-button"
            onClick={async () => {
              await navigator.clipboard.writeText(field.source);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          >{copied ? "Copied" : "Copy source"}</button>
        </section>
        <section className="target-pane">
          <div className="pane-label"><span>TRANSLATION</span><span className={overLimit ? "count-danger" : ""}>{value.length}{limit ? ` / ${limit}` : ""} chars</span></div>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Enter translation…"
            aria-label={`${field.title} translation`}
            spellCheck
          />
        </section>
      </div>

      {hasWarning && (
        <div className="warning-box" role="alert">
          <b>CHECK</b>
          <div>
            {issues.map((issue) => <p key={issue}>{issue}</p>)}
            {overLimit && <p>Character limit exceeded by {value.length - (limit ?? 0)}</p>}
          </div>
        </div>
      )}
    </article>
  );
}

function RulesDrawer({ brief, onClose }: { brief: ParsedBrief; onClose: () => void }) {
  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Translation rules">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close rules" />
      <aside className="rules-drawer">
        <header>
          <div><p>REFERENCE</p><h2>Translation rules</h2></div>
          <button onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="rule-highlight">
          <span>!</span>
          <p><b>Keep tags unchanged</b><br />Do not translate text inside brackets or change tag order and nesting.</p>
        </div>
        <pre>{brief.rules}</pre>
      </aside>
    </div>
  );
}

function Workspace({
  brief,
  briefs,
  translations,
  onTranslations,
  onSelectBrief,
  onImport,
  onHome,
  onClearData,
}: {
  brief: ParsedBrief;
  briefs: ParsedBrief[];
  translations: TranslationMap;
  onTranslations: (next: TranslationMap) => void;
  onSelectBrief: (id: string) => void;
  onImport: (files: FileList | File[]) => void;
  onHome: () => void;
  onClearData: () => void;
}) {
  const initialLanguage = brief.languages[0]?.code ?? "translation";
  const [language, setLanguage] = useState(initialLanguage);
  const [filter, setFilter] = useState<Filter>("all");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLanguage(brief.languages[0]?.code ?? "translation");
    setFilter("all");
  }, [brief.id]);

  const key = getWorkspaceKey(brief.id, language);
  const current = translations[key] ?? {};
  const states = brief.fields.map((field) => {
    const value = current[field.key] ?? "";
    const warning = tagIssues(field.source, value).length > 0 || ((maxLength(field.limit) ?? Infinity) < value.length);
    return { field, value, warning, done: Boolean(value.trim()) && !warning };
  });
  const completed = states.filter((state) => state.done).length;
  const warningCount = states.filter((state) => state.warning).length;
  const progress = Math.round((completed / brief.fields.length) * 100);
  const languageOptions = [
    ...(brief.languages.length
      ? brief.languages
      : [{ code: "translation", name: "Translation" }]),
    ...(!brief.languages.some((item) => item.code === "other")
      ? [{ code: "other", name: "Other" }]
      : []),
  ];
  const visible = states.filter(({ field, warning, done }) => {
    const matchesFilter = filter === "all" || (filter === "done" && done) || (filter === "warning" && warning) || (filter === "open" && !done);
    const needle = query.toLowerCase();
    return matchesFilter && (!needle || `${field.title} ${field.key} ${field.source}`.toLowerCase().includes(needle));
  });

  const updateField = (fieldKey: string, value: string) => {
    onTranslations({ ...translations, [key]: { ...current, [fieldKey]: value } });
  };

  const exportCurrent = () => {
    const baseName = brief.fileName.replace(/\.[^.]+$/, "");
    downloadText(exportBrief(brief, current), `${baseName}_${language}.txt`);
  };

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <button className="brand brand-button" onClick={onHome} aria-label="Back to start">
          <span className="brand-mark">B</span><span>Briefly</span>
        </button>
        <div className="side-section">
          <p className="side-label">PROJECTS</p>
          <button className="project-active" onClick={() => setMenuOpen(!menuOpen)}>
            <span className="project-icon">T</span>
            <span><b>{truncate(brief.title, 23)}</b><small>{brief.fields.length} fields</small></span>
            <i>⌄</i>
          </button>
          {menuOpen && (
            <div className="project-menu">
              {briefs.map((item) => <button key={item.id} onClick={() => { onSelectBrief(item.id); setMenuOpen(false); }}>{truncate(item.title, 28)}</button>)}
            </div>
          )}
          <button className="add-project" onClick={() => inputRef.current?.click()}>＋ New brief</button>
          <input ref={inputRef} type="file" accept=".txt,text/plain" multiple hidden onChange={(event) => event.target.files && onImport(event.target.files)} />
        </div>
        <div className="side-section grow">
          <p className="side-label">VIEW</p>
          <button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}><span>All fields</span><b>{brief.fields.length}</b></button>
          <button className={filter === "open" ? "selected" : ""} onClick={() => setFilter("open")}><span>Incomplete</span><b>{brief.fields.length - completed}</b></button>
          <button className={filter === "done" ? "selected" : ""} onClick={() => setFilter("done")}><span>Completed</span><b>{completed}</b></button>
          <button className={filter === "warning" ? "selected" : ""} onClick={() => setFilter("warning")}><span>Needs review</span><b className={warningCount ? "warn-count" : ""}>{warningCount}</b></button>
        </div>
        <button className="rules-button" onClick={() => setRulesOpen(true)}><span>?</span><div><b>Translation rules</b><small>View brief instructions</small></div><i>↗</i></button>
        <div className="privacy-note"><span>●</span><p><b>LOCAL SAVE</b><br />Autosaving in this browser</p></div>
        <button className="clear-button" onClick={onClearData}>Clear data</button>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="mobile-brand"><button onClick={onHome}>B</button></div>
          <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fields" /></label>
          <button className="mobile-rules" onClick={() => setRulesOpen(true)}>RULES</button>
          <button className="mobile-clear" onClick={onClearData}>CLEAR</button>
          <div className="save-state"><span>✓</span> Saved</div>
          <button className="export-button" onClick={exportCurrent}>Export TXT <span>↓</span></button>
        </header>

        <div className="workspace-content">
          <section className="project-heading">
            <div>
              <p className="breadcrumbs">PROJECTS / <span>{brief.sourceFile || brief.fileName}</span></p>
              <h1>{brief.title}</h1>
              <p className="project-sub">{brief.sourceLanguage} to {brief.languages.find((item) => item.code === language)?.name ?? language} · {brief.fields.length} fields</p>
            </div>
            <label className="language-picker"><span>TARGET LANGUAGE</span><select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languageOptions.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}
            </select></label>
          </section>

          <section className="progress-card">
            <div className="progress-copy"><strong>{progress}<sup>%</sup></strong><span><b>{completed} / {brief.fields.length} completed</b><small>Changes are saved automatically</small></span></div>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
            <span className="progress-status">{progress === 100 ? "READY TO EXPORT" : "IN PROGRESS"}</span>
          </section>

          <div className="results-bar"><span>{visible.length} FIELDS</span>{filter !== "all" && <button onClick={() => setFilter("all")}>Clear filter ×</button>}</div>

          <section className="fields-list">
            {visible.map(({ field, value }) => (
              <FieldCard key={field.key} field={field} value={value} onChange={(next) => updateField(field.key, next)} />
            ))}
            {!visible.length && <div className="empty-results"><b>No matching fields</b><p>Try changing the search or filter.</p></div>}
          </section>
        </div>
      </main>
      {rulesOpen && <RulesDrawer brief={brief} onClose={() => setRulesOpen(false)} />}
    </div>
  );
}

export default function App() {
  const [briefs, setBriefs] = useState<ParsedBrief[]>(loadBriefs);
  const [translations, setTranslations] = useState<TranslationMap>(loadTranslations);
  const [activeId, setActiveId] = useState<string | null>(() => loadBriefs()[0]?.id ?? null);
  const [showLanding, setShowLanding] = useState(() => loadBriefs().length === 0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => saveBriefs(briefs), [briefs]);
  useEffect(() => saveTranslations(translations), [translations]);

  const activeBrief = useMemo(() => briefs.find((brief) => brief.id === activeId) ?? briefs[0], [briefs, activeId]);

  const importFiles = async (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    try {
      const parsed = await Promise.all(files.map(async (file) => parseBrief(await file.text(), file.name)));
      setBriefs((previous) => {
        const byId = new Map(previous.map((brief) => [brief.id, brief]));
        parsed.forEach((brief) => byId.set(brief.id, brief));
        return [...byId.values()];
      });
      setActiveId(parsed[0].id);
      setShowLanding(false);
      setToast(`${parsed.length} ${parsed.length === 1 ? "brief" : "briefs"} imported`);
      window.setTimeout(() => setToast(null), 2400);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The file could not be imported");
    }
  };

  const clearData = () => {
    const confirmed = window.confirm(
      "Clear all imported briefs and translations? This cannot be undone.",
    );
    if (!confirmed) return;
    setBriefs([]);
    setTranslations({});
    setActiveId(null);
    setShowLanding(true);
  };

  return (
    <>
      {showLanding || !activeBrief ? (
        <Landing onImport={importFiles} />
      ) : (
        <Workspace
          brief={activeBrief}
          briefs={briefs}
          translations={translations}
          onTranslations={setTranslations}
          onSelectBrief={setActiveId}
          onImport={importFiles}
          onHome={() => setShowLanding(true)}
          onClearData={clearData}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
