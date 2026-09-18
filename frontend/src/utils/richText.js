const allowedTags = new Set(["B", "STRONG", "I", "EM", "UL", "OL", "LI", "BR", "P", "DIV"]);

export function sanitizeRichText(value = "") {
  const source = String(value || "");
  if (!source.trim()) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return source;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${source}</div>`, "text/html");
  cleanNode(doc.body);
  const html = doc.body.firstElementChild?.innerHTML || "";
  const text = doc.body.textContent?.replace(/\u00a0/g, " ").trim() || "";
  return text ? html : "";
}

export function toRichTextHtml(value = "") {
  const source = String(value || "");
  if (/<[a-z][\s\S]*>/i.test(source)) return sanitizeRichText(source);
  return sanitizeRichText(escapeHtml(source).replace(/\r?\n/g, "<br>"));
}

function cleanNode(node) {
  [...node.childNodes].forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (!allowedTags.has(child.tagName)) {
        cleanNode(child);
        child.replaceWith(...child.childNodes);
        return;
      }
      [...child.attributes].forEach(attribute => child.removeAttribute(attribute.name));
      cleanNode(child);
    } else if (child.nodeType !== Node.TEXT_NODE) {
      child.remove();
    }
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
