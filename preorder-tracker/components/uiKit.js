export function statusTag(text) {
  return `<span class="status-tag">${text}</span>`;
}

export function sectionTitle(text) {
  return `<h3 class="section-title">${text}</h3>`;
}

export function emptyHint(text) {
  return `<p class="meta empty-hint">${text}</p>`;
}

export function actionRow(buttons = []) {
  return `<div class="action-row">${buttons.join("")}</div>`;
}

export function clayButton(label, attrs = "") {
  return `<button class="clay-button" ${attrs}>${label}</button>`;
}

export function formField({ name, label, value = "", required = false, type = "text" }) {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${value}" ${required ? "required" : ""}/></div>`;
}

export function formSelect({ name, id, label, options }) {
  return `<div class="field"><label>${label}</label><select name="${name}" id="${id}">${options}</select></div>`;
}
