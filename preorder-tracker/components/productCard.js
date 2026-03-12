import { actionRow, clayButton, statusTag } from "./uiKit.js";

export function getCountdownLabel(days) {
  if (days === null) return "未設定日期";
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天";
  return `剩餘 ${days} 天`;
}

export function ProductCard(item, nextEvent, onOpen, onDelete, translateType, translateStatus) {
  const card = document.createElement("article");
  card.className = "card product-card";
  card.innerHTML = `
    <div class="card-head">
      <div>
        <h3 class="card-title">${item.title}</h3>
        <p class="meta card-subtitle">${item.store || "未填寫商店"} · ${translateType(item.type)}</p>
      </div>
      ${statusTag(translateStatus(item.status))}
    </div>
    <p class="event-line"><strong>${nextEvent.label}</strong>：${nextEvent.dateLabel}</p>
    <p class="meta">${getCountdownLabel(nextEvent.days)}</p>
    ${actionRow([
      clayButton("查看", 'data-action="open"'),
      clayButton("刪除", 'data-action="delete"'),
    ])}
  `;

  card.querySelector('[data-action="open"]').onclick = () => onOpen(item.id);
  card.querySelector('[data-action="delete"]').onclick = () => onDelete(item.id);
  return card;
}
