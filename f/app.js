import {
  bindParticipantsInput,
  collectParticipantsFromInput,
  renderParticipantsToInput,
} from "./participants-input.js";
import {
  bindTopicsInput,
  collectTopicsFromInput,
  normalizeTopic,
  renderTopicsModelToInput,
} from "./topics-input.js";
import { createI18n, resolveLocale } from "./i18n/index.js";
import { getRandomHeaderPair } from "./i18n/header-pairs/index.js";

const STORAGE_KEY = "followup_docs_v1";
const TRASH_KEY = "followup_trash_v1";
const DRAFT_KEY = "followup_draft_v1";
const DELETE_CONFIRM_TIMEOUT_MS = 3000;
const MEETING_TITLE_MAX_LENGTH = 160;
const COPY_FEEDBACK_MS = 1200;
const ACTION_FEEDBACK_MS = 900;
const activeLocale = resolveLocale();
const { t, applyToDocument, intlLocale } = createI18n(activeLocale);
const copyFeedbackTimers = new WeakMap();
const copyFeedbackInitialState = new WeakMap();
const actionFeedbackTimers = new WeakMap();

const state = {
  currentId: null,
  pendingDeleteDocId: null,
  pendingDeleteTimerId: null,
  pendingPurgeDocId: null,
  pendingPurgeTimerId: null,
  pendingTaskRemoveBtn: null,
  pendingTaskRemoveTimerId: null,
};

const els = {
  meetingDate: document.getElementById("meetingDate"),
  meetingTitle: document.getElementById("meetingTitle"),
  meta: document.getElementById("meta"),
  participantsInput: document.getElementById("participantsInput"),
  topicsInput: document.getElementById("topicsInput"),
  decisionsInput: document.getElementById("decisionsInput"),
  tasks: document.getElementById("tasks"),
  preview: document.getElementById("preview"),
  storedDocs: document.getElementById("storedDocs"),
  trashDocs: document.getElementById("trashDocs"),
  deadlineReport: document.getElementById("deadlineReport"),
  ownerReport: document.getElementById("ownerReport"),
  saveBtn: document.getElementById("saveBtn"),
  saveAsNewBtn: document.getElementById("saveAsNewBtn"),
  newBtn: document.getElementById("newBtn"),
  saveHint: document.getElementById("saveHint"),
  copyDocLink: document.getElementById("copyDocLink"),
  copyProtocol: document.getElementById("copyProtocol"),
  exportMd: document.getElementById("exportMd"),
  exportDocx: document.getElementById("exportDocx"),
  exportPdf: document.getElementById("exportPdf"),
  unsavedOpenDialog: document.getElementById("unsavedOpenDialog"),
  inputPanelTitle: document.getElementById("inputPanelTitle"),
  previewPanelTitle: document.getElementById("previewPanelTitle"),
};

function applyRandomHeaderPair() {
  const [leftTitle, rightTitle] = getRandomHeaderPair(activeLocale);
  if (els.inputPanelTitle) els.inputPanelTitle.textContent = leftTitle;
  if (els.previewPanelTitle) els.previewPanelTitle.textContent = rightTitle;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function getDocs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setDocs(docs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function getTrashDocs() {
  try {
    return JSON.parse(localStorage.getItem(TRASH_KEY) || "[]");
  } catch {
    return [];
  }
}

function setTrashDocs(docs) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(docs));
}

function getDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

function setDraft(doc) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
}

function hasUserContent(text) {
  return /[^\s.:;,\-]/u.test(text || "");
}

function normalizeRawText(value) {
  return (value || "").replaceAll("\r", "").trim();
}

function normalizeTasks(tasks) {
  return (tasks || [])
    .map((task) => ({
      title: (task.title || "").trim(),
      owner: (task.owner || "").trim(),
      due: task.due || "",
      completed: Boolean(task.completed),
    }))
    .filter((task) => Boolean(task.title));
}

