export function getCountdownLabel(days) {
  if (days === null) return "未設定日期";
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天";
  return `剩餘 ${days} 天`;
}

export function ProductCard(item, nextEvent, onOpen, onDelete, translateType, translateStatus) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
      <div>
        <h3 style="margin:0">${item.title}</h3>
        <p class="meta" style="margin:4px 0">${item.store || "未填寫商店"} · ${translateType(item.type)}</p>
      </div>
      <span class="status-tag">${translateStatus(item.status)}</span>
    </div>
    <p style="margin:8px 0 2px"><strong>${nextEvent.label}</strong>：${nextEvent.dateLabel}</p>
    <p class="meta" style="margin:0 0 10px">${getCountdownLabel(nextEvent.days)}</p>
    <div style="display:flex;gap:8px;">
      <button class="clay-button" data-action="open">查看</button>
      <button class="clay-button" data-action="delete">刪除</button>
    </div>
  `;
  card.querySelector('[data-action="open"]').onclick = () => onOpen(item.id);
  card.querySelector('[data-action="delete"]').onclick = () => onDelete(item.id);
  return card;
}
