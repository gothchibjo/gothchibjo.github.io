function hasUserContent(text) {
  return /[^\s.:;,\-]/u.test(text || "");
}

function stitchCommaBreaks(text) {
  return (text || "").replace(/,\s*\n\s*/g, ", ");
}

function cleanTopicTitle(line) {
  return (line || "")
    .trim()
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[.,:;\s]+$/, "")
    .trim();
}

function cleanBullet(line) {
  return (line || "")
    .trim()
    .replace(/^[-*•\s]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[.,;:\s]+$/, "")
    .trim();
}

function parseTopicBlock(block) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const title = cleanTopicTitle(lines[0]);
  if (!hasUserContent(title)) return null;

  const bullets = lines
    .slice(1)
    .map((line) => cleanBullet(line))
    .filter((line) => hasUserContent(line));

  if (!bullets.length) return { text: title };
  return { text: `${title}:\n${bullets.join("\n")}` };
}

export function normalizeTopic(text) {
  const line = (text || "").trim();
  if (!line.includes(":")) return { main: line, bullets: [] };

  const colonIndex = line.indexOf(":");
  const main = line.slice(0, colonIndex).trim();
  const details = line.slice(colonIndex + 1);
  const bullets = details
    .replaceAll("\r", "")
    .split("\n")
    .flatMap((part) => part.split(";"))
    .map((v) => v.trim())
    .map((v) => v.replace(/^-+\s*/, "").trim())
    .filter(Boolean);
  return { main: `${main}:`, bullets };
}

export function collectTopicsFromInput(rawText) {
  const normalized = (rawText || "").replaceAll("\r", "");
  return stitchCommaBreaks(normalized)
    .split(/\n{2,}/)
    .map((block) => parseTopicBlock(block))
    .filter(Boolean);
}

export function renderTopicsModelToInput(topics) {
  return (topics || [])
    .map((topic) => {
      const normalized = normalizeTopic(topic.text || "");
      const title = cleanTopicTitle(normalized.main);
      if (!normalized.bullets.length) return `${title}.`;
      const bullets = normalized.bullets.map((bullet, index) => {
        const punct = index === normalized.bullets.length - 1 ? "." : ";";
        return `- ${cleanBullet(bullet)}${punct}`;
      });
      return `${title}:\n${bullets.join("\n")}`;
    })
    .join("\n\n");
}

export function bindTopicsInput() {

}
