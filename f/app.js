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

const STORAGE_KEY = "followup_docs_v1";
const DRAFT_KEY = "followup_draft_v1";

const state = {
  currentId: null,
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
  deadlineReport: document.getElementById("deadlineReport"),
  ownerReport: document.getElementById("ownerReport"),
  saveBtn: document.getElementById("saveBtn"),
  updateBtn: document.getElementById("updateBtn"),
  newBtn: document.getElementById("newBtn"),
  saveHint: document.getElementById("saveHint"),
  copyDocLink: document.getElementById("copyDocLink"),
  copyProtocol: document.getElementById("copyProtocol"),
  exportMd: document.getElementById("exportMd"),
  exportDocx: document.getElementById("exportDocx"),
  exportPdf: document.getElementById("exportPdf"),
};

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

  if (changedStored) {
    els.saveBtn.textContent = "Сохранить как новый";
    els.updateBtn.hidden = false;
    els.saveHint.textContent = "Изменения сохранятся как новый документ. Исходный останется без изменений.";
    return;
  }

  els.saveBtn.textContent = "Сохранить";
  els.updateBtn.hidden = true;
  if (isStored) {
    els.saveHint.textContent = "Редактируется сохраненный документ.";
    return;
  }

  els.saveHint.textContent = "Новый документ (черновик).";
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
      <input type="text" data-field="title" placeholder="Что сделать" value="${value.title || ""}">
      <input type="text" data-field="owner" placeholder="@Ответственный" value="${value.owner || ""}">
      <input type="date" data-field="due" value="${value.due || ""}">
      <button type="button" class="ghost icon-btn" data-add="tasks" title="Добавить задачу" aria-label="Добавить задачу">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z" />
        </svg>
      </button>
      <button type="button" class="ghost icon-btn" data-remove title="Удалить задачу" aria-label="Удалить задачу">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 7h12l-1 14H7L6 7Zm3-4h6l1 2h4v2H4V5h4l1-2Z"
          />
        </svg>
      </button>
    `;
    return wrap;
  }

  const wrap = document.createElement("div");
  wrap.className = "row";
  wrap.innerHTML = `
    <input type="text" data-field="text" placeholder="Введите значение" value="${value.text || ""}">
    <button type="button" class="ghost" data-remove>Удалить</button>
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
        if (!title) return null;
        return { title, owner, due };
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
    meetingTitle: els.meetingTitle.value.trim(),
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
  const formatDueDate = (due) => {
    if (!due) return "без срока";
    const parsed = new Date(`${due}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return due;
    return parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
  };

  const formatListItem = (text, isLast) => {
    const trimmed = text.trim().replace(/[.;:]+\s*$/, "");
    if (!trimmed) return "";
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
  lines.push(`${doc.meetingDate || "YYYY-MM-DD"} ${doc.meetingTitle || "Без названия"}`);
  if (doc.meta) lines.push(doc.meta);
  lines.push("");

  lines.push("1. Были:");
  if (doc.participants.length === 0) lines.push("- (не заполнено)");
  doc.participants.forEach((item, index) => {
    const rendered = formatListItem(item.text, index === doc.participants.length - 1);
    if (rendered) lines.push(`- ${rendered}`);
  });
  lines.push("");

  lines.push("2. Обсудили:");
  if (doc.topics.length === 0) lines.push("2.1. (не заполнено)");
  doc.topics.forEach((item, index) => {
    const topic = normalizeTopic(item.text);
    const title = topic.main.replace(/[.:;]+\s*$/, "").trim();
    lines.push(`2.${index + 1}. ${title}${topic.bullets.length ? ":" : "."}`);
    topic.bullets.forEach((b, bulletIndex) => {
      const rendered = formatListItem(b, bulletIndex === topic.bullets.length - 1);
      if (rendered) lines.push(`  - ${rendered}`);
    });
  });
  lines.push("");

  lines.push("3. Решили:");
  if (doc.decisions.length === 0) lines.push("3.1. (не заполнено)");
  doc.decisions.forEach((item, index) => {
    const rendered = formatDecision(item.text);
    if (rendered) lines.push(`3.${index + 1}. ${rendered}`);
  });
  lines.push("");

  lines.push("4. Поставили задачи:");
  if (doc.tasks.length === 0) lines.push("4.1. (не заполнено)");
  doc.tasks.forEach((task, index) => {
    const owner = task.owner || "@не назначен";
    const due = formatDueDate(task.due);
    lines.push(`4.${index + 1}. ${task.title} — ${owner}, ${due}`);
  });

  return lines.join("\n");
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("ru-RU");
}

function renderReportList(target, items) {
  target.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Нет данных";
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
      allTasks.push({
        ...task,
        meetingTitle: doc.meetingTitle || "Без названия",
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
    const owner = task.owner || "@не назначен";
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
    .map((task) => `${formatDate(task.due)} - ${task.title} (${task.owner || "@не назначен"})`);

  renderReportList(els.deadlineReport, [
    `Всего задач: ${allTasks.length}`,
    `Просрочено: ${overdue}`,
    `На 7 дней: ${week}`,
    `Без срока: ${noDate}`,
    ...nearestTasks,
  ]);

  renderReportList(els.ownerReport, byOwner);
}

function updatePreview() {
  const doc = collectForm();
  state.currentId = doc.id;
  els.preview.textContent = generateText(doc);
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
    alert("Заполните дату и заголовок");
    return;
  }

  const docs = getDocs();
  const index = docs.findIndex((d) => d.id === doc.id);
  if (index >= 0 && docSnapshot(docs[index]) !== docSnapshot(doc)) {
    const next = { ...doc, id: uid(), updatedAt: new Date().toISOString() };
    docs.unshift(next);
    state.currentId = next.id;
  } else if (index >= 0) {
    docs[index] = { ...doc, updatedAt: new Date().toISOString() };
    state.currentId = doc.id;
  } else {
    docs.unshift(doc);
    state.currentId = doc.id;
  }

  setDocs(docs);
  updatePreview();
  renderStoredDocs();
}

function updateCurrentDoc() {
  const doc = collectForm();
  if (!doc.meetingDate || !doc.meetingTitle) {
    alert("Заполните дату и заголовок");
    return;
  }

  const docs = getDocs();
  const index = docs.findIndex((d) => d.id === doc.id);
  if (index < 0) {
    alert("Текущий документ не найден. Используйте 'Сохранить'.");
    return;
  }

  docs[index] = { ...doc, updatedAt: new Date().toISOString() };
  state.currentId = doc.id;

  setDocs(docs);
  updatePreview();
  renderStoredDocs();
}

function clearForm() {
  if (shouldConfirmReset()) {
    const ok = window.confirm("Есть несохраненные изменения. Очистить форму?");
    if (!ok) return;
  }
  resetForm();
}

function renderStoredDocs() {
  const docs = getDocs();
  els.storedDocs.innerHTML = "";

  docs.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "stored-doc-row";
    li.dataset.open = doc.id;
    const meta = new Date(doc.updatedAt).toLocaleString("ru-RU");
    li.innerHTML = `
      <div>
        <div><strong>${doc.meetingDate || ""}</strong> ${doc.meetingTitle || "Без названия"}</div>
        <div class="doc-meta">${meta}</div>
      </div>
      <div>
        <button
          type="button"
          class="ghost icon-btn stored-open-btn"
          data-open="${doc.id}"
          title="Загрузить документ"
          aria-label="Загрузить документ"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 20h14v-2H5v2Zm7-18v10.17l3.59-3.58L17 10l-5 5-5-5 1.41-1.41L11 12.17V2h1Z"
            />
          </svg>
        </button>
      </div>
    `;
    els.storedDocs.appendChild(li);
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
  const blob = new Blob([generateText(doc)], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `${doc.meetingDate || "followup"}-${doc.id}.md`);
}

async function exportDocx() {
  const doc = collectForm();
  const { Document, Packer, Paragraph, TextRun } = await import("https://cdn.jsdelivr.net/npm/docx@9.0.3/+esm");
  const paragraphs = generateText(doc).split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] }));
  const file = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(file);
  downloadBlob(blob, `${doc.meetingDate || "followup"}-${doc.id}.docx`);
}

function exportPdf() {
  const doc = collectForm();
  const text = generateText(doc);
  const jsPdf = window.jspdf?.jsPDF;
  if (!jsPdf) {
    alert("PDF библиотека не загружена");
    return;
  }

  const pdf = new jsPdf({ unit: "pt", format: "a4" });
  const lines = pdf.splitTextToSize(text, 520);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(lines, 36, 48);
  pdf.save(`${doc.meetingDate || "followup"}-${doc.id}.pdf`);
}

function syncUrlWithDoc(docId) {
  if (!docId) return;
  const nextHash = `#/doc/${docId}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${nextHash}`);
}

function copyDocLink() {
  navigator.clipboard.writeText(window.location.href);
}

function copyProtocolToClipboard() {
  const text = els.preview.textContent || "";
  if (!text.trim()) return;
  navigator.clipboard.writeText(text);
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

  const open = e.target.closest("[data-open]");
  if (open) {
    const doc = getDocs().find((d) => d.id === open.dataset.open);
    if (!doc) return;
    fillForm(doc);
    window.location.hash = `#/doc/${doc.id}`;
  }
});

bindParticipantsInput({
  textarea: els.participantsInput,
});

bindTopicsInput({
  textarea: els.topicsInput,
});

["input", "change"].forEach((eventName) => {
  document.addEventListener(eventName, () => updatePreview());
});

els.saveBtn.addEventListener("click", saveDoc);
els.updateBtn.addEventListener("click", updateCurrentDoc);
els.newBtn.addEventListener("click", clearForm);
els.copyDocLink.addEventListener("click", copyDocLink);
els.copyProtocol.addEventListener("click", copyProtocolToClipboard);
els.exportMd.addEventListener("click", exportMd);
els.exportDocx.addEventListener("click", () => exportDocx().catch(() => alert("Ошибка экспорта DOCX")));
els.exportPdf.addEventListener("click", exportPdf);

if (!openByHash()) {
  if (!restoreDraftIfAny()) resetForm();
}
renderStoredDocs();
renderTaskReports();
