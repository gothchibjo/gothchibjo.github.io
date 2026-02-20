function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function createExportService({ t, generateText, generateMarkdownText }) {
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
    const jsPdf = window.jspdf?.jsPDF;
    if (!jsPdf) {
      alert(t("alerts.pdfMissing"));
      return;
    }

    const pdf = new jsPdf({ unit: "pt", format: "a4" });
    const lines = pdf.splitTextToSize(text, 520);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(lines, 36, 48);
    pdf.save(`${doc.meetingDate || t("common.fileBase")}-${doc.id}.pdf`);
  };

  return {
    exportMd,
    exportDocx,
    exportPdf,
  };
}
