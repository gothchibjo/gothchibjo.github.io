export function createReportService({
  t,
  intlLocale,
  formatDate,
  resolveDocumentTasks,
  getDocs,
  collectDraftDoc,
  deadlineReportEl,
  assigneeReportEl,
}) {
  const renderReportList = (target, items) => {
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
  };

  const collectReportDocs = () => {
    const docs = getDocs();
    const draft = collectDraftDoc();
    const withoutCurrent = docs.filter((doc) => doc.id !== draft.id);
    return [draft, ...withoutCurrent];
  };

  const renderTaskReports = () => {
    const allDocs = collectReportDocs();
    const allTasks = [];

    allDocs.forEach((doc) => {
      resolveDocumentTasks(doc).forEach((task) => {
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

    const byAssigneeMap = allTasks.reduce((acc, task) => {
      const assignee = task.assignee || t("common.unassigned");
      acc.set(assignee, (acc.get(assignee) || 0) + 1);
      return acc;
    }, new Map());

    const byAssignee = [...byAssigneeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([assignee, count]) => `${assignee}: ${count}`);

    const nearestTasks = allTasks
      .filter((task) => Boolean(task.due))
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 3)
      .map((task) => `${formatDate(task.due, intlLocale)} - ${task.title} (${task.assignee || t("common.unassigned")})`);

    renderReportList(deadlineReportEl, [
      t("reports.totalTasks", { count: allTasks.length }),
      t("reports.overdue", { count: overdue }),
      t("reports.next7Days", { count: week }),
      t("reports.noDue", { count: noDate }),
      ...nearestTasks,
    ]);

    renderReportList(assigneeReportEl, byAssignee);
  };

  return {
    renderTaskReports,
  };
}
