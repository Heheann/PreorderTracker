import { actionRow, clayButton, statusTag } from "./uiKit.js";

export function getCountdownLabel(days) {
  if (days === null) return "未設定日期";
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天";
  return `還有 ${days} 天`;
}

export function ProductCard(item, nextEvent, onOpen, onDelete, translateType, translateStatus) {
  const card = document.createElement("article");
  card.className = "product-row";

  card.innerHTML = `
    <div class="thumb">${item.emoji || "🧩"}</div>
    <div class="body">
      <div class="card-head">
        <h3 class="card-title">${item.title}</h3>
        ${statusTag(translateStatus(item.status))}
      </div>
      <p class="meta card-subtitle">🏬 ${item.store || "未填寫商店"} · ${translateType(item.type)}</p>
      <p class="event-line">🔥 ${nextEvent.label} <span>${nextEvent.dateLabel}</span></p>
      <p class="price-line">尾款: <strong>NT$${Number(item.finalAmount || 0).toLocaleString()}</strong></p>
      ${actionRow([
        clayButton("✎ 編輯", 'data-action="open"'),
        clayButton("🗑 刪除", 'data-action="delete"'),
      ])}
    </div>
  `;

  card.querySelector('[data-action="open"]').onclick = () => onOpen(item.id);
  card.querySelector('[data-action="delete"]').onclick = () => onDelete(item.id);
  return card;
}