function docSnapshot(doc) {
  return JSON.stringify({
    meetingDate: doc.meetingDate || "",
    meetingTitle: (doc.meetingTitle || "").trim(),
    meta: (doc.meta || "").trim(),
    participantsRaw: normalizeRawText(
      doc.participantsRaw ?? renderParticipantsToInput(doc.participants || []),
    ),
    topicsRaw: normalizeRawText(doc.topicsRaw ?? renderTopicsModelToInput(doc.topics || [])),
    decisionsRaw: normalizeRawText(doc.decisionsRaw ?? renderDecisionsToInput(doc.decisions || [])),
    tasks: normalizeTasks(doc.tasks),
  });
}

function findSavedDocById(docId) {
  if (!docId) return null;
  return getDocs().find((doc) => doc.id === docId) || null;
}

function hasUnsavedChangesVsStored(doc) {
  const stored = findSavedDocById(doc.id);
  if (!stored) return false;
  return docSnapshot(stored) !== docSnapshot(doc);
}

function updateSaveUi(doc) {
  const isStored = Boolean(findSavedDocById(doc.id));
  const changedStored = isStored && hasUnsavedChangesVsStored(doc);
  const canSaveCurrent = !isStored || changedStored;
  const canSaveAsNew = isStored;
  els.saveBtn.disabled = !canSaveCurrent;
  els.saveAsNewBtn.disabled = !canSaveAsNew;

  const save = t("actions.save");
  const saveAsNew = t("actions.saveAsNew");
  els.saveBtn.textContent = save;
  els.saveBtn.title = save;
  els.saveBtn.setAttribute("aria-label", save);
  els.saveAsNewBtn.textContent = saveAsNew;
  els.saveAsNewBtn.title = saveAsNew;
  els.saveAsNewBtn.setAttribute("aria-label", saveAsNew);
  if (isStored) {
    if (changedStored) {
      els.saveHint.textContent = t("actions.saveHintChangedStored");
      return;
    }
    els.saveHint.textContent = t("actions.saveHintStored");
    return;
  }

  els.saveHint.textContent = t("actions.saveHintDraft");
}

function hasLocalEditsInDraft(doc) {
  const hasMainFields = Boolean(
    (doc.meetingTitle || "").trim() ||
      (doc.meta || "").trim() !== getLastMeta() ||
      hasUserContent(doc.participantsRaw) ||
      hasUserContent(doc.topicsRaw) ||
      hasUserContent(doc.decisionsRaw),
  );
  if (hasMainFields) return true;
  return (doc.tasks || []).some((task) => Boolean((task.title || "").trim()));
}

function shouldConfirmReset() {
  const doc = collectForm();
  const isStored = Boolean(findSavedDocById(doc.id));
  if (isStored) return hasUnsavedChangesVsStored(doc);
  return hasLocalEditsInDraft(doc);
}

function rowTemplate(type, value = {}) {
  if (type === "tasks") {
    const wrap = document.createElement("div");
    wrap.className = "row-task";
    wrap.innerHTML = `
      <input type="checkbox" data-field="completed" ${value.completed ? "checked" : ""} title="${t("row.taskDone")}" aria-label="${t("row.taskDone")}">
      <input type="text" data-field="title" placeholder="${t("row.taskTitle")}" value="${value.title || ""}">
      <input type="text" data-field="owner" placeholder="${t("row.taskOwner")}" value="${value.owner || ""}">
      <input type="date" data-field="due" value="${value.due || ""}">
      <button type="button" class="ghost icon-btn" data-add="tasks" title="${t("row.addTask")}" aria-label="${t("row.addTask")}">
        <span class="material-symbols-outlined" aria-hidden="true">add</span>
      </button>
      <button type="button" class="ghost icon-btn" data-remove-task title="${t("row.removeTask")}" aria-label="${t("row.removeTask")}">
        <span class="material-symbols-outlined" aria-hidden="true">delete</span>
      </button>
    `;
    return wrap;
  }

  const wrap = document.createElement("div");
  wrap.className = "row";
  wrap.innerHTML = `
    <input type="text" data-field="text" placeholder="${t("row.value")}" value="${value.text || ""}">
    <button type="button" class="ghost" data-remove>${t("common.remove")}</button>
  `;
  return wrap;
}

function addRow(type, value = {}) {
  const root = els[type];
  root.appendChild(rowTemplate(type, value));
}

