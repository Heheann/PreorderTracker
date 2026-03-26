import { emptyHint, escapeHtml } from "./uiKit.js";

const EVENT_ICON = {
  開售: "🚀",
  尾款: "💳",
  出貨: "📦",
};

export function DashboardCard(_title, items, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "reminder-list";

  if (!items.length) {
    wrap.innerHTML = emptyHint("目前沒有即將到來的提醒");
    return wrap;
  }

  wrap.innerHTML = items
    .map(
      (item) => `
      <article class="reminder-item" data-id="${escapeHtml(item.id)}">
        <div class="badge">${EVENT_ICON[item.eventLabel] || "📌"}</div>
        <div class="content">
          <p class="title">${escapeHtml(item.title)}</p>
          <p class="meta">${escapeHtml(item.eventLabel)}：${escapeHtml(item.dateLabel)}</p>
        </div>
        <span class="pill">${escapeHtml(item.countdown)}</span>
      </article>
    `
    )
    .join("");

  if (onSelect) {
    wrap.querySelectorAll(".reminder-item").forEach((el) => {
      el.onclick = () => onSelect(el.dataset.id);
    });
  }

  return wrap;
}