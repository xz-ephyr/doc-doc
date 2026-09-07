import { Document, Paragraph, TextRun, HeadingLevel, Packer } from "docx";

export interface DocExportOptions {
  title: string;
  htmlContent: string;
  markdownContent: string;
  plainTextContent: string;
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportToMarkdown(options: DocExportOptions) {
  const blob = new Blob([options.markdownContent], { type: "text/markdown;charset=utf-8" });
  const filename = `${options.title.replace(/[^a-z0-9_-]/gi, "_") || "untitled"}.md`;
  downloadFile(blob, filename);
}

export async function exportToTxt(options: DocExportOptions) {
  const blob = new Blob([options.plainTextContent], { type: "text/plain;charset=utf-8" });
  const filename = `${options.title.replace(/[^a-z0-9_-]/gi, "_") || "untitled"}.txt`;
  downloadFile(blob, filename);
}

export async function exportToHtml(options: DocExportOptions) {
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #202124; }
    h1, h2, h3, h4 { color: #1a73e8; }
    blockquote { border-left: 4px solid #1a73e8; margin: 0; padding-left: 16px; color: #5f6368; }
    code { background: #f1f3f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    pre { background: #f1f3f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
${options.htmlContent}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
  const filename = `${options.title.replace(/[^a-z0-9_-]/gi, "_") || "untitled"}.html`;
  downloadFile(blob, filename);
}

export async function exportToDocx(options: DocExportOptions) {
  const parser = new DOMParser();
  const docElement = parser.parseFromString(`<div>${options.htmlContent}</div>`, "text/html");
  const childrenNodes = Array.from(docElement.body.firstElementChild?.childNodes || []);

  const docxParagraphs: Paragraph[] = [];

  for (const node of childrenNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const text = el.innerText || el.textContent || "";

      if (tag === "h1") {
        docxParagraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }));
      } else if (tag === "h2") {
        docxParagraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
      } else if (tag === "h3") {
        docxParagraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_3 }));
      } else if (tag === "ul" || tag === "ol") {
        const lis = Array.from(el.querySelectorAll("li"));
        for (const li of lis) {
          docxParagraphs.push(new Paragraph({ text: `• ${li.textContent || ""}` }));
        }
      } else {
        docxParagraphs.push(new Paragraph({ children: [new TextRun(text)] }));
      }
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      docxParagraphs.push(new Paragraph({ children: [new TextRun(node.textContent)] }));
    }
  }

  if (docxParagraphs.length === 0) {
    docxParagraphs.push(new Paragraph({ children: [new TextRun(options.plainTextContent || "")] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docxParagraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${options.title.replace(/[^a-z0-9_-]/gi, "_") || "untitled"}.docx`;
  downloadFile(blob, filename);
}

export async function exportToPdf(options: DocExportOptions, element?: HTMLElement | null) {
  if (element) {
    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;
      const filename = `${options.title.replace(/[^a-z0-9_-]/gi, "_") || "untitled"}.pdf`;
      const opt = {
        margin: 0.5,
        filename: filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" as const },
      };
      await html2pdf().set(opt).from(element).save();
      return;
    } catch (e) {
      console.warn("html2pdf failed, falling back to window.print()", e);
    }
  }
  window.print();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