function collectRows(type) {
  const rows = [...els[type].children];
  if (type === "tasks") {
    return rows
      .map((row) => {
        const title = row.querySelector('[data-field="title"]').value.trim();
        const owner = row.querySelector('[data-field="owner"]').value.trim();
        const due = row.querySelector('[data-field="due"]').value;
        const completed = row.querySelector('[data-field="completed"]').checked;
        if (!title) return null;
        return { title, owner, due, completed };
      })
      .filter(Boolean);
  }

  return rows
    .map((row) => row.querySelector('[data-field="text"]').value.trim())
    .filter((text) => hasUserContent(text))
    .map((text) => ({ text }));
}

function collectDecisionsFromInput(rawText) {
  return (rawText || "")
    .replace(/,\s*\n\s*/g, ", ")
    .replaceAll("\r", "")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*•\s]+/, "").replace(/^\d+[.)]\s*/, "").replace(/[.;:]+\s*$/, "").trim())
    .filter((line) => hasUserContent(line))
    .map((text) => ({ text }));
}

function renderDecisionsToInput(decisions) {
  return (decisions || []).map((d) => d.text || "").filter(Boolean).join("\n");
}

function collectForm() {
  return {
    id: state.currentId || uid(),
    meetingDate: els.meetingDate.value,
    meetingTitle: els.meetingTitle.value.trim().slice(0, MEETING_TITLE_MAX_LENGTH),
    meta: els.meta.value.trim(),
    participantsRaw: els.participantsInput.value,
    topicsRaw: els.topicsInput.value,
    decisionsRaw: els.decisionsInput.value,
    participants: collectParticipantsFromInput(els.participantsInput.value),
    topics: collectTopicsFromInput(els.topicsInput.value),
    decisions: collectDecisionsFromInput(els.decisionsInput.value),
    tasks: collectRows("tasks"),
    updatedAt: new Date().toISOString(),
  };
}

function generateText(doc) {
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

  lines.push(`4. ${t("protocol.tasks")}:`);
  if (doc.tasks.length === 0) lines.push(`4.1. ${t("common.empty")}`);
  doc.tasks.forEach((task, index) => {
    const status = task.completed ? "[v]" : "[ ]";
    const owner = task.owner || t("common.unassigned");
    const due = formatDueDate(task.due);
    lines.push(emphasizeLine(`4.${index + 1}. ${status} ${task.title} — ${owner}, ${due}`));
  });
  lines.push("");
  lines.push(t("protocol.footer"));

  return lines.join("\n");
}

function generateMarkdownText(doc) {
  const escapeOrderedPrefix = (line) => line.replace(/^(\s*\d+)\./, "$1\\.");
  return generateText(doc)
    .split("\n")
    .map((line) => {
      if (!line) return "";
      return `${escapeOrderedPrefix(line)}  `;
    })
    .join("\n");
}

function escapeHtml(value) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderPreviewText(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function buildClipboardHtml(text) {
  return `<div style="white-space: pre-wrap;">${renderPreviewText(text)}</div>`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString(intlLocale);
}

function renderReportList(target, items) {
  target.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = t("common.noData");
    target.appendChild(li);
    return;
  }

  items.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    target.appendChild(li);
  });
}

function collectReportDocs() {
  const docs = getDocs();
  const draft = collectForm();
  const withoutCurrent = docs.filter((doc) => doc.id !== draft.id);
  return [draft, ...withoutCurrent];
}

function renderTaskReports() {
  const allDocs = collectReportDocs();
  const allTasks = [];

  allDocs.forEach((doc) => {
    (doc.tasks || []).forEach((task) => {
      if (!task.title) return;
      if (task.completed) return;
      allTasks.push({
        ...task,
        meetingTitle: doc.meetingTitle || t("common.untitled"),
        meetingDate: doc.meetingDate || "",
      });
    });
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  let overdue = 0;
  let week = 0;
  let noDate = 0;

  allTasks.forEach((task) => {
    if (!task.due) {
      noDate += 1;
      return;
    }
    const due = new Date(task.due);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      overdue += 1;
      return;
    }
    if (due <= weekEnd) week += 1;
  });

  const byOwnerMap = allTasks.reduce((acc, task) => {
    const owner = task.owner || t("common.unassigned");
    acc.set(owner, (acc.get(owner) || 0) + 1);
    return acc;
  }, new Map());

  const byOwner = [...byOwnerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([owner, count]) => `${owner}: ${count}`);

  const nearestTasks = allTasks
    .filter((task) => Boolean(task.due))
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 3)
    .map((task) => `${formatDate(task.due)} - ${task.title} (${task.owner || t("common.unassigned")})`);

  renderReportList(els.deadlineReport, [
    t("reports.totalTasks", { count: allTasks.length }),
    t("reports.overdue", { count: overdue }),
    t("reports.next7Days", { count: week }),
    t("reports.noDue", { count: noDate }),
    ...nearestTasks,
  ]);

  renderReportList(els.ownerReport, byOwner);
}

