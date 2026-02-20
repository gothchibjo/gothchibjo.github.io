export function handleTaskListClick(eventTarget, { addRow, updatePreview, armPendingTaskRemove, clearPendingTaskRemove, state }) {
  const add = eventTarget.closest("[data-add]");
  if (add) {
    addRow(add.dataset.add);
    updatePreview();
    return true;
  }

  const remove = eventTarget.closest("[data-remove]");
  if (remove) {
    const parent = remove.parentElement;
    const root = parent.parentElement;
    parent.remove();
    if (!root.children.length) addRow(root.id);
    updatePreview();
    return true;
  }

  const removeTask = eventTarget.closest("[data-remove-task]");
  if (removeTask) {
    if (state.pendingTaskRemoveBtn === removeTask) {
      clearPendingTaskRemove({ resetButton: false });
      const parent = removeTask.parentElement;
      const root = parent.parentElement;
      parent.remove();
      if (!root.children.length) addRow(root.id);
      updatePreview();
      return true;
    }
    armPendingTaskRemove(removeTask);
    return true;
  }

  return false;
}

export function handleStoredDocsClick(
  eventTarget,
  { deleteStoredDoc, copyStoredDocLink, restoreTrashDoc, purgeTrashDoc, openStoredDocWithGuard },
) {
  const deleteStored = eventTarget.closest("[data-delete-doc]");
  if (deleteStored) {
    deleteStoredDoc(deleteStored.dataset.deleteDoc);
    return true;
  }

  const copyStored = eventTarget.closest("[data-copy-doc-link]");
  if (copyStored) {
    copyStoredDocLink(copyStored.dataset.copyDocLink, copyStored);
    return true;
  }

  const restoreTrash = eventTarget.closest("[data-restore-doc]");
  if (restoreTrash) {
    restoreTrashDoc(restoreTrash.dataset.restoreDoc);
    return true;
  }

  const purgeTrash = eventTarget.closest("[data-purge-doc]");
  if (purgeTrash) {
    purgeTrashDoc(purgeTrash.dataset.purgeDoc);
    return true;
  }

  const storedRow = eventTarget.closest(".stored-doc-row");
  if (storedRow && storedRow.dataset.docId) {
    openStoredDocWithGuard(storedRow.dataset.docId);
    return true;
  }

  return false;
}
