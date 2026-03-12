import { emptyHint, sectionTitle } from "./uiKit.js";

export function DashboardCard(title, items) {
  const card = document.createElement("article");
  card.className = "card";

  const body = items.length
    ? `<ul class="item-list">${items
        .map((i) => `<li><strong>${i.title}</strong> · ${i.eventLabel} · ${i.dateLabel} <span class="meta">(${i.countdown})</span></li>`)
        .join("")}</ul>`
    : emptyHint("目前沒有項目。");

  card.innerHTML = `${sectionTitle(title)}${body}`;
  return card;
}