function updatePreview() {
  const doc = collectForm();
  state.currentId = doc.id;
  const rendered = generateText(doc);
  els.preview.innerHTML = renderPreviewText(rendered);
  syncUrlWithDoc(doc.id);
  renderTaskReports();
  updateSaveUi(doc);
  setDraft(doc);
}

function getTodayIsoLocal() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function getLastMeta() {
  const docs = getDocs();
  if (!docs.length) return "#followup";
  const latestWithMeta = docs.find((doc) => (doc.meta || "").trim());
  return latestWithMeta ? latestWithMeta.meta : "#followup";
}

function resetForm() {
  clearPendingTaskRemove();
  state.currentId = null;
  els.meetingDate.value = getTodayIsoLocal();
  els.meetingTitle.value = "";
  els.meta.value = getLastMeta();
  els.participantsInput.value = "";
  els.topicsInput.value = "";
  els.decisionsInput.value = "";

  ["tasks"].forEach((key) => {
    els[key].innerHTML = "";
    addRow(key);
  });

  updatePreview();
}

function fillForm(doc) {
  clearPendingTaskRemove();
  state.currentId = doc.id;
  els.meetingDate.value = doc.meetingDate || "";
  els.meetingTitle.value = doc.meetingTitle || "";
  els.meta.value = doc.meta || "";
  els.participantsInput.value = doc.participantsRaw ?? renderParticipantsToInput(doc.participants || []);
  els.topicsInput.value = doc.topicsRaw ?? renderTopicsModelToInput(doc.topics || []);
  els.decisionsInput.value = doc.decisionsRaw ?? renderDecisionsToInput(doc.decisions || []);

  ["tasks"].forEach((key) => {
    els[key].innerHTML = "";
  });

  if ((doc.tasks || []).length === 0) addRow("tasks");
  (doc.tasks || []).forEach((v) => addRow("tasks", v));

  updatePreview();
}

function saveDoc() {
  const doc = collectForm();
  if (!doc.meetingDate || !doc.meetingTitle) {
    alert(t("alerts.fillDateAndTitle"));
    return false;
  }

  const docs = getDocs();
  const index = docs.findIndex((d) => d.id === doc.id);
  if (index >= 0) {
    docs[index] = { ...doc, updatedAt: new Date().toISOString() };
    state.currentId = doc.id;
  } else {
    docs.unshift(doc);
    state.currentId = doc.id;
  }

  setDocs(docs);
  updatePreview();
  renderStoredDocs();
  showActionSuccess(els.saveBtn);
  return true;
}

function saveAsNewDoc() {
  const doc = collectForm();
  if (!doc.meetingDate || !doc.meetingTitle) {
    alert(t("alerts.fillDateAndTitle"));
    return false;
  }

  const docs = getDocs();
  const next = { ...doc, id: uid(), updatedAt: new Date().toISOString() };
  docs.unshift(next);
  state.currentId = next.id;

  setDocs(docs);
  updatePreview();
  renderStoredDocs();
  showActionSuccess(els.saveAsNewBtn);
  return true;
}

function clearForm() {
  if (shouldConfirmReset()) {
    const ok = window.confirm(t("alerts.unsavedReset"));
    if (!ok) return;
  }
  resetForm();
}

function resetTaskRemoveButton(btn) {
  if (!btn) return;
  btn.classList.remove("icon-btn-danger");
  btn.title = t("row.removeTask");
  btn.setAttribute("aria-label", t("row.removeTask"));
  const icon = btn.querySelector(".material-symbols-outlined");
  if (icon) icon.textContent = "delete";
}

