export const DEFAULT_STORAGE_KEYS = {
  docs: "followup_docs_v1",
  trash: "followup_trash_v1",
  draft: "followup_draft_v1",
};

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function createDocRepository({ storage = window.localStorage, keys = DEFAULT_STORAGE_KEYS } = {}) {
  const readJson = (key, fallback) => {
    try {
      return JSON.parse(storage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    storage.setItem(key, JSON.stringify(value));
  };

  const getDocs = () => readJson(keys.docs, []);
  const setDocs = (docs) => writeJson(keys.docs, docs);

  const getTrashDocs = () => readJson(keys.trash, []);
  const setTrashDocs = (docs) => writeJson(keys.trash, docs);

  const getDraft = () => readJson(keys.draft, null);
  const setDraft = (doc) => writeJson(keys.draft, doc);

  const findSavedDocById = (docId) => {
    if (!docId) return null;
    return getDocs().find((doc) => doc.id === docId) || null;
  };

  return {
    getDocs,
    setDocs,
    getTrashDocs,
    setTrashDocs,
    getDraft,
    setDraft,
    findSavedDocById,
  };
}
