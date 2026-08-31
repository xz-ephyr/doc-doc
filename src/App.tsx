import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  Sun,
  Moon,
  FileText,
  Eye,
  Columns2,
  RefreshCw,
  Download,
} from "lucide-react";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineMd(s: string) {
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
  s = s.replace(/\*\*\*([^\*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^\*]+)\*/g, "<em>$1</em>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return s;
}
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let out = "";
  let inCode = false;
  let codeBuf: string[] = [];
  let listStack: ("ul" | "ol")[] = [];
  function closeLists() { while (listStack.length) out += `</${listStack.pop()}>`; }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trimStart().startsWith("```")) {
      if (!inCode) { closeLists(); inCode = true; codeBuf = []; } else { inCode = false; out += `<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    const line = raw.trimEnd();
    if (!line.trim()) { closeLists(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { closeLists(); out += "<hr />"; continue; }
    if (line.trimStart().startsWith(">")) { closeLists(); out += `<blockquote><p>${inlineMd(escapeHtml(line.replace(/^\s*>\s?/, "")))}</p></blockquote>`; continue; }
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { closeLists(); const lvl = hm[1].length; out += `<h${lvl}>${inlineMd(escapeHtml(hm[2]))}</h${lvl}>`; continue; }
    const ulm = line.match(/^\s*[-*+]\s+(.+)$/);
    const olm = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ulm || olm) {
      const kind: "ul" | "ol" = ulm ? "ul" : "ol";
      const content = (ulm?.[1] ?? olm?.[1] ?? "");
      if (listStack[listStack.length - 1] !== kind) { closeLists(); out += `<${kind}>`; listStack.push(kind); }
      out += `<li>${inlineMd(escapeHtml(content))}</li>`;
      const nxt = lines[i + 1] ?? "";
      const nxtIsSame = kind === "ul" ? /^\s*[-*+]\s+/.test(nxt) : /^\s*\d+\.\s+/.test(nxt);
      if (!nxtIsSame) closeLists();
      continue;
    }
    closeLists();
    out += `<p>${inlineMd(escapeHtml(line))}</p>`;
  }
  if (inCode) out += `<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`;
  closeLists();
  return out || `<p style="color:var(--text-faint)">Nothing to preview — start writing below.</p>`;
}

type Theme = "light" | "dark";
type ViewMode = "write" | "split";
const LS_THEME = "doc-doc:theme";
const LS_DRAFT = "doc-doc:draft";
const LS_PATH = "doc-doc:lastPath";
const LS_MODE = "doc-doc:viewMode";
function isTauri() { return typeof window !== "undefined" && "__TAURI__" in window; }

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(LS_THEME) as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [filePath, setFilePath] = useState<string | null>(() => localStorage.getItem(LS_PATH));
  const [content, setContent] = useState<string>(() => localStorage.getItem(LS_DRAFT) ?? "");
  const [savedContent, setSavedContent] = useState(content);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem(LS_MODE) as ViewMode) === "split" ? "split" : "write");
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const writeRef = useRef<HTMLTextAreaElement>(null);
  const dirty = content !== savedContent;
  const showToast = useCallback((msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2200); }, []);
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  // auto-update check (Tauri only)
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!cancelled && update) {
          setUpdateInfo({ version: update.version });
          showToast(`Update ${update.version} available`);
        }
      } catch (e) {
        console.debug("updater check failed (normal in dev)", e);
      }
    })();
    return () => { cancelled = true; };
  }, [showToast]);

  const handleUpdate = useCallback(async () => {
    try {
      setUpdating(true);
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) { showToast("No update available"); return; }
      showToast(`Downloading ${update.version}…`);
      await update.downloadAndInstall((e) => {
        if ((e as { event: string }).event === "Started") showToast("Installing…");
      });
      showToast("Restarting…");
      const maybe = update as unknown as { closeAndInstall?: () => Promise<void> };
      if (maybe.closeAndInstall) await maybe.closeAndInstall();
      else showToast("Installed — restart the app");
    } catch (e) {
      console.error(e);
      showToast("Update failed");
    } finally { setUpdating(false); }
  }, [showToast]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem(LS_THEME, theme); }, [theme]);
  useEffect(() => { localStorage.setItem(LS_DRAFT, content); }, [content]);
  useEffect(() => { if (filePath) localStorage.setItem(LS_PATH, filePath); else localStorage.removeItem(LS_PATH); }, [filePath]);
  useEffect(() => { localStorage.setItem(LS_MODE, viewMode); }, [viewMode]);

  const readFileViaTauri = useCallback(async (path: string) => {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return await readTextFile(path);
  }, []);
  const writeFileViaTauri = useCallback(async (path: string, data: string) => {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, data);
  }, []);

  const handleNew = useCallback(() => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setContent(""); setSavedContent(""); setFilePath(null); showToast("New file");
    (viewMode === "write" ? writeRef : editorRef).current?.focus();
  }, [dirty, showToast, viewMode]);

  const handleOpen = useCallback(async () => {
    try {
      if (isTauri()) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ multiple: false, filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }] });
        if (!selected || Array.isArray(selected)) return;
        const text = await readFileViaTauri(selected);
        setContent(text); setSavedContent(text); setFilePath(selected); showToast("Opened"); return;
      }
      const w = window as unknown as { showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle[]> };
      if (w.showOpenFilePicker) {
        const [handle] = await w.showOpenFilePicker({ types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown", ".txt"] } }] });
        const file = await handle.getFile(); const text = await file.text();
        setContent(text); setSavedContent(text); (window as unknown as Record<string, unknown>).__docDocHandle = handle; setFilePath(file.name); showToast(`Opened ${file.name}`); return;
      }
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".md,.markdown,.txt,text/markdown,text/plain";
      inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; const t = await f.text(); setContent(t); setSavedContent(t); setFilePath(f.name); showToast(`Opened ${f.name}`); };
      inp.click();
    } catch (e) { if ((e as DOMException)?.name === "AbortError") return; console.error(e); showToast("Open failed"); }
  }, [readFileViaTauri, showToast]);

  const doSaveAsWeb = useCallback(async (data: string, suggestedName: string) => {
    const w = window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> };
    if (w.showSaveFilePicker) {
      try {
        const handle = await w.showSaveFilePicker({ suggestedName, types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }] });
        const writable = await handle.createWritable(); await writable.write(data); await writable.close();
        (window as unknown as Record<string, unknown>).__docDocHandle = handle; const name = handle.name ?? suggestedName; setFilePath(name); showToast(`Saved ${name}`); return true;
      } catch (err) { if ((err as DOMException)?.name === "AbortError") return false; }
    }
    const blob = new Blob([data], { type: "text/markdown;charset=utf-8" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = suggestedName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setFilePath(suggestedName); showToast(`Downloaded ${suggestedName}`); return true;
  }, [showToast]);

  const handleSave = useCallback(async () => {
    const suggested = filePath ?? "untitled.md";
    try {
      if (isTauri()) {
        if (filePath) { await writeFileViaTauri(filePath, content); setSavedContent(content); showToast("Saved"); return; }
        const { save } = await import("@tauri-apps/plugin-dialog");
        const p = await save({ defaultPath: suggested, filters: [{ name: "Markdown", extensions: ["md"] }] });
        if (!p) return; await writeFileViaTauri(p, content); setFilePath(p); setSavedContent(content); showToast("Saved"); return;
      }
      const handle = (window as unknown as Record<string, unknown>).__docDocHandle as FileSystemFileHandle | undefined;
      if (handle && filePath) { try { const w = await handle.createWritable(); await w.write(content); await w.close(); setSavedContent(content); showToast("Saved"); return; } catch {}
      }
      const ok = await doSaveAsWeb(content, suggested); if (ok) setSavedContent(content);
    } catch (e) { console.error(e); showToast("Save failed"); }
  }, [content, filePath, writeFileViaTauri, doSaveAsWeb, showToast]);

  const handleSaveAs = useCallback(async () => {
    try {
      if (isTauri()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const p = await save({ defaultPath: filePath ?? "untitled.md", filters: [{ name: "Markdown", extensions: ["md"] }] });
        if (!p) return; await writeFileViaTauri(p, content); setFilePath(p); setSavedContent(content); showToast("Saved as"); return;
      }
      const ok = await doSaveAsWeb(content, filePath ?? "untitled.md"); if (ok) setSavedContent(content);
    } catch (e) { console.error(e); showToast("Save failed"); }
  }, [content, filePath, writeFileViaTauri, doSaveAsWeb, showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); if (e.shiftKey) void handleSaveAs(); else void handleSave(); }
      if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); void handleOpen(); }
      if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); handleNew(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleSaveAs, handleOpen, handleNew]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (!f) return;
    const text = await f.text();
    if (dirty && !confirm(`Open "${f.name}" and discard unsaved changes?`)) return;
    setContent(text); setSavedContent(text); setFilePath(f.name); showToast(`Opened ${f.name}`);
  }, [dirty, showToast]);

  const wordCount = useMemo(() => content.trim() ? content.trim().split(/\s+/).length : 0, [content]);
  const fileName = useMemo(() => filePath ? filePath.split(/[\\/]/).pop()! : "untitled.md", [filePath]);

  return (
    <>
      <header className="app-header" data-tauri-drag-region>
        <div className="brand"><span className="brand-mark"><FileText size={15} strokeWidth={2.2} /></span> doc-doc</div>
        <span className="filename" title={filePath ?? undefined}><strong>{fileName}</strong>{dirty ? " • unsaved" : " • saved"}</span>
        <div className="header-actions">
          <button className="btn btn-ghost btn-icon" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={theme === "dark" ? "Light" : "Dark"} onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <span className="divider-v" aria-hidden />
          <button className="btn" onClick={handleNew}><FilePlus size={14} /> <span className="label">New</span></button>
          <button className="btn" onClick={() => void handleOpen()}><FolderOpen size={14} /> <span className="label">Open</span></button>
          <button className="btn" onClick={() => void handleSave()}><Save size={14} /> <span className="label">Save</span></button>
          <button className="btn btn-primary" onClick={() => void handleSaveAs()}><SaveAll size={14} /> <span className="label">Save As</span></button>
          <button className="btn btn-ghost btn-icon" title={viewMode === "write" ? "Split view" : "Write mode"} aria-label={viewMode === "write" ? "Split view" : "Write mode"} onClick={() => setViewMode(m => m === "write" ? "split" : "write")}>
            {viewMode === "write" ? <Columns2 size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </header>
      {updateInfo && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--surface)", borderBottom:"1px solid var(--border)", fontSize:13, color:"var(--text-soft)" }}>
          <RefreshCw size={14} /> Update {updateInfo.version} available — restart to install
          <button className="btn btn-primary" style={{ marginLeft:"auto", padding:"5px 10px" }} disabled={updating} onClick={() => void handleUpdate()}>
            <Download size={14} /> {updating ? "Updating…" : "Update now"}
          </button>
          <button className="btn" style={{ padding:"5px 10px" }} onClick={() => setUpdateInfo(null)}>Dismiss</button>
        </div>
      )}

      {viewMode === "write" ? (
        <div className="write-wrap" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} style={{ position: "relative" }}>
          {dragOver && <div className="drop-mask">Drop .md file to open</div>}
          <div className="doc">
            <textarea
              ref={writeRef}
              className="doc-area"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Start writing…"
              spellCheck
              aria-label="Write markdown"
              autoFocus
            />
          </div>
        </div>
      ) : (
        <div className="workspace" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} style={{ position: "relative" }}>
          {dragOver && <div className="drop-mask">Drop .md file to open</div>}
          <div className="pane">
            <div className="pane-head"><span><FileText size={12} /> Editor</span></div>
            <div className="pane-body">
              <textarea ref={editorRef} className="editor" value={content} onChange={e => setContent(e.target.value)} placeholder="Start writing markdown…" spellCheck aria-label="Markdown editor" />
            </div>
          </div>
          <div className="pane">
            <div className="pane-head"><span><Eye size={12} /> Preview</span></div>
            <div className="pane-body"><div className="preview" dangerouslySetInnerHTML={{ __html: mdToHtml(content) }} /></div>
          </div>
        </div>
      )}

      <div className="statusbar" role="status">
        <span className={`status-dot ${dirty ? "dirty" : ""}`} aria-hidden />
        <strong>{dirty ? "Unsaved" : "Saved"}</strong>
        <span>· {wordCount} words</span>
      </div>

      {toast && <div role="status" style={{ position: "fixed", bottom: 34, left: "50%", transform: "translateX(-50%)", background: "var(--text)", color: "var(--bg)", padding: "8px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-lg)", zIndex: 20 }}>{toast}</div>}
    </>
  );
}
