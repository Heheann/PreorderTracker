import { emptyHint } from "./uiKit.js";

export function DashboardCard(_title, items, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "reminder-list";

  if (!items.length) {
    wrap.innerHTML = emptyHint("目前沒有項目。");
    return wrap;
  }

  wrap.innerHTML = items
    .map(
      (i) => `
      <article class="reminder-item" data-id="${i.id}">
        <div class="badge">${i.eventLabel === "尾款" ? "💰" : i.eventLabel === "出貨" ? "📦" : "🔥"}</div>
        <div class="content">
          <p class="title">${i.title}</p>
          <p class="meta">${i.eventLabel}日期：${i.dateLabel}</p>
        </div>
        <span class="pill">${i.countdown}</span>
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
