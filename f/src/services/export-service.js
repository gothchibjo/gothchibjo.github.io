function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ensurePrintNode() {
  const existing = document.getElementById("print-protocol");
  if (existing) return existing;
  const node = document.createElement("pre");
  node.id = "print-protocol";
  node.className = "print-protocol";
  document.body.appendChild(node);
  return node;
}

export function createExportService({ t, generateText, generateMarkdownText, renderPreviewText }) {
  const exportMd = (doc) => {
    const blob = new Blob([generateMarkdownText(doc)], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, `${doc.meetingDate || t("common.fileBase")}-${doc.id}.md`);
  };

  const exportDocx = async (doc) => {
    const { Document, Packer, Paragraph, TextRun } = await import("https://cdn.jsdelivr.net/npm/docx@9.0.3/+esm");
    const paragraphs = generateText(doc).split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] }));
    const file = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const blob = await Packer.toBlob(file);
    downloadBlob(blob, `${doc.meetingDate || t("common.fileBase")}-${doc.id}.docx`);
  };

  const exportPdf = (doc) => {
    const text = generateText(doc);
    if (!text.trim()) return;

    ensurePrintNode().innerHTML = renderPreviewText(text);

    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
    };
    document.addEventListener("afterprint", restoreTitle, { once: true });
    document.title = `${doc.meetingDate || t("common.fileBase")}-${doc.id}`;
    try {
      window.print();
    } finally {
      window.setTimeout(restoreTitle, 0);
    }
  };

  return {
    exportMd,
    exportDocx,
    exportPdf,
  };
}
