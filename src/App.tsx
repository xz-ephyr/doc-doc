import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Search,
  Plus,
  Star,
  Share2,
  Undo2,
  Redo2,
  Printer,
  SpellCheck,
  PaintRoller,
  Bold,
  Italic,
  Underline,
  Link,
  MessageSquarePlus,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  ChevronDown,
  MoreVertical,
  Grid,
  ArrowLeft,
  Sun,
  Moon,
  Sparkles,
  Calendar,
  CheckSquare,
  User,
  FolderOpen,
  Download,
  Trash2,
} from "lucide-react";
import {
  exportToMarkdown,
  exportToDocx,
  exportToPdf,
  exportToTxt,
  exportToHtml,
} from "./utils/export";

type ViewMode = "home" | "editor";
type Theme = "light" | "dark";

interface DocumentItem {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  starred?: boolean;
}

const DEFAULT_DOCUMENTS: DocumentItem[] = [
  {
    id: "cebric",
    title: "cebric",
    content: "<h1>cebric</h1><p>Opened 3 Sept 2026</p><p>Welcome to your Cebric document draft.</p>",
    updatedAt: "Opened 3 Sept 2026",
    starred: false,
  },
  {
    id: "updated_sched",
    title: "UPDATED_FINAL_SCHED...",
    content: "<h1>EKITI STATE UNIVERSITY, ADO-EKITI</h1><p>DIRECTORATE OF ACADEMIC PLANNING</p><p>Updated final schedule for 2nd semester examinations.</p>",
    updatedAt: "Opened 11 Aug 2026",
    starred: true,
  },
  {
    id: "humidity_paper",
    title: "humidity_paper_11pages",
    content: "<h1>Humidity: Fundamentals, Thermodynamics, and Engineering Applications</h1><p>Group 9 Assignment - ME 314</p>",
    updatedAt: "Opened 29 Jul 2026",
    starred: false,
  },
  {
    id: "untitled_doc",
    title: "Untitled document",
    content: "<h1>Untitled document</h1><p>Start writing your new document here...</p>",
    updatedAt: "Opened 22 Jul 2026",
    starred: false,
  },
];