function clearPendingTaskRemove(options = {}) {
  const { resetButton = true } = options;
  if (state.pendingTaskRemoveTimerId !== null) {
    window.clearTimeout(state.pendingTaskRemoveTimerId);
    state.pendingTaskRemoveTimerId = null;
  }
  if (!state.pendingTaskRemoveBtn) return;
  if (resetButton && state.pendingTaskRemoveBtn.isConnected) resetTaskRemoveButton(state.pendingTaskRemoveBtn);
  state.pendingTaskRemoveBtn = null;
}

function armPendingTaskRemove(btn) {
  clearPendingTaskRemove();
  state.pendingTaskRemoveBtn = btn;
  btn.classList.add("icon-btn-danger");
  btn.title = t("row.removeTaskConfirm");
  btn.setAttribute("aria-label", t("row.removeTaskConfirm"));
  const icon = btn.querySelector(".material-symbols-outlined");
  if (icon) icon.textContent = "error";
  state.pendingTaskRemoveTimerId = window.setTimeout(() => {
    if (state.pendingTaskRemoveBtn !== btn) return;
    clearPendingTaskRemove();
  }, DELETE_CONFIRM_TIMEOUT_MS);
}

function clearPendingDelete(options = {}) {
  const { rerender = true } = options;
  if (state.pendingDeleteTimerId !== null) {
    window.clearTimeout(state.pendingDeleteTimerId);
    state.pendingDeleteTimerId = null;
  }
  if (state.pendingDeleteDocId === null) return;
  state.pendingDeleteDocId = null;
  if (rerender) renderStoredDocs();
}

function armPendingDelete(docId) {
  if (!findSavedDocById(docId)) return;
  clearPendingDelete({ rerender: false });
  state.pendingDeleteDocId = docId;
  state.pendingDeleteTimerId = window.setTimeout(() => {
    state.pendingDeleteTimerId = null;
    if (state.pendingDeleteDocId !== docId) return;
    state.pendingDeleteDocId = null;
    renderStoredDocs();
  }, DELETE_CONFIRM_TIMEOUT_MS);
  renderStoredDocs();
}

function clearPendingPurge(options = {}) {
  const { rerender = true } = options;
  if (state.pendingPurgeTimerId !== null) {
    window.clearTimeout(state.pendingPurgeTimerId);
    state.pendingPurgeTimerId = null;
  }
  if (state.pendingPurgeDocId === null) return;
  state.pendingPurgeDocId = null;
  if (rerender) renderTrashDocs();
}

function armPendingPurge(docId) {
  if (!getTrashDocs().some((doc) => doc.id === docId)) return;
  clearPendingPurge({ rerender: false });
  state.pendingPurgeDocId = docId;
  state.pendingPurgeTimerId = window.setTimeout(() => {
    state.pendingPurgeTimerId = null;
    if (state.pendingPurgeDocId !== docId) return;
    state.pendingPurgeDocId = null;
    renderTrashDocs();
  }, DELETE_CONFIRM_TIMEOUT_MS);
  renderTrashDocs();
}

function renderStoredDocs() {
  const docs = getDocs();
  if (state.pendingDeleteDocId && !docs.some((doc) => doc.id === state.pendingDeleteDocId)) {
    clearPendingDelete({ rerender: false });
  }
  els.storedDocs.innerHTML = "";

  docs.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "stored-doc-row";
    li.dataset.docId = doc.id;
    const updatedAt = new Date(doc.updatedAt).toLocaleString(intlLocale);
    const meta = `${updatedAt} · [${doc.id}]`;
    const isDeletePending = state.pendingDeleteDocId === doc.id;
    const deleteBtnClass = isDeletePending ? "ghost icon-btn icon-btn-danger" : "ghost icon-btn";
    const deleteIcon = isDeletePending ? "error" : "delete";
    const deleteLabel = isDeletePending ? t("stored.deleteDocConfirm") : t("stored.deleteDoc");
    li.innerHTML = `
      <div>
        <div><strong>${doc.meetingDate || ""}</strong> ${doc.meetingTitle || t("common.untitled")}</div>
        <div class="doc-meta">${meta}</div>
      </div>
      <div class="stored-actions">
        <button
          type="button"
          class="ghost icon-btn"
          data-copy-doc-link="${doc.id}"
          title="${t("stored.copyDocLink")}"
          aria-label="${t("stored.copyDocLink")}"
        >
          <span class="material-symbols-outlined" aria-hidden="true">link</span>
        </button>
        <button
          type="button"
          class="${deleteBtnClass}"
          data-delete-doc="${doc.id}"
          title="${deleteLabel}"
          aria-label="${deleteLabel}"
        >
          <span class="material-symbols-outlined" aria-hidden="true">${deleteIcon}</span>
        </button>
      </div>
    `;
    els.storedDocs.appendChild(li);
  });
}

