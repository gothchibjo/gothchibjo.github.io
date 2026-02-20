function toIsoDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() + 1 !== m ||
    parsed.getUTCDate() !== d
  ) {
    return "";
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseLooseDateToken(token, locale) {
  const isoMatch = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return toIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);

  const monthYearDotMatch = token.match(/^(\d{1,2})\.(\d{4})$/);
  if (monthYearDotMatch) return toIsoDate(monthYearDotMatch[2], monthYearDotMatch[1], 1);

  const dotMatch = token.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/);
  if (dotMatch) {
    const now = new Date();
    const yearRaw = dotMatch[3];
    const year = yearRaw ? (yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw)) : now.getFullYear();
    return toIsoDate(year, dotMatch[2], dotMatch[1]);
  }

  const monthYearSlashMatch = token.match(/^(\d{1,2})\/(\d{4})$/);
  if (monthYearSlashMatch) {
    const isEnglishLocale = String(locale || "").toLowerCase().startsWith("en");
    if (!isEnglishLocale) return "";
    return toIsoDate(monthYearSlashMatch[2], monthYearSlashMatch[1], 1);
  }

  const slashMatch = token.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (slashMatch) {
    const now = new Date();
    const yearRaw = slashMatch[3];
    const year = yearRaw ? (yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw)) : now.getFullYear();
    const isEnglishLocale = String(locale || "").toLowerCase().startsWith("en");
    const month = isEnglishLocale ? slashMatch[1] : slashMatch[2];
    const day = isEnglishLocale ? slashMatch[2] : slashMatch[1];
    return toIsoDate(year, month, day);
  }

  return "";
}

function isAssigneeBoundaryChar(char) {
  if (!char) return true;
  return /[\s,.;:!?()[\]{}"'`«»]/u.test(char);
}

function findLastAssigneeTag(text, participantNames = []) {
  let exactMatch = null;
  let fallbackMatch = null;
  const normalizedParticipantNames = [...new Set((participantNames || []).map((name) => (name || "").trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  for (const match of text.matchAll(/(^|\s)@/gu)) {
    const prefix = match[1] || "";
    const atStart = (match.index || 0) + prefix.length;
    const afterAt = text.slice(atStart + 1);
    const lowerAfterAt = afterAt.toLocaleLowerCase();
    const matchedName = normalizedParticipantNames.find((name) => {
      const lowerName = name.toLocaleLowerCase();
      if (!lowerAfterAt.startsWith(lowerName)) return false;
      const boundaryChar = afterAt.charAt(name.length);
      return isAssigneeBoundaryChar(boundaryChar);
    });
    if (matchedName) {
      const value = `@${matchedName}`;
      exactMatch = { value, start: atStart, end: atStart + value.length };
    }
  }

  for (const match of text.matchAll(/(^|\s)(@[\p{L}\p{N}_]+)/gu)) {
    const prefix = match[1] || "";
    const value = match[2] || "";
    const start = (match.index || 0) + prefix.length;
    fallbackMatch = { value, start, end: start + value.length };
  }

  return exactMatch || fallbackMatch;
}

function findLastDueDate(text, locale) {
  const datePatterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}\.\d{4}\b/g,
    /\b\d{1,2}\.\d{1,2}(?:\.\d{2}|\.\d{4})?\b/g,
    /\b\d{1,2}\/\d{4}\b/g,
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2}|\/\d{4})?\b/g,
  ];
  let last = null;
  datePatterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const token = match[0] || "";
      const iso = parseLooseDateToken(token, locale);
      if (!iso) continue;
      const start = match.index || 0;
      const candidate = { value: token, iso, start, end: start + token.length };
      if (!last || candidate.start >= last.start) last = candidate;
    }
  });
  return last;
}

function removeRanges(text, ranges) {
  return [...ranges]
    .sort((a, b) => b.start - a.start)
    .reduce((acc, range) => `${acc.slice(0, range.start)}${acc.slice(range.end)}`, text);
}

function extractAutoTaskFromLine(line, locale, participantNames = []) {
  const normalizedLine = (line || "")
    .trim()
    .replace(/^\s*(?:-\s+|\d+(?:\.\d+)*\.\s+)/, "")
    .trim();
  if (!normalizedLine) return null;

  const assignee = findLastAssigneeTag(normalizedLine, participantNames);
  if (!assignee) return null;
  const dueDate = findLastDueDate(normalizedLine, locale);

  const ranges = [assignee, dueDate].filter(Boolean);
  let title = removeRanges(normalizedLine, ranges)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g, "")
    .trim();
  if (!title) title = normalizedLine;

  return {
    title,
    assignee: assignee.value,
    due: dueDate ? dueDate.iso : "",
    completed: false,
  };
}

export function createTaskResolver({
  locale,
  normalizeRawText,
  normalizeTasks,
  renderParticipantsToInput,
  renderTopicsModelToInput,
  renderDecisionsToInput,
  collectParticipantReferenceNames,
}) {
  const collectAutoTasks = (doc) => {
    const participantsRaw = normalizeRawText(
      doc.participantsRaw ?? renderParticipantsToInput(doc.participants || []),
    );
    const topicsRaw = normalizeRawText(doc.topicsRaw ?? renderTopicsModelToInput(doc.topics || []));
    const decisionsRaw = normalizeRawText(doc.decisionsRaw ?? renderDecisionsToInput(doc.decisions || []));
    const participantNames = collectParticipantReferenceNames(participantsRaw);

    return [participantsRaw, topicsRaw, decisionsRaw]
      .flatMap((chunk) => chunk.split("\n"))
      .map((line) => extractAutoTaskFromLine(line, locale, participantNames))
      .filter(Boolean);
  };

  const resolveDocumentTasks = (doc) => {
    const manualTasks = normalizeTasks(doc.tasks || []);
    const autoTasks = collectAutoTasks(doc);
    const seen = new Set(manualTasks.map((task) => `${task.title}\u0000${task.assignee}\u0000${task.due}`));
    const merged = [...manualTasks];
    autoTasks.forEach((task) => {
      const key = `${task.title}\u0000${task.assignee}\u0000${task.due}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(task);
    });
    return merged;
  };

  return {
    resolveDocumentTasks,
  };
}