const TEMPLATES = [
  {
    id: "blank",
    title: "Blank document",
    subtitle: "",
    content: "<p><br></p>",
    color: "#ffffff",
    badge: "+",
  },
  {
    id: "resume-serif",
    title: "Resume",
    subtitle: "Serif",
    content: "<h1>Your Name</h1><p><em>Professional Title | Location | Email | Phone</em></p><hr><p><strong>Experience</strong></p><p>Company Name — Senior Software Engineer</p>",
    color: "#ffffff",
  },
  {
    id: "resume-coral",
    title: "Resume",
    subtitle: "Coral",
    content: "<h1 style='color: #e06666;'>Your Name</h1><p><strong>Skills & Expertise</strong></p><p>Frontend, Backend, System Design</p>",
    color: "#ffffff",
  },
  {
    id: "letter-spearmint",
    title: "Letter",
    subtitle: "Spearmint",
    content: "<p>Your Name<br>123 Street Address<br>City, State ZIP</p><p>Date: October 24, 2026</p><p>Dear Recipient,</p><p>I am writing to express my interest...</p>",
    color: "#ffffff",
  },
  {
    id: "project-proposal",
    title: "Project proposal",
    subtitle: "Tropic",
    content: "<h1 style='color: #38761d;'>Project Name</h1><p><strong>Overview</strong></p><p>This project aims to optimize workflow productivity.</p>",
    color: "#ffffff",
  },
  {
    id: "brochure",
    title: "Brochure",
    subtitle: "Geometric",
    content: "<h1>Product Brochure</h1><p>Introducing our flagship solution.</p>",
    color: "#ffffff",
  },
];

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("gdoc_theme") as Theme) || "light";
  });
  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    const saved = localStorage.getItem("gdoc_documents");
    return saved ? JSON.parse(saved) : DEFAULT_DOCUMENTS;
  });
  const [currentDoc, setCurrentDoc] = useState<DocumentItem>(DEFAULT_DOCUMENTS[3]);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Formatting states
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState("11");
  const [formatBlock, setFormatBlock] = useState("Normal text");

  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("gdoc_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("gdoc_documents", JSON.stringify(documents));
  }, [documents]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Sync content into editable div when opening document
  useEffect(() => {
    if (viewMode === "editor" && editableRef.current) {
      editableRef.current.innerHTML = currentDoc.content;
    }
  }, [viewMode, currentDoc.id]);

  const handleUpdateContent = () => {
    if (editableRef.current) {
      const newHtml = editableRef.current.innerHTML;
      setCurrentDoc((prev) => ({ ...prev, content: newHtml }));
      setDocuments((prev) =>
        prev.map((d) => (d.id === currentDoc.id ? { ...d, content: newHtml, updatedAt: "Just now" } : d))
      );
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setCurrentDoc((prev) => ({ ...prev, title: newTitle }));
    setDocuments((prev) =>
      prev.map((d) => (d.id === currentDoc.id ? { ...d, title: newTitle } : d))
    );
  };

  const openDocument = (doc: DocumentItem) => {
    setCurrentDoc(doc);
    setViewMode("editor");
  };

  const createNewDocFromTemplate = (template: typeof TEMPLATES[0]) => {
    const newDoc: DocumentItem = {
      id: "doc_" + Date.now(),
      title: template.id === "blank" ? "Untitled document" : template.title,
      content: template.content,
      updatedAt: "Just now",
      starred: false,
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setCurrentDoc(newDoc);
    setViewMode("editor");
    showToast(`Created new document from ${template.title}`);
  };

  const toggleStar = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, starred: !d.starred } : d))
    );
    if (currentDoc.id === docId) {
      setCurrentDoc((prev) => ({ ...prev, starred: !prev.starred }));
    }
  };

  const deleteDocument = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (confirm("Delete this document?")) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      showToast("Document deleted");
    }
  };

  // Formatting helpers
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editableRef.current) {
      editableRef.current.focus();
    }
    handleUpdateContent();
  };

  const handleFontChange = (font: string) => {
    setFontFamily(font);
    execCmd("fontName", font);
  };

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    const sizeMap: Record<string, string> = { "8": "1", "10": "2", "11": "3", "12": "3", "14": "4", "18": "5", "24": "6", "36": "7" };
    execCmd("fontSize", sizeMap[size] || "3");
  };

  const handleHeadingChange = (format: string) => {
    setFormatBlock(format);
    if (format === "Title" || format === "Heading 1") execCmd("formatBlock", "<h1>");
    else if (format === "Heading 2") execCmd("formatBlock", "<h2>");
    else if (format === "Heading 3") execCmd("formatBlock", "<h3>");
    else execCmd("formatBlock", "<p>");
  };

  // Export handlers
  const getExportData = () => {
    const htmlContent = editableRef.current ? editableRef.current.innerHTML : currentDoc.content;
    const plainTextContent = editableRef.current ? editableRef.current.innerText : currentDoc.title;
    let md = plainTextContent;
    if (editableRef.current) {
      md = editableRef.current.innerText;
    }
    return {
      title: currentDoc.title,
      htmlContent,
      markdownContent: md,
      plainTextContent,
    };
  };

  const handleExport = async (format: "md" | "docx" | "pdf" | "txt" | "html") => {
    setActiveMenu(null);
    const data = getExportData();
    if (format === "md") {
      await exportToMarkdown(data);
      showToast("Saved as Markdown (.md)");
    } else if (format === "docx") {
      await exportToDocx(data);
      showToast("Saved as Word (.docx)");
    } else if (format === "pdf") {
      await exportToPdf(data, editableRef.current);
      showToast("Exporting PDF...");
    } else if (format === "txt") {
      await exportToTxt(data);
      showToast("Saved as Plain Text (.txt)");
    } else if (format === "html") {
      await exportToHtml(data);
      showToast("Saved as Web Page (.html)");
    }
  };

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Toast Notification */}
      {toast && <div className="gdoc-toast">{toast}</div>}

      {/* HOME VIEW */}
      {viewMode === "home" ? (
        <div className="gdoc-home">
          {/* Main Top Header */}
          <header className="gdoc-header">
            <div className="gdoc-brand" onClick={() => setViewMode("home")}>
              <div className="gdoc-logo-icon">
                <FileText size={24} />
              </div>
              <span className="gdoc-brand-title">Docs</span>
            </div>

            <div className="gdoc-search-bar">
              <Search size={20} />
              <input
                type="text"
                className="gdoc-search-input"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="gdoc-header-right">
              <button
                className="gdoc-icon-btn"
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button className="gdoc-btn-upgrade">Upgrade</button>
              <div className="gdoc-avatar">J</div>
            </div>
          </header>

          {/* Template Gallery Section */}
          <div className="gdoc-template-section">
            <div className="gdoc-template-header">
              <span>Start a new document</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, cursor: "pointer", color: "var(--gdoc-text-sub)" }}>
                  Template gallery
                </span>
                <MoreVertical size={18} style={{ color: "var(--gdoc-text-sub)", cursor: "pointer" }} />
              </div>
            </div>

            <div className="gdoc-template-grid">
              {TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="gdoc-template-card"
                  onClick={() => createNewDocFromTemplate(tmpl)}
                >
                  <div className="gdoc-template-preview">
                    {tmpl.id === "blank" ? (
                      <Plus size={48} style={{ color: "#ea4335" }} />
                    ) : (
                      <div style={{ padding: 12, fontSize: 8, color: "#666", width: "100%" }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#1a73e8" }}>
                          {tmpl.title}
                        </div>
                        <div style={{ height: 4, background: "#e0e0e0", marginBottom: 4 }} />
                        <div style={{ height: 4, background: "#f0f0f0", marginBottom: 4, width: "80%" }} />
                        <div style={{ height: 4, background: "#f0f0f0", width: "60%" }} />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="gdoc-template-title">{tmpl.title}</div>
                    {tmpl.subtitle && <div className="gdoc-template-subtitle">{tmpl.subtitle}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Documents Section */}
          <div className="gdoc-recent-section">
            <div className="gdoc-recent-header">
              <span className="gdoc-recent-title">Recent documents</span>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 14, color: "var(--gdoc-text-sub)", cursor: "pointer" }}>
                  Owned by anyone <ChevronDown size={14} style={{ inlineSize: "auto", verticalAlign: "middle" }} />
                </span>
                <Grid size={18} style={{ color: "var(--gdoc-text-sub)", cursor: "pointer" }} />
                <FolderOpen size={18} style={{ color: "var(--gdoc-text-sub)", cursor: "pointer" }} />
              </div>
            </div>

            <div className="gdoc-docs-grid">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="gdoc-doc-card"
                  onClick={() => openDocument(doc)}
                >
                  <div className="gdoc-doc-card-thumbnail">
                    <div dangerouslySetInnerHTML={{ __html: doc.content }} />
                  </div>
                  <div className="gdoc-doc-card-info">
                    <div className="gdoc-doc-card-title">{doc.title}</div>
                    <div className="gdoc-doc-card-meta">
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          background: "#1a73e8",
                          borderRadius: 2,
                          display: "grid",
                          placeItems: "center",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: "bold",
                        }}
                      >
                        ≡
                      </div>
                      <span style={{ flex: 1 }}>{doc.updatedAt}</span>
                      <Star
                        size={16}
                        fill={doc.starred ? "#f4b400" : "none"}
                        color={doc.starred ? "#f4b400" : "#80868b"}
                        onClick={(e) => toggleStar(e, doc.id)}
                      />
                      <Trash2
                        size={16}
                        color="#80868b"
                        onClick={(e) => deleteDocument(e, doc.id)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* EDITOR VIEW */
        <div className="gdoc-editor-view">
          {/* Top Document Header */}
          <div className="gdoc-doc-nav">
            <div className="gdoc-logo-icon" style={{ cursor: "pointer" }} onClick={() => setViewMode("home")}>
              <FileText size={22} />
            </div>

            <div className="gdoc-doc-title-group">
              <div className="gdoc-doc-title-row">
                <input
                  type="text"
                  className="gdoc-title-input"
                  value={currentDoc.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
                <Star
                  size={18}
                  fill={currentDoc.starred ? "#f4b400" : "none"}
                  color={currentDoc.starred ? "#f4b400" : "#5f6368"}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => toggleStar(e, currentDoc.id)}
                />
              </div>

              {/* Menu Bar */}
              <div className="gdoc-menu-bar">
                <div
                  className="gdoc-menu-item"
                  onClick={() => setActiveMenu(activeMenu === "file" ? null : "file")}
                >
                  File
                  {activeMenu === "file" && (
                    <div className="gdoc-dropdown">
                      <div className="gdoc-dropdown-item" onClick={() => createNewDocFromTemplate(TEMPLATES[0])}>
                        <span>New document</span>
                      </div>
                      <div className="gdoc-dropdown-item" onClick={() => setViewMode("home")}>
                        <span>Open home</span>
                      </div>
                      <div className="gdoc-dropdown-divider" />
                      <div className="gdoc-dropdown-item" style={{ fontWeight: 600, color: "#1a73e8" }}>
                        <span>Save / Export as:</span>
                      </div>
                      <div className="gdoc-dropdown-item" onClick={() => handleExport("docx")}>
                        <span>Microsoft Word (.docx)</span>
                        <Download size={14} />
                      </div>
                      <div className="gdoc-dropdown-item" onClick={() => handleExport("pdf")}>
                        <span>PDF Document (.pdf)</span>
                        <Download size={14} />
                      </div>
                      <div className="gdoc-dropdown-item" onClick={() => handleExport("md")}>
                        <span>Markdown (.md)</span>
                        <Download size={14} />
                      </div>
                      <div className="gdoc-dropdown-item" onClick={() => handleExport("txt")}>
                        <span>Plain Text (.txt)</span>
                        <Download size={14} />
                      </div>
                      <div className="gdoc-dropdown-item" onClick={() => handleExport("html")}>
                        <span>Web Page (.html)</span>
                        <Download size={14} />
                      </div>
                      <div className="gdoc-dropdown-divider" />
                      <div className="gdoc-dropdown-item" onClick={() => window.print()}>
                        <span>Print</span>
                        <Printer size={14} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="gdoc-menu-item">Edit</div>
                <div className="gdoc-menu-item">View</div>
                <div className="gdoc-menu-item">Insert</div>
                <div className="gdoc-menu-item">Format</div>
                <div className="gdoc-menu-item">Tools</div>
                <div className="gdoc-menu-item">Extensions</div>
                <div className="gdoc-menu-item">Help</div>
              </div>
            </div>

            <div className="gdoc-nav-actions">
              <button
                className="gdoc-icon-btn"
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button className="gdoc-btn-share" onClick={() => showToast("Share link copied to clipboard")}>
                <Share2 size={16} /> Share
              </button>
              <div className="gdoc-avatar">J</div>
            </div>
          </div>

          {/* Action Formatting Toolbar */}
          <div className="gdoc-toolbar">
            <button className="gdoc-tb-btn" title="Undo" onClick={() => execCmd("undo")}>
              <Undo2 size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Redo" onClick={() => execCmd("redo")}>
              <Redo2 size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Print" onClick={() => window.print()}>
              <Printer size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Spelling and grammar check">
              <SpellCheck size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Paint format">
              <PaintRoller size={16} />
            </button>

            <div className="gdoc-tb-divider" />

            <select
              className="gdoc-tb-select"
              value={formatBlock}
              onChange={(e) => handleHeadingChange(e.target.value)}
            >
              <option>Normal text</option>
              <option>Title</option>
              <option>Heading 1</option>
              <option>Heading 2</option>
              <option>Heading 3</option>
            </select>

            <div className="gdoc-tb-divider" />

            <select
              className="gdoc-tb-select"
              value={fontFamily}
              onChange={(e) => handleFontChange(e.target.value)}
            >
              <option value="Arial">Arial</option>
              <option value="Roboto">Roboto</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Merriweather">Merriweather</option>
              <option value="Lexend">Lexend</option>
            </select>

            <div className="gdoc-tb-divider" />

            <select
              className="gdoc-tb-select"
              style={{ width: 50 }}
              value={fontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
            >
              <option value="8">8</option>
              <option value="10">10</option>
              <option value="11">11</option>
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="18">18</option>
              <option value="24">24</option>
              <option value="36">36</option>
            </select>

            <div className="gdoc-tb-divider" />

            <button className="gdoc-tb-btn" title="Bold (Ctrl+B)" onClick={() => execCmd("bold")}>
              <Bold size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Italic (Ctrl+I)" onClick={() => execCmd("italic")}>
              <Italic size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Underline (Ctrl+U)" onClick={() => execCmd("underline")}>
              <Underline size={16} />
            </button>

            <div className="gdoc-tb-divider" />

            <button className="gdoc-tb-btn" title="Insert link" onClick={() => {
              const url = prompt("Enter URL:");
              if (url) execCmd("createLink", url);
            }}>
              <Link size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Add comment" onClick={() => showToast("Comment feature added")}>
              <MessageSquarePlus size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Insert image" onClick={() => {
              const url = prompt("Image URL:");
              if (url) execCmd("insertImage", url);
            }}>
              <ImageIcon size={16} />
            </button>

            <div className="gdoc-tb-divider" />

            <button className="gdoc-tb-btn" title="Align left" onClick={() => execCmd("justifyLeft")}>
              <AlignLeft size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Align center" onClick={() => execCmd("justifyCenter")}>
              <AlignCenter size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Align right" onClick={() => execCmd("justifyRight")}>
              <AlignRight size={16} />
            </button>

            <div className="gdoc-tb-divider" />

            <button className="gdoc-tb-btn" title="Numbered list" onClick={() => execCmd("insertOrderedList")}>
              <ListOrdered size={16} />
            </button>
            <button className="gdoc-tb-btn" title="Bulleted list" onClick={() => execCmd("insertUnorderedList")}>
              <List size={16} />
            </button>
          </div>

          {/* Main Canvas Workspace */}
          <div className="gdoc-workspace">
            {/* Document Tabs Sidebar */}
            <div className="gdoc-sidebar">
              <div className="gdoc-sidebar-header">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ArrowLeft size={16} style={{ cursor: "pointer" }} onClick={() => setViewMode("home")} />
                  <span>Document tabs</span>
                </div>
                <Plus size={16} style={{ cursor: "pointer" }} />
              </div>
              <div className="gdoc-tab-item active">
                <FileText size={16} />
                <span>Tab 1</span>
              </div>
            </div>

            {/* Canvas Container with Ruler and Document Page */}
            <div className="gdoc-canvas-container">
              {/* Ruler */}
              <div className="gdoc-ruler">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span>
              </div>

              {/* Paper Page */}
              <div className="gdoc-page">
                <div
                  ref={editableRef}
                  className="gdoc-editable"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleUpdateContent}
                />
              </div>
            </div>

            {/* Right Action Rail */}
            <div className="gdoc-right-rail">
              <div className="gdoc-rail-icon" title="Calendar"><Calendar size={20} color="#ea4335" /></div>
              <div className="gdoc-rail-icon" title="Keep"><Sparkles size={20} color="#f4b400" /></div>
              <div className="gdoc-rail-icon" title="Tasks"><CheckSquare size={20} color="#1a73e8" /></div>
              <div className="gdoc-rail-icon" title="Contacts"><User size={20} color="#34a853" /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