function renderTrashDocs() {
  const docs = getTrashDocs();
  if (state.pendingPurgeDocId && !docs.some((doc) => doc.id === state.pendingPurgeDocId)) {
    clearPendingPurge({ rerender: false });
  }
  els.trashDocs.innerHTML = "";
  if (!docs.length) return;

  docs.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "trash-doc-row";
    const meta = doc.deletedAt
      ? `${t("stored.deletedAt")}: ${new Date(doc.deletedAt).toLocaleString(intlLocale)}`
      : "";
    const isPurgePending = state.pendingPurgeDocId === doc.id;
    const purgeBtnClass = isPurgePending ? "ghost icon-btn icon-btn-danger" : "ghost icon-btn";
    const purgeIcon = isPurgePending ? "error" : "delete_forever";
    const purgeLabel = isPurgePending ? t("stored.deleteForeverConfirm") : t("stored.deleteForeverDoc");
    li.innerHTML = `
      <div>
        <div><strong>${doc.meetingDate || ""}</strong> ${doc.meetingTitle || t("common.untitled")}</div>
        <div class="doc-meta">${meta}</div>
      </div>
      <div class="stored-actions">
        <button
          type="button"
          class="ghost icon-btn"
          data-restore-doc="${doc.id}"
          title="${t("stored.restoreDoc")}"
          aria-label="${t("stored.restoreDoc")}"
        >
          <span class="material-symbols-outlined" aria-hidden="true">restore_from_trash</span>
        </button>
        <button
          type="button"
          class="${purgeBtnClass}"
          data-purge-doc="${doc.id}"
          title="${purgeLabel}"
          aria-label="${purgeLabel}"
        >
          <span class="material-symbols-outlined" aria-hidden="true">${purgeIcon}</span>
        </button>
      </div>
    `;
    els.trashDocs.appendChild(li);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMd() {
  const doc = collectForm();
  const blob = new Blob([generateMarkdownText(doc)], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `${doc.meetingDate || t("common.fileBase")}-${doc.id}.md`);
}

function openStoredDoc(docId) {
  const doc = findSavedDocById(docId);
  if (!doc) return;
  fillForm(doc);
  window.location.hash = `#/doc/${doc.id}`;
}

function requestUnsavedOpenAction() {
  const dialog = els.unsavedOpenDialog;
  if (!dialog || typeof dialog.showModal !== "function") {
    const ok = window.confirm(t("alerts.unsavedReset"));
    return Promise.resolve(ok ? "discard" : "cancel");
  }
  if (dialog.open) dialog.close("cancel");
  return new Promise((resolve) => {
    const onClose = () => {
      const choice = dialog.returnValue || "cancel";
      resolve(choice);
    };
    dialog.addEventListener("close", onClose, { once: true });
    dialog.showModal();
  });
}

async function openStoredDocWithGuard(docId) {
  if (state.currentId === docId) return;
  if (!shouldConfirmReset()) {
    openStoredDoc(docId);
    return;
  }

  const choice = await requestUnsavedOpenAction();
  if (choice === "cancel") return;
  if (choice === "discard") {
    openStoredDoc(docId);
    return;
  }
  if (choice === "save_as_new") {
    const saved = saveAsNewDoc();
    if (saved) openStoredDoc(docId);
    return;
  }
  if (choice === "save_current") {
    const saved = saveDoc();
    if (saved) openStoredDoc(docId);
  }
}

async function exportDocx() {
  const doc = collectForm();
  const { Document, Packer, Paragraph, TextRun } = await import("https://cdn.jsdelivr.net/npm/docx@9.0.3/+esm");
  const paragraphs = generateText(doc).split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] }));
  const file = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(file);
  downloadBlob(blob, `${doc.meetingDate || t("common.fileBase")}-${doc.id}.docx`);
}

