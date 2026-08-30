import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  Eye,
  EyeOff,
  Sun,
  Moon,
  FileText,
  Trash2,
  Check,
  CircleDot,
} from "lucide-react";

// tiny markdown -> html (no deps, safe)
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineMd(s: string) {
  // code `...`
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
  // bold + italic + links
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

  function closeLists() {
    while (listStack.length) out += `</${listStack.pop()}>`;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // fenced code
    if (raw.trimStart().startsWith("```")) {
      if (!inCode) { closeLists(); inCode = true; codeBuf = []; }
      else { inCode = false; out += `<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    const line = raw.trimEnd();
    if (!line.trim()) { closeLists(); continue; }

    // hr
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { closeLists(); out += "<hr />"; continue; }
    // blockquote
    if (line.trimStart().startsWith(">")) {
      closeLists();
      out += `<blockquote><p>${inlineMd(escapeHtml(line.replace(/^\s*>\s?/, "")))}</p></blockquote>`;
      continue;
    }
    // headings
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { closeLists(); const lvl = hm[1].length; out += `<h${lvl}>${inlineMd(escapeHtml(hm[2]))}</h${lvl}>`; continue; }
    // table row (very minimal) - we skip complex table parse, treat as paragraph if not forming table
    // lists
    const ulm = line.match(/^\s*[-*+]\s+(.+)$/);
    const olm = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ulm || olm) {
      const kind: "ul" | "ol" = ulm ? "ul" : "ol";
      const content = (ulm?.[1] ?? olm?.[1] ?? "");
      if (listStack[listStack.length - 1] !== kind) { closeLists(); out += `<${kind}>`; listStack.push(kind); }
      out += `<li>${inlineMd(escapeHtml(content))}</li>`;
      // peek next: if next line not same list type, close soon (let blank line handle)
      const nxt = lines[i + 1] ?? "";
      const nxtIsSame = kind === "ul" ? /^\s*[-*+]\s+/.test(nxt) : /^\s*\d+\.\s+/.test(nxt);
      if (!nxtIsSame) { /* keep open until blank, but simpler close now if next not list */ }
      if (!nxtIsSame) { closeLists(); }
      continue;
    }
    // paragraph
    closeLists();
    out += `<p>${inlineMd(escapeHtml(line))}</p>`;
  }
  if (inCode) out += `<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`;
  closeLists();
  return out || `<p style="color:var(--text-faint)">Nothing to preview — start writing on the left.</p>`;
}

type Theme = "light" | "dark";
const LS_THEME = "doc-doc:theme";
const LS_DRAFT = "doc-doc:draft";
const LS_PATH = "doc-doc:lastPath";

function isTauri() {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(LS_THEME) as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [filePath, setFilePath] = useState<string | null>(() => localStorage.getItem(LS_PATH));
  const [content, setContent] = useState<string>(() => localStorage.getItem(LS_DRAFT) ?? `# Welcome to doc-doc

A tiny desktop writing app. Your \`.md\` file stays on **your machine** — no database, just a file at a path you choose.

- **Open** an existing \`.md\` file
- **Save** writes straight back to that path (Tauri) or downloads / File Picker on web
- **Save As** to choose a new location
- Toggle **Preview** on the right
- White / Dark mode keeps text contrast WCAG AA

Try editing this text, then hit **Save**.

\`\`\`md
# heading
**bold** *italic* \`code\`
- list item
> quote
\`\`\`

> Tip: drag & drop a \`.md\` file onto the editor to open it.
`);
  const [savedContent, setSavedContent] = useState(content);
  const [showPreview, setShowPreview] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const dirty = content !== savedContent;

  // theme -> dom + persist
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);
  // draft persist
  useEffect(() => { localStorage.setItem(LS_DRAFT, content); }, [content]);
  useEffect(() => {
    if (filePath) localStorage.setItem(LS_PATH, filePath);
    else localStorage.removeItem(LS_PATH);
  }, [filePath]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // --- file I/O helpers (Tauri-first, web fallback) ---
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
    setContent("");
    setSavedContent("");
    setFilePath(null);
    showToast("New file");
    editorRef.current?.focus();
  }, [dirty, showToast]);

  const handleOpen = useCallback(async () => {
    try {
      if (isTauri()) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: false,
          filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
        });
        if (!selected || Array.isArray(selected)) return;
        const text = await readFileViaTauri(selected);
        setContent(text);
        setSavedContent(text);
        setFilePath(selected);
        showToast("Opened");
        return;
      }
      // web: File System Access API if available, else file input
      // prefer showOpenFilePicker
      const w = window as unknown as { showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle[]> };
      if (w.showOpenFilePicker) {
        const [handle] = await w.showOpenFilePicker({
          types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown", ".txt"] } }],
          excludeAcceptAllOption: false,
        });
        const file = await handle.getFile();
        const text = await file.text();
        setContent(text); setSavedContent(text);
        // store handle for save-back if browser allows
        (window as unknown as Record<string, unknown>).__docDocHandle = handle;
        setFilePath(file.name);
        showToast(`Opened ${file.name}`);
        return;
      }
      // fallback input
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".md,.markdown,.txt,text/markdown,text/plain";
      inp.onchange = async () => {
        const f = inp.files?.[0]; if (!f) return;
        const t = await f.text();
        setContent(t); setSavedContent(t); setFilePath(f.name);
        showToast(`Opened ${f.name}`);
      };
      inp.click();
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      console.error(e);
      showToast("Open failed");
    }
  }, [readFileViaTauri, showToast]);

  const doSaveAsWeb = useCallback(async (data: string, suggestedName: string) => {
    const w = window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> };
    if (w.showSaveFilePicker) {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName,
          types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        (window as unknown as Record<string, unknown>).__docDocHandle = handle;
        const name = handle.name ?? suggestedName;
        setFilePath(name);
        showToast(`Saved ${name}`);
        return true;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return false;
        // fall through to download
      }
    }
    // download fallback
    const blob = new Blob([data], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = suggestedName;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setFilePath(suggestedName);
    showToast(`Downloaded ${suggestedName}`);
    return true;
  }, [showToast]);

  const handleSave = useCallback(async () => {
    const suggested = filePath ?? "untitled.md";
    try {
      if (isTauri()) {
        if (filePath) {
          await writeFileViaTauri(filePath, content);
          setSavedContent(content);
          showToast("Saved");
          return;
        }
        const { save } = await import("@tauri-apps/plugin-dialog");
        const p = await save({
          defaultPath: suggested,
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
        if (!p) return;
        await writeFileViaTauri(p, content);
        setFilePath(p); setSavedContent(content);
        showToast("Saved");
        return;
      }
      // web
      const handle = (window as unknown as Record<string, unknown>).__docDocHandle as FileSystemFileHandle | undefined;
      if (handle && filePath) {
        try {
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          setSavedContent(content);
          showToast("Saved");
          return;
        } catch { /* fall to save as */ }
      }
      const ok = await doSaveAsWeb(content, suggested);
      if (ok) setSavedContent(content);
    } catch (e) {
      console.error(e);
      showToast("Save failed");
    }
  }, [content, filePath, writeFileViaTauri, doSaveAsWeb, showToast]);

  const handleSaveAs = useCallback(async () => {
    try {
      if (isTauri()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const p = await save({
          defaultPath: filePath ?? "untitled.md",
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
        if (!p) return;
        await writeFileViaTauri(p, content);
        setFilePath(p); setSavedContent(content);
        showToast("Saved as");
        return;
      }
      const ok = await doSaveAsWeb(content, filePath ?? "untitled.md");
      if (ok) setSavedContent(content);
    } catch (e) {
      console.error(e);
      showToast("Save failed");
    }
  }, [content, filePath, writeFileViaTauri, doSaveAsWeb, showToast]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) void handleSaveAs(); else void handleSave();
      }
      if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); void handleOpen(); }
      if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); handleNew(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleSaveAs, handleOpen, handleNew]);

  // drag & drop
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (!f) return;
    const text = await f.text();
    if (dirty && !confirm(`Open "${f.name}" and discard unsaved changes?`)) return;
    setContent(text); setSavedContent(text); setFilePath(f.name);
    showToast(`Opened ${f.name}`);
  }, [dirty, showToast]);

  const wordCount = useMemo(() => {
    const w = content.trim() ? content.trim().split(/\s+/).length : 0;
    return w;
  }, [content]);
  const lineCount = useMemo(() => content.split("\n").length, [content]);

  return (
    <>
      <header className="app-header" data-tauri-drag-region>
        <div className="brand" aria-label="doc-doc">
          <span className="brand-mark" aria-hidden>
            <FileText size={16} strokeWidth={2.2} />
          </span>
          doc-doc
          <small>markdown — on your machine</small>
        </div>

        <div className={`path-pill ${dirty ? "dirty" : ""}`} title={filePath ?? "No file — will prompt on Save"}>
          {filePath ? <><FolderOpen size={13} /> <strong>{filePath}</strong></> : <><CircleDot size={13} /> <strong>untitled.md</strong> <span style={{ opacity: .7 }}>· not yet saved to disk</span></>}
          {dirty ? <span style={{ display:"inline-flex", alignItems:"center", gap:4, color:"var(--warning)", fontWeight:700 }}><span style={{ width:6, height:6, borderRadius:99, background:"var(--warning)", display:"inline-block"}}/> unsaved</span> : <span style={{ display:"inline-flex", alignItems:"center", gap:4, color:"var(--success)", fontWeight:700 }}><Check size={12}/> saved</span>}
        </div>

        <div className="header-actions">
          <button className="btn btn-ghost btn-icon" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`${theme === "dark" ? "Light" : "Dark"} mode`} onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className="divider-v" aria-hidden />
          <button className="btn" onClick={handleNew}><FilePlus size={15} /> <span className="label">New</span></button>
          <button className="btn" onClick={() => void handleOpen()}><FolderOpen size={15} /> <span className="label">Open</span></button>
          <button className="btn" onClick={() => void handleSave()}><Save size={15} /> <span className="label">Save</span></button>
          <button className="btn btn-primary" onClick={() => void handleSaveAs()}><SaveAll size={15} /> <span className="label">Save As…</span></button>
          <button className="btn btn-ghost btn-icon" aria-label={showPreview ? "Hide preview" : "Show preview"} title={showPreview ? "Hide preview" : "Show preview"} onClick={() => setShowPreview(v => !v)}>
            {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </header>

      <div className="workspace">
        <div className="pane" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} style={{ position:"relative" }}>
          <div className="pane-head">
            <span><FileText size={13} /> Editor</span>
            <span style={{ marginLeft:"auto", textTransform:"none", letterSpacing:0, fontWeight:500, fontFamily:"var(--font-mono)", color:"var(--text-faint)" }}>{wordCount} words · {content.length} chars</span>
            {dirty && <button className="btn" style={{ padding:"4px 8px", fontSize:12, marginLeft:8 }} onClick={() => { setContent(savedContent); showToast("Reverted"); }}> <Trash2 size={12}/> Revert</button>}
          </div>
          <div className="pane-body">
            {dragOver && <div className="drop-mask">Drop .md file to open</div>}
            <textarea
              ref={editorRef}
              className="editor"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Start writing markdown…"
              spellCheck
              aria-label="Markdown editor"
            />
          </div>
        </div>
        {showPreview && (
          <div className="pane">
            <div className="pane-head"><span><Eye size={13}/> Preview</span><span style={{ marginLeft:"auto", textTransform:"none", letterSpacing:0, fontWeight:400, color:"var(--text-faint)", fontFamily:"var(--font-mono)"}}>{isTauri() ? "Tauri · file on disk" : "Web · File Picker / download"}</span></div>
            <div className="pane-body">
              <div className="preview" dangerouslySetInnerHTML={{ __html: mdToHtml(content) }} />
            </div>
          </div>
        )}
      </div>

      <div className="statusbar" role="status" aria-live="polite">
        <span className={`status-dot ${dirty ? "dirty" : ""}`} aria-hidden />
        <strong>{dirty ? "Unsaved changes" : "All saved"}</strong>
        <span>—</span>
        <span>{lineCount} lines</span>
        <span>·</span>
        <span>{wordCount} words</span>
        <span style={{ marginLeft:"auto", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"44vw" }} title={filePath ?? ""}>{filePath ? filePath : "No file path yet — Save will ask where to put it"}</span>
        <span style={{ opacity:.6 }}>· {theme} mode</span>
      </div>

      {toast && (
        <div role="status" aria-live="polite" style={{
          position:"fixed", bottom:36, left:"50%", transform:"translateX(-50%)",
          background:"var(--text)", color:"var(--bg)", padding:"9px 14px", borderRadius:99,
          fontSize:13, fontWeight:600, boxShadow:"var(--shadow-lg)", zIndex:20
        }}>{toast}</div>
      )}
    </>
  );
}
