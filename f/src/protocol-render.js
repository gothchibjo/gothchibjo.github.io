function escapeHtml(value) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderPreviewText(text) {
  return escapeHtml(text)
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

export function buildClipboardHtml(text) {
  return `<div style="white-space: pre-wrap;">${renderPreviewText(text)}</div>`;
}

export function formatDate(date, intlLocale) {
  return new Date(date).toLocaleDateString(intlLocale);
}

export function createProtocolRenderers({ t, intlLocale, normalizeTopic, resolveDocumentTasks }) {
  const strikeLine = (line) => {
    if (!line) return line;
    const prefixedMatch = line.match(/^(\s*(?:-\s+|\d+(?:\.\d+)?\.\s+))(.*)$/);
    if (prefixedMatch) {
      const [, prefix, content] = prefixedMatch;
      if (!content.trim()) return line;
      return `${prefix}~~${content}~~`;
    }
    return `~~${line}~~`;
  };

  const emphasizeLine = (line) => {
    if (!line || !line.includes("!")) return line;
    const marker = line.includes("!!") ? "**" : "*";
    const prefixedMatch = line.match(/^(\s*(?:-\s+|\d+(?:\.\d+)?\.\s+))(.*)$/);
    if (prefixedMatch) {
      const [, prefix, content] = prefixedMatch;
      if (!content.trim()) return line;
      return `${prefix}${marker}${content}${marker}`;
    }
    return `${marker}${line}${marker}`;
  };

  const formatDueDate = (due) => {
    if (!due) return t("common.noDue");
    const parsed = new Date(`${due}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return due;
    return parsed.toLocaleDateString(intlLocale, { dateStyle: "medium" });
  };

  const formatListItem = (text, isLast) => {
    const trimmed = text.trim().replace(/[.;:]+\s*$/, "");
    if (!trimmed) return "";
    if (/!$/.test(trimmed)) return trimmed;
    return `${trimmed}${isLast ? "." : ";"}`;
  };

  const formatDecision = (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return "";
    if (/[!?]$/.test(trimmed)) return trimmed;
    if (/\.$/.test(trimmed)) return trimmed;
    return `${trimmed.replace(/[;:]+\s*$/, "")}.`;
  };

  const generateText = (doc) => {
    const lines = [];
    lines.push(emphasizeLine(`${doc.meetingDate || "YYYY-MM-DD"} ${doc.meetingTitle || t("common.untitled")}`));
    if (doc.meta) lines.push(emphasizeLine(doc.meta));
    lines.push("");

    lines.push(`1. ${t("protocol.participants")}:`);
    if (doc.participants.length === 0) lines.push(`- ${t("common.empty")}`);
    doc.participants.forEach((item, index) => {
      const rendered = formatListItem(item.text, index === doc.participants.length - 1);
      if (rendered) lines.push(emphasizeLine(`- ${rendered}`));
    });
    lines.push("");

    lines.push(`2. ${t("protocol.topics")}:`);
    if (doc.topics.length === 0) lines.push(`2.1. ${t("common.empty")}`);
    doc.topics.forEach((item, index) => {
      const topic = normalizeTopic(item.text);
      const title = topic.main.replace(/[.:;]+\s*$/, "").trim();
      const hasTerminalExclamation = /!$/.test(title);
      const topicSuffix = hasTerminalExclamation ? "" : topic.bullets.length ? ":" : ".";
      lines.push(emphasizeLine(`2.${index + 1}. ${title}${topicSuffix}`));
      topic.bullets.forEach((b, bulletIndex) => {
        const rendered = formatListItem(b, bulletIndex === topic.bullets.length - 1);
        if (rendered) lines.push(emphasizeLine(`  - ${rendered}`));
      });
      if (topic.bullets.length > 0 && index < doc.topics.length - 1) lines.push("");
    });
    lines.push("");

    lines.push(`3. ${t("protocol.decisions")}:`);
    if (doc.decisions.length === 0) lines.push(`3.1. ${t("common.empty")}`);
    doc.decisions.forEach((item, index) => {
      const rendered = formatDecision(item.text);
      if (rendered) lines.push(emphasizeLine(`3.${index + 1}. ${rendered}`));
    });
    lines.push("");

    const resolvedTasks = resolveDocumentTasks(doc);
    lines.push(`4. ${t("protocol.tasks")}:`);
    if (resolvedTasks.length === 0) lines.push(`4.1. ${t("common.empty")}`);
    resolvedTasks.forEach((task, index) => {
      const status = task.completed ? "[v]" : "[ ]";
      const assignee = task.assignee || t("common.unassigned");
      const due = formatDueDate(task.due);
      const line = `4.${index + 1}. ${status} ${task.title} — ${assignee}, ${due}`;
      const maybeStruck = task.completed ? strikeLine(line) : line;
      lines.push(emphasizeLine(maybeStruck));
    });
    lines.push("");
    lines.push(t("protocol.footer"));

    return lines.join("\n");
  };

  const generateMarkdownText = (doc) => {
    const escapeOrderedPrefix = (line) => line.replace(/^(\s*\d+)\./, "$1\\.");
    return generateText(doc)
      .split("\n")
      .map((line) => {
        if (!line) return "";
        return `${escapeOrderedPrefix(line)}  `;
      })
      .join("\n");
  };

  return {
    generateText,
    generateMarkdownText,
  };
}
