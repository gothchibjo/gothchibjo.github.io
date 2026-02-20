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
import {
  collectDecisionsFromInput,
  getTodayIsoLocal,
  hasUserContent,
  normalizeRawText,
  normalizeTasks,
  renderDecisionsToInput,
} from "./doc-text-utils.js";
import { createTaskResolver } from "./task-resolver.js";
import {
  buildClipboardHtml,
  createProtocolRenderers,
  formatDate,
  renderPreviewText,
} from "./protocol-render.js";
import { createDocRepository, DEFAULT_STORAGE_KEYS, uid } from "./domain/doc-repository.js";
import { createMentionUiController } from "./ui/mention-ui.js";
import { handleStoredDocsClick, handleTaskListClick } from "./ui/list-action-handlers.js";
import { createReportService } from "./services/report-service.js";
import { createClipboardService } from "./services/clipboard-service.js";
import { createExportService } from "./services/export-service.js";
import { createI18n, resolveLocale } from "./i18n/index.js";
import { getRandomHeaderPair } from "./i18n/header-pairs/index.js";

const DELETE_CONFIRM_TIMEOUT_MS = 3000;
const MEETING_TITLE_MAX_LENGTH = 160;
const ACTION_FEEDBACK_MS = 900;
const activeLocale = resolveLocale();
const { t, applyToDocument, intlLocale } = createI18n(activeLocale);
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

const repository = createDocRepository({ keys: DEFAULT_STORAGE_KEYS });

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
  assigneeReport: document.getElementById("assigneeReport"),
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

const { resolveDocumentTasks } = createTaskResolver({
  locale: activeLocale,
  normalizeRawText,
  normalizeTasks,
  renderParticipantsToInput,
  renderTopicsModelToInput,
  renderDecisionsToInput,
  collectParticipantReferenceNames: (participantsRaw) => collectParticipantReferenceNames(participantsRaw),
});

const { generateText, generateMarkdownText } = createProtocolRenderers({
  t,
  intlLocale,
  normalizeTopic,
  resolveDocumentTasks,
});

const reportService = createReportService({
  t,
  intlLocale,
  formatDate,
  resolveDocumentTasks,
  getDocs: () => repository.getDocs(),
  collectDraftDoc: () => collectForm(),
  deadlineReportEl: els.deadlineReport,
  assigneeReportEl: els.assigneeReport,
});

const clipboardService = createClipboardService({
  t,
});

const exportService = createExportService({
  t,
  generateText,
  generateMarkdownText,
});

function applyRandomHeaderPair() {
  const [leftTitle, rightTitle] = getRandomHeaderPair(activeLocale);
  if (els.inputPanelTitle) els.inputPanelTitle.textContent = leftTitle;
  if (els.previewPanelTitle) els.previewPanelTitle.textContent = rightTitle;
}

function collectParticipantNameFrequency(currentParticipantsRaw = "") {
  const score = new Map();
  const bump = (name) => {
    const cleaned = (name || "").trim().replace(/^@+/, "");
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase();
    const prev = score.get(key);
    if (prev) {
      prev.count += 1;
      return;
    }
    score.set(key, { name: cleaned, count: 1 });
  };

  collectParticipantsFromInput(currentParticipantsRaw).forEach((item) => bump(item.text));
  repository.getDocs().forEach((doc) => {
    collectParticipantsFromInput(doc.participantsRaw || "").forEach((item) => bump(item.text));
  });

  return score;
}

function collectParticipantReferenceNames(currentParticipantsRaw = "") {
  return [...collectParticipantNameFrequency(currentParticipantsRaw).values()]
    .map((item) => item.name);
}

function collectParticipantCandidates() {
  return [...collectParticipantNameFrequency(els.participantsInput.value).values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, intlLocale))
    .map((item) => item.name);
}

const mentionController = createMentionUiController({
  participantsInput: els.participantsInput,
  topicsInput: els.topicsInput,
  decisionsInput: els.decisionsInput,
  getParticipantCandidates: collectParticipantCandidates,
});

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

function hasUnsavedChangesVsStored(doc) {
  const stored = repository.findSavedDocById(doc.id);
  if (!stored) return false;
  return docSnapshot(stored) !== docSnapshot(doc);
}

function updateSaveUi(doc) {
  const isStored = Boolean(repository.findSavedDocById(doc.id));
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
  const isStored = Boolean(repository.findSavedDocById(doc.id));
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
      <input type="text" data-field="assignee" placeholder="${t("row.taskAssignee")}" value="${value.assignee || value.owner || ""}">
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
        const assignee = row.querySelector('[data-field="assignee"]').value.trim();
        const due = row.querySelector('[data-field="due"]').value;
        const completed = row.querySelector('[data-field="completed"]').checked;
        if (!title) return null;
        return { title, assignee, due, completed };
      })
      .filter(Boolean);
  }

  return rows
    .map((row) => row.querySelector('[data-field="text"]').value.trim())
    .filter((text) => hasUserContent(text))
    .map((text) => ({ text }));
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

function updatePreview() {
  const doc = collectForm();
  state.currentId = doc.id;
  const rendered = generateText(doc);
  els.preview.innerHTML = renderPreviewText(rendered);
  syncUrlWithDoc(doc.id);
  reportService.renderTaskReports();
  updateSaveUi(doc);
  repository.setDraft(doc);
}

