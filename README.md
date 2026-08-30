# doc-doc

Tiny desktop writing app — your `.md` file stays **on your machine**. No DB — just a file at a path you choose.

**Bun + Vite + React + TypeScript + Tauri 2**

![logo](public/favicon.svg)

## Features

- **File on disk** — Open / Save / Save As writes straight to the filesystem. Tauri API on desktop (`@tauri-apps/plugin-fs` + `plugin-dialog`), File System Access API + download fallback on web. No database.
- **Drag & drop** — drop a `.md` / `.txt` onto the editor to open it.
- **Editor + Preview** — live markdown preview (headings, bold/italic, code, lists, quotes, links, hr, tables) without heavy deps.
- **White / Dark mode** — toggle with lucide `Sun`/`Moon`, WCAG AA text contrast (light ` #0f172a on #ffffff` 17:1, dark `#f1f5f9 on #0b0e14` 16:1).
- **Lucide icons** throughout — `lucide-react`.
- **E2E working** — `bun dev` for web, `bun run tauri:dev` for desktop. `Ctrl/Cmd+S`, `Ctrl+Shift+S`, `Ctrl+O`, `Ctrl+N`.

## Quick start

```bash
# web
bun install
bun dev          # http://localhost:1420

# desktop (requires Rust)
bun run tauri:dev
bun run tauri:build
```

## Project

```
doc-doc/
  src/
    App.tsx      # editor, preview, file I/O, theme
    index.css    # white/dark tokens, verified contrast
    logo.svg     # doc-doc mark (two overlapping docs)
  public/favicon.svg
  src-tauri/
    Cargo.toml
    tauri.conf.json  # window 1120×720, beforeDevCommand bun run dev
    src/main.rs
    capabilities/default.json  # fs + dialog + opener
    icons/       # generated via `bunx tauri icon public/favicon.svg`
```

## File handling

- **Tauri**: `open()` → `readTextFile(path)`; `writeTextFile(path, content)` / `save()` for Save As. Path shown in header + status bar, persisted in `localStorage`.
- **Web**: prefers `showOpenFilePicker` / `showSaveFilePicker`; falls back to `<input type="file">` + blob download. Keeps a handle in memory for fast Save.
- **No DB** — file lives wherever you put it. Draft + last path cached in `localStorage` for reload.

## Theme

`data-theme="light|dark"` on `<html>` → CSS variables. Toggle persists. All text on bg passes 4.5:1. Focus rings visible, scrollbar accessible.

## Build

```bash
bun run build      # vite
bun run tauri:build  # nsis + msi on Windows
```
