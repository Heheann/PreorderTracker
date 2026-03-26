function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeHtml(value) {
  return esc(value);
}

export function statusTag(text) {
  return `<span class="status-tag">${esc(text)}</span>`;
}

export function emptyHint(text) {
  return `<p class="meta empty-hint">${esc(text)}</p>`;
}

export function actionRow(buttons = []) {
  return `<div class="action-row">${buttons.join("")}</div>`;
}

export function clayButton(label, attrs = "") {
  return `<button class="clay-button" ${attrs}>${esc(label)}</button>`;
}

export function formField({ name, label, value = "", required = false, type = "text" }) {
  return `<div class="field"><label>${esc(label)}</label><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${required ? "required" : ""}/></div>`;
}

export function formSelect({ name, id, label, options }) {
  return `<div class="field"><label>${esc(label)}</label><select name="${esc(name)}" id="${esc(id)}">${options}</select></div>`;
}