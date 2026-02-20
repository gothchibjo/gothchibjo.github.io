export function hasUserContent(text) {
  return /[^\s.:;,\-]/u.test(text || "");
}

export function normalizeRawText(value) {
  return (value || "").replaceAll("\r", "").trim();
}

export function normalizeTasks(tasks) {
  return (tasks || [])
    .map((task) => ({
      title: (task.title || "").trim(),
      assignee: (task.assignee || task.owner || "").trim(),
      due: task.due || "",
      completed: Boolean(task.completed),
    }))
    .filter((task) => Boolean(task.title));
}

export function collectDecisionsFromInput(rawText) {
  return (rawText || "")
    .replace(/,\s*\n\s*/g, ", ")
    .replaceAll("\r", "")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*•\s]+/, "").replace(/^\d+[.)]\s*/, "").replace(/[.;:]+\s*$/, "").trim())
    .filter((line) => hasUserContent(line))
    .map((text) => ({ text }));
}

export function renderDecisionsToInput(decisions) {
  return (decisions || []).map((d) => d.text || "").filter(Boolean).join("\n");
}

export function getTodayIsoLocal() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}
