function hasUserContent(text) {
  return /[^\s.:;,\-]/u.test(text || "");
}

function stitchCommaBreaks(text) {
  return (text || "").replace(/,\s*\n\s*/g, ", ");
}

function cleanParticipantToken(token) {
  return (token || "")
    .trim()
    .replace(/^[-*•\s]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^[А-ЯA-Z]\)\s*/u, "")
    .replace(/[;:,\s]+$/, "")
    .trim();
}

export function collectParticipantsFromInput(rawText) {
  const normalized = stitchCommaBreaks(rawText)
    .replaceAll("\r", "\n")
    .replace(/[;,]+/g, "\n")
    .replace(/(?:^|\s)\d+\.\s+/g, "\n");

  return normalized
    .split("\n")
    .map((line) => cleanParticipantToken(line))
    .filter((line) => hasUserContent(line))
    .map((text) => ({ text }));
}

export function renderParticipantsToInput(participants) {
  return (participants || []).map((p) => p.text || "").filter(Boolean).join("\n");
}

export function bindParticipantsInput() {

}