function exportPdf() {
  const doc = collectForm();
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
}

function syncUrlWithDoc(docId) {
  if (!docId) return;
  const nextHash = `#/doc/${docId}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${nextHash}`);
}

function getDocUrl(docId) {
  const url = new URL(window.location.href);
  url.hash = `#/doc/${docId}`;
  return url.toString();
}

function showActionSuccess(button) {
  if (!button) return;
  const existingTimer = actionFeedbackTimers.get(button);
  if (existingTimer) window.clearTimeout(existingTimer);
  button.classList.add("btn-success");
  const timerId = window.setTimeout(() => {
    actionFeedbackTimers.delete(button);
    if (!button.isConnected) return;
    button.classList.remove("btn-success");
  }, ACTION_FEEDBACK_MS);
  actionFeedbackTimers.set(button, timerId);
}

function showCopySuccess(button) {
  if (!button) return;
  const existingTimer = copyFeedbackTimers.get(button);
  if (existingTimer) window.clearTimeout(existingTimer);
  if (!copyFeedbackInitialState.has(button)) {
    const icon = button.querySelector(".material-symbols-outlined");
    copyFeedbackInitialState.set(button, {
      title: button.getAttribute("title") || "",
      aria: button.getAttribute("aria-label") || "",
      icon: icon ? icon.textContent : "",
    });
  }
  const base = copyFeedbackInitialState.get(button);
  const icon = button.querySelector(".material-symbols-outlined");
  const copied = t("common.copied");

  button.classList.add("copy-success");
  button.setAttribute("title", copied);
  button.setAttribute("aria-label", copied);
  if (icon) icon.textContent = "check_circle";

  const timerId = window.setTimeout(() => {
    copyFeedbackTimers.delete(button);
    if (!button.isConnected) return;
    button.classList.remove("copy-success");
    button.setAttribute("title", base.title);
    button.setAttribute("aria-label", base.aria);
    if (icon) icon.textContent = base.icon;
  }, COPY_FEEDBACK_MS);

  copyFeedbackTimers.set(button, timerId);
}

async function writeToClipboard(text, feedbackButton) {
  try {
    await navigator.clipboard.writeText(text);
    showCopySuccess(feedbackButton);
  } catch {}
}

async function writeRichToClipboard(text, html, feedbackButton) {
  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      const payload = new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      });
      await navigator.clipboard.write([payload]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    showCopySuccess(feedbackButton);
  } catch {
    writeToClipboard(text, feedbackButton);
  }
}

function copyDocLink(feedbackButton) {
  const doc = collectForm();
  writeToClipboard(getDocUrl(doc.id), feedbackButton);
}

function copyStoredDocLink(docId, feedbackButton) {
  if (!docId) return;
  writeToClipboard(getDocUrl(docId), feedbackButton);
}

function deleteStoredDoc(docId) {
  if (state.pendingDeleteDocId !== docId) {
    armPendingDelete(docId);
    return;
  }
  clearPendingDelete({ rerender: false });
  const docs = getDocs();
  const index = docs.findIndex((doc) => doc.id === docId);
  if (index < 0) return;
  const doc = docs[index];
  const nextDocs = docs.filter((item) => item.id !== docId);
  const trashDocs = getTrashDocs().filter((item) => item.id !== docId);
  trashDocs.unshift({ ...doc, deletedAt: new Date().toISOString() });
  setDocs(nextDocs);
  setTrashDocs(trashDocs);
  if (state.currentId === docId) resetForm();
  renderStoredDocs();
  renderTrashDocs();
  renderTaskReports();
}

function restoreTrashDoc(docId) {
  const trashDocs = getTrashDocs();
  const index = trashDocs.findIndex((doc) => doc.id === docId);
  if (index < 0) return;
  const { deletedAt: _deletedAt, ...restored } = trashDocs[index];
  const docs = getDocs().filter((doc) => doc.id !== docId);
  docs.unshift(restored);
  setDocs(docs);
  setTrashDocs(trashDocs.filter((doc) => doc.id !== docId));
  renderStoredDocs();
  renderTrashDocs();
  renderTaskReports();
}