function getLastMeta() {
  const docs = repository.getDocs();
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

  const docs = repository.getDocs();
  const index = docs.findIndex((d) => d.id === doc.id);
  if (index >= 0) {
    docs[index] = { ...doc, updatedAt: new Date().toISOString() };
    state.currentId = doc.id;
  } else {
    docs.unshift(doc);
    state.currentId = doc.id;
  }

  repository.setDocs(docs);
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

  const docs = repository.getDocs();
  const next = { ...doc, id: uid(), updatedAt: new Date().toISOString() };
  docs.unshift(next);
  state.currentId = next.id;

  repository.setDocs(docs);
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
  if (!repository.findSavedDocById(docId)) return;
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
  if (!repository.getTrashDocs().some((doc) => doc.id === docId)) return;
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
  const docs = repository.getDocs();
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
  const docs = repository.getTrashDocs();
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

function openStoredDoc(docId) {
  const doc = repository.findSavedDocById(docId);
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

function copyDocLink(feedbackButton) {
  const doc = collectForm();
  clipboardService.writeText(getDocUrl(doc.id), feedbackButton);
}

function copyStoredDocLink(docId, feedbackButton) {
  if (!docId) return;
  clipboardService.writeText(getDocUrl(docId), feedbackButton);
}

function deleteStoredDoc(docId) {
  if (state.pendingDeleteDocId !== docId) {
    armPendingDelete(docId);
    return;
  }
  clearPendingDelete({ rerender: false });
  const docs = repository.getDocs();
  const index = docs.findIndex((doc) => doc.id === docId);
  if (index < 0) return;
  const doc = docs[index];
  const nextDocs = docs.filter((item) => item.id !== docId);
  const trashDocs = repository.getTrashDocs().filter((item) => item.id !== docId);
  trashDocs.unshift({ ...doc, deletedAt: new Date().toISOString() });
  repository.setDocs(nextDocs);
  repository.setTrashDocs(trashDocs);
  if (state.currentId === docId) resetForm();
  renderStoredDocs();
  renderTrashDocs();
  reportService.renderTaskReports();
}

function restoreTrashDoc(docId) {
  const trashDocs = repository.getTrashDocs();
  const index = trashDocs.findIndex((doc) => doc.id === docId);
  if (index < 0) return;
  const { deletedAt: _deletedAt, ...restored } = trashDocs[index];
  const docs = repository.getDocs().filter((doc) => doc.id !== docId);
  docs.unshift(restored);
  repository.setDocs(docs);
  repository.setTrashDocs(trashDocs.filter((doc) => doc.id !== docId));
  renderStoredDocs();
  renderTrashDocs();
  reportService.renderTaskReports();
}

function purgeTrashDoc(docId) {
  if (state.pendingPurgeDocId !== docId) {
    armPendingPurge(docId);
    return;
  }
  clearPendingPurge({ rerender: false });
  const trashDocs = repository.getTrashDocs();
  const next = trashDocs.filter((doc) => doc.id !== docId);
  if (next.length === trashDocs.length) return;
  repository.setTrashDocs(next);
  renderTrashDocs();
}

function copyProtocolToClipboard() {
  const text = generateText(collectForm());
  if (!text.trim()) return;
  clipboardService.writeRich(text, buildClipboardHtml(text), els.copyProtocol);
}

function openByHash() {
  const m = window.location.hash.match(/#\/doc\/([a-z0-9]+)/i);
  if (!m) return false;

  const doc = repository.getDocs().find((d) => d.id === m[1]);
  if (!doc) return false;
  fillForm(doc);
  return true;
}

function restoreDraftIfAny() {
  const draft = repository.getDraft();
  if (!draft || typeof draft !== "object") return false;
  fillForm(draft);
  return true;
}

function handleSaveShortcut(event) {
  const isSaveKey = event.code === "KeyS";
  const isModifierPressed = event.ctrlKey || event.metaKey;
  if (!isSaveKey || !isModifierPressed) return;
  event.preventDefault();
  saveDoc();
}

document.addEventListener("click", (e) => {
  mentionController.onDocumentClick(e.target);
  if (handleTaskListClick(e.target, { addRow, updatePreview, armPendingTaskRemove, clearPendingTaskRemove, state })) return;
  handleStoredDocsClick(e.target, {
    deleteStoredDoc,
    copyStoredDocLink,
    restoreTrashDoc,
    purgeTrashDoc,
    openStoredDocWithGuard,
  });
});

document.addEventListener("keydown", handleSaveShortcut, { capture: true });
document.addEventListener("keydown", (event) => {
  mentionController.onKeydown(event);
});
document.addEventListener("input", (event) => {
  mentionController.onInput(event.target);
});
document.addEventListener(
  "scroll",
  () => {
    mentionController.onScrollOrResize();
  },
  true,
);
window.addEventListener("resize", () => {
  mentionController.onScrollOrResize();
});
document.addEventListener("focusin", (event) => {
  mentionController.onFocusIn(event.target);
});

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
els.exportMd.addEventListener("click", () => exportService.exportMd(collectForm()));
els.exportDocx.addEventListener("click", () => exportService.exportDocx(collectForm()).catch(() => alert(t("alerts.exportDocxError"))));
els.exportPdf.addEventListener("click", () => exportService.exportPdf(collectForm()));

if (!openByHash()) {
  if (!restoreDraftIfAny()) resetForm();
}
renderStoredDocs();
renderTrashDocs();
reportService.renderTaskReports();
