function isEditableTarget(target) {
  if (!target) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && target.type === "text";
}

export function createMentionUiController({
  titleInput,
  participantsInput,
  topicsInput,
  decisionsInput,
  metaInput,
  getTitleCandidates,
  getParticipantCandidates,
  getHashtagCandidates,
}) {
  const mentionUi = {
    root: null,
    target: null,
    mode: "mention",
    rangeStart: 0,
    rangeEnd: 0,
    activeIndex: 0,
    items: [],
  };

  const getCandidatesForMode = (mode) => {
    if (mode === "title") return typeof getTitleCandidates === "function" ? getTitleCandidates() : [];
    if (mode === "hashtags") return typeof getHashtagCandidates === "function" ? getHashtagCandidates() : [];
    return typeof getParticipantCandidates === "function" ? getParticipantCandidates() : [];
  };

  const extractHashtagsFromText = (rawText) => {
    const text = rawText || "";
    const tags = [];
    const re = /(?:^|\s)#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu;
    let match = re.exec(text);
    while (match) {
      tags.push(match[1] || "");
      match = re.exec(text);
    }
    return tags.filter(Boolean);
  };

  const renderSuggestionValue = (value) => {
    if (mentionUi.mode === "participants" || mentionUi.mode === "title") return value;
    if (mentionUi.mode === "hashtags") return `#${value}`;
    return `@${value}`;
  };

  const hideMentionUi = () => {
    if (!mentionUi.root) return;
    mentionUi.root.classList.add("hidden");
    mentionUi.target = null;
    mentionUi.mode = "mention";
    mentionUi.items = [];
    mentionUi.activeIndex = 0;
  };

  const renderMentionUiItems = () => {
    if (!mentionUi.root) return;
    mentionUi.root.innerHTML = "";
    mentionUi.items.forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mention-suggest-item";
      if (index === mentionUi.activeIndex) button.classList.add("active");
      button.dataset.mentionValue = value;
      button.setAttribute("aria-selected", index === mentionUi.activeIndex ? "true" : "false");
      button.textContent = renderSuggestionValue(value);
      mentionUi.root.appendChild(button);
    });
  };

  const positionMentionUi = () => {
    if (!mentionUi.root || !mentionUi.target) return;
    const rect = mentionUi.target.getBoundingClientRect();
    mentionUi.root.style.left = `${window.scrollX + rect.left}px`;
    const topOffset = Math.min(rect.height + 8, 120);
    mentionUi.root.style.top = `${window.scrollY + rect.top + topOffset}px`;
    mentionUi.root.style.minWidth = `${Math.max(180, Math.min(rect.width, 420))}px`;
  };

  const applyMentionSuggestion = (value, options = {}) => {
    if (!mentionUi.target) return;
    const target = mentionUi.target;
    const { forceLineBreak = false } = options;
    let replacement = renderSuggestionValue(value);
    if (forceLineBreak) replacement = `${replacement}\n`;
    if (mentionUi.mode === "hashtags" && !forceLineBreak) {
      const after = target.value.slice(mentionUi.rangeEnd);
      if (!after || !/^\s/u.test(after)) replacement = `${replacement} `;
    }
    const nextValue =
      `${target.value.slice(0, mentionUi.rangeStart)}${replacement}${target.value.slice(mentionUi.rangeEnd)}`;
    target.value = nextValue;
    const nextCaretPos = mentionUi.rangeStart + replacement.length;
    if (typeof target.setSelectionRange === "function") target.setSelectionRange(nextCaretPos, nextCaretPos);
    hideMentionUi();
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus();
  };

  const ensureMentionUi = () => {
    if (mentionUi.root) return mentionUi.root;
    const root = document.createElement("div");
    root.className = "mention-suggest hidden";
    root.setAttribute("role", "listbox");
    root.addEventListener("mousedown", (event) => {
      const item = event.target.closest("[data-mention-value]");
      if (!item) return;
      event.preventDefault();
      applyMentionSuggestion(item.dataset.mentionValue || "");
    });
    document.body.appendChild(root);
    mentionUi.root = root;
    return root;
  };

  const extractMentionContext = (target) => {
    if (!isEditableTarget(target)) return null;
    const cursorPos = typeof target.selectionStart === "number" ? target.selectionStart : target.value.length;
    const prefix = target.value.slice(0, cursorPos);

    if (target === titleInput) {
      const query = (target.value || "").trim();
      if (query) {
        return {
          mode: "title",
          query,
          start: 0,
          end: target.value.length,
        };
      }
      return null;
    }

    if (target === participantsInput) {
      const participantMatch = prefix.match(/(?:^|[\n;,])\s*(?:[-*•]\s*)?([\p{L}\p{N}_][\p{L}\p{N}_'`\- ]*)$/u);
      if (participantMatch) {
        const query = (participantMatch[1] || "").trimStart();
        if (query) {
          return {
            mode: "participants",
            query,
            start: cursorPos - query.length,
            end: cursorPos,
          };
        }
      }
      return null;
    }

    if (target.dataset?.field === "assignee") {
      const assigneeMatch = prefix.match(/^\s*([\p{L}\p{N}_][\p{L}\p{N}_'`\- ]*)$/u);
      if (assigneeMatch) {
        const query = (assigneeMatch[1] || "").trimStart();
        if (query) {
          const valueStart = prefix.search(/\S/u);
          return {
            mode: "participants",
            query,
            start: valueStart >= 0 ? valueStart : 0,
            end: cursorPos,
          };
        }
      }
      return null;
    }

    if (target === metaInput) {
      const tagMatch = prefix.match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u);
      if (tagMatch) {
        const query = tagMatch[1] || "";
        return {
          mode: "hashtags",
          query,
          start: cursorPos - query.length - 1,
          end: cursorPos,
        };
      }
      return null;
    }

    if (target !== topicsInput && target !== decisionsInput) return null;

    const match = prefix.match(/(?:^|\s)@([\p{L}\p{N}_]*)$/u);
    if (match) {
      const query = match[1] || "";
      return {
        mode: "mention",
        query,
        start: cursorPos - query.length - 1,
        end: cursorPos,
      };
    }
    return null;
  };

  const showMentionUi = (target, context) => {
    const root = ensureMentionUi();
    mentionUi.mode = context.mode;
    const queryLower = context.query.toLocaleLowerCase();
    const usedHashtags = (() => {
      if (context.mode !== "hashtags") return null;
      const before = target.value.slice(0, context.start);
      const after = target.value.slice(context.end);
      const otherText = `${before} ${after}`;
      return new Set(extractHashtagsFromText(otherText).map((tag) => tag.toLocaleLowerCase()));
    })();
    const baseCandidates = getCandidatesForMode(context.mode);
    let nextItems = baseCandidates
      .filter((name) => !queryLower || name.toLocaleLowerCase().includes(queryLower))
      .filter((name) => !(usedHashtags && usedHashtags.has(name.toLocaleLowerCase())))
      .slice(0, 8);
    if ((context.mode === "participants" || context.mode === "hashtags") && context.query) {
      const exactIndex = nextItems.findIndex((name) => name.toLocaleLowerCase() === queryLower);
      if (exactIndex >= 0) {
        const [exact] = nextItems.splice(exactIndex, 1);
        nextItems.unshift(exact);
      } else {
        const isUsed = usedHashtags && usedHashtags.has(queryLower);
        if (!isUsed) nextItems.unshift(context.query);
      }
      const seen = new Set();
      nextItems = nextItems.filter((name) => {
        const key = name.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (context.mode === "title") {
      const seen = new Set();
      nextItems = nextItems.filter((name) => {
        const key = name.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    mentionUi.items = nextItems.slice(0, 8);
    if (!mentionUi.items.length && context.query && context.mode !== "title") mentionUi.items = [context.query];
    if (!mentionUi.items.length) {
      hideMentionUi();
      return;
    }
    mentionUi.target = target;
    mentionUi.rangeStart = context.start;
    mentionUi.rangeEnd = context.end;
    mentionUi.activeIndex = 0;
    renderMentionUiItems();
    root.classList.remove("hidden");
    positionMentionUi();
  };

  const updateMentionUiForTarget = (target) => {
    const context = extractMentionContext(target);
    if (!context) {
      hideMentionUi();
      return;
    }
    showMentionUi(target, context);
  };

  const moveMentionSelection = (direction) => {
    if (!mentionUi.items.length) return;
    const lastIndex = mentionUi.items.length - 1;
    if (direction > 0) {
      mentionUi.activeIndex = mentionUi.activeIndex >= lastIndex ? 0 : mentionUi.activeIndex + 1;
    } else {
      mentionUi.activeIndex = mentionUi.activeIndex <= 0 ? lastIndex : mentionUi.activeIndex - 1;
    }
    renderMentionUiItems();
  };

  return {
    isEditableTarget,
    hide: hideMentionUi,
    updateForTarget: updateMentionUiForTarget,
    onScrollOrResize: positionMentionUi,
    onDocumentClick: (eventTarget) => {
      if (mentionUi.root && !eventTarget.closest(".mention-suggest") && !isEditableTarget(eventTarget)) {
        hideMentionUi();
      }
    },
    onFocusIn: (target) => {
      if (!isEditableTarget(target)) {
        hideMentionUi();
        return;
      }
      updateMentionUiForTarget(target);
    },
    onInput: (target) => {
      if (!isEditableTarget(target)) return;
      updateMentionUiForTarget(target);
    },
    onKeydown: (event) => {
      if (!mentionUi.target || mentionUi.root?.classList.contains("hidden")) return false;
      if (document.activeElement !== mentionUi.target) return false;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveMentionSelection(1);
        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveMentionSelection(-1);
        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const selected = mentionUi.items[mentionUi.activeIndex] || mentionUi.items[0];
        if (!selected) return true;
        const selectedMode = mentionUi.mode;
        const forceLineBreak =
          mentionUi.mode === "participants" && mentionUi.target === participantsInput && event.key === "Enter";
        applyMentionSuggestion(selected, { forceLineBreak });
        if (selectedMode === "title" && event.key === "Enter" && participantsInput) {
          participantsInput.focus();
        }
        return true;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        hideMentionUi();
        return true;
      }

      return false;
    },
  };
}