function purgeTrashDoc(docId) {
  if (state.pendingPurgeDocId !== docId) {
    armPendingPurge(docId);
    return;
  }
  clearPendingPurge({ rerender: false });
  const trashDocs = getTrashDocs();
  const next = trashDocs.filter((doc) => doc.id !== docId);
  if (next.length === trashDocs.length) return;
  setTrashDocs(next);
  renderTrashDocs();
}

function copyProtocolToClipboard() {
  const text = generateText(collectForm());
  if (!text.trim()) return;
  writeRichToClipboard(text, buildClipboardHtml(text), els.copyProtocol);
}

function openByHash() {
  const m = window.location.hash.match(/#\/doc\/([a-z0-9]+)/i);
  if (!m) return false;

  const doc = getDocs().find((d) => d.id === m[1]);
  if (!doc) return false;
  fillForm(doc);
  return true;
}

function restoreDraftIfAny() {
  const draft = getDraft();
  if (!draft || typeof draft !== "object") return false;
  fillForm(draft);
  return true;
}

function handleSaveShortcut(event) {
  const isSaveKey = event.code === "KeyS";
  const isModifierPressed = event.ctrlKey || event.metaKey;
  if (!isSaveKey || !isModifierPressed) return;
  event.preventDefault();
  const doc = collectForm();
  saveDoc();
}

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) {
    addRow(add.dataset.add);
    updatePreview();
    return;
  }

  const remove = e.target.closest("[data-remove]");
  if (remove) {
    const parent = remove.parentElement;
    const root = parent.parentElement;
    parent.remove();
    if (!root.children.length) addRow(root.id);
    updatePreview();
    return;
  }

  const removeTask = e.target.closest("[data-remove-task]");
  if (removeTask) {
    if (state.pendingTaskRemoveBtn === removeTask) {
      clearPendingTaskRemove({ resetButton: false });
      const parent = removeTask.parentElement;
      const root = parent.parentElement;
      parent.remove();
      if (!root.children.length) addRow(root.id);
      updatePreview();
      return;
    }
    armPendingTaskRemove(removeTask);
    return;
  }

  const deleteStored = e.target.closest("[data-delete-doc]");
  if (deleteStored) {
    deleteStoredDoc(deleteStored.dataset.deleteDoc);
    return;
  }

  const copyStored = e.target.closest("[data-copy-doc-link]");
  if (copyStored) {
    copyStoredDocLink(copyStored.dataset.copyDocLink, copyStored);
    return;
  }

  const restoreTrash = e.target.closest("[data-restore-doc]");
  if (restoreTrash) {
    restoreTrashDoc(restoreTrash.dataset.restoreDoc);
    return;
  }

  const purgeTrash = e.target.closest("[data-purge-doc]");
  if (purgeTrash) {
    purgeTrashDoc(purgeTrash.dataset.purgeDoc);
    return;
  }

  const storedRow = e.target.closest(".stored-doc-row");
  if (storedRow && storedRow.dataset.docId) {
    openStoredDocWithGuard(storedRow.dataset.docId);
  }
});

document.addEventListener("keydown", handleSaveShortcut, { capture: true });

bindParticipantsInput({
  textarea: els.participantsInput,
});

bindTopicsInput({
  textarea: els.topicsInput,
});

applyToDocument(document);
applyRandomHeaderPair();

["input", "change"].forEach((eventName) => {
  document.addEventListener(eventName, () => updatePreview());
});

els.saveBtn.addEventListener("click", saveDoc);
els.saveAsNewBtn.addEventListener("click", saveAsNewDoc);
els.newBtn.addEventListener("click", clearForm);
els.copyDocLink.addEventListener("click", () => copyDocLink(els.copyDocLink));
els.copyProtocol.addEventListener("click", copyProtocolToClipboard);
els.exportMd.addEventListener("click", exportMd);
els.exportDocx.addEventListener("click", () => exportDocx().catch(() => alert(t("alerts.exportDocxError"))));
els.exportPdf.addEventListener("click", exportPdf);

if (!openByHash()) {
  if (!restoreDraftIfAny()) resetForm();
}
renderStoredDocs();
renderTrashDocs();
renderTaskReports();
