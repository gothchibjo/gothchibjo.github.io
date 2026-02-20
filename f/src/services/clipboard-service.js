export function createClipboardService({ t, copyFeedbackMs = 1200 }) {
  const copyFeedbackTimers = new WeakMap();
  const copyFeedbackInitialState = new WeakMap();

  const showCopySuccess = (button) => {
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
    }, copyFeedbackMs);

    copyFeedbackTimers.set(button, timerId);
  };

  const writeText = async (text, feedbackButton) => {
    try {
      await navigator.clipboard.writeText(text);
      showCopySuccess(feedbackButton);
    } catch {}
  };

  const writeRich = async (text, html, feedbackButton) => {
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
      writeText(text, feedbackButton);
    }
  };

  return {
    writeText,
    writeRich,
  };
}
