import { actionRow, clayButton, escapeHtml, statusTag } from "./uiKit.js";

export function getCountdownLabel(days) {
  if (days === null) return "未設定";
  if (days < 0) return `已過 ${Math.abs(days)} 天`;
  if (days === 0) return "今天";
  return `${days} 天後`;
}

export function ProductCard(item, nextEvent, onOpen, onDelete, translateType, translateStatus) {
  const card = document.createElement("article");
  card.className = "product-row";

  const storeText = item.store ? item.store : "未填寫店家";
  const coverImage = Array.isArray(item.images) && item.images.length ? item.images[0] : "";
  const thumb = coverImage
    ? `<img class="thumb-image" src="${escapeHtml(coverImage)}" alt="${escapeHtml(item.title)} 商品圖片" loading="lazy" />`
    : `<span class="thumb-emoji">${escapeHtml(item.emoji || "📦")}</span>`;

  card.innerHTML = `
    <div class="thumb">${thumb}</div>
    <div class="body">
      <div class="card-head">
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        ${statusTag(translateStatus(item.status))}
      </div>
      <p class="meta card-subtitle">🏪 ${escapeHtml(storeText)} · ${escapeHtml(translateType(item.type))}</p>
      <p class="event-line">📌 ${escapeHtml(nextEvent.label)} <span>${escapeHtml(nextEvent.dateLabel)}</span></p>
      <p class="meta event-subline">${escapeHtml(getCountdownLabel(nextEvent.days))}</p>
      <p class="price-line">尾款: <strong>NT$${Number(item.finalAmount || 0).toLocaleString()}</strong></p>
      ${actionRow([
        clayButton("查看 / 編輯", 'data-action="open"'),
        clayButton("刪除", 'data-action="delete"'),
      ])}
    </div>
  `;

  card.querySelector('[data-action="open"]').onclick = () => onOpen(item.id);
  card.querySelector('[data-action="delete"]').onclick = () => onDelete(item.id);
  return card;
}
