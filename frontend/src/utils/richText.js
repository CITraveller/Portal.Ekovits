const allowedTags = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "UL",
  "OL",
  "LI",
  "BR",
  "P",
  "DIV"
]);

export function sanitizeRichText(value = "") {
  const source = String(value || "");

  if (!source.trim()) return "";

  if (
    typeof window === "undefined" ||
    typeof DOMParser === "undefined"
  ) {
    return source.replace(/\u00a0/g, " ");
  }

  const parser = new DOMParser();

  const doc = parser.parseFromString(
    `<div>${source}</div>`,
    "text/html"
  );

  const container = doc.body.firstElementChild;

  if (!container) return "";

  cleanNode(container);

  // IMPORTANT:
  // Convert browser-generated non-breaking spaces back
  // to normal spaces in all text nodes.
  normalizeSpaces(container);

  const html = container.innerHTML || "";

  const text = (container.textContent || "")
    .replace(/\u00a0/g, " ")
    .trim();

  return text ? html : "";
}

export function toRichTextHtml(value = "") {
  const source = String(value || "");

  if (!source) return "";

  if (/<[a-z][\s\S]*>/i.test(source)) {
    return sanitizeRichText(source);
  }

  return sanitizeRichText(
    escapeHtml(source).replace(/\r?\n/g, "<br>")
  );
}

function cleanNode(node) {
  [...node.childNodes].forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (!allowedTags.has(child.tagName)) {
        cleanNode(child);
        child.replaceWith(...child.childNodes);
        return;
      }

      [...child.attributes].forEach((attribute) => {
        child.removeAttribute(attribute.name);
      });

      cleanNode(child);
    } else if (child.nodeType !== Node.TEXT_NODE) {
      child.remove();
    }
  });
}

function normalizeSpaces(node) {
  [...node.childNodes].forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      child.nodeValue = child.nodeValue.replace(/\u00a0/g, " ");
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      normalizeSpaces(child);
    }
  });
}

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
  );
}
