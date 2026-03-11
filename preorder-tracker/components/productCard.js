export function getCountdownLabel(days) {
  if (days === null) return "No date";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d left`;
}

export function ProductCard(item, nextEvent, onOpen, onDelete) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
      <div>
        <h3 style="margin:0">${item.title}</h3>
        <p class="meta" style="margin:4px 0">${item.store || "No store"} · ${item.type}</p>
      </div>
      <span class="status-tag">${item.status.replaceAll("_", " ")}</span>
    </div>
    <p style="margin:8px 0 2px"><strong>${nextEvent.label}</strong>: ${nextEvent.dateLabel}</p>
    <p class="meta" style="margin:0 0 10px">${getCountdownLabel(nextEvent.days)}</p>
    <div style="display:flex;gap:8px;">
      <button class="clay-button" data-action="open">View</button>
      <button class="clay-button" data-action="delete">Delete</button>
    </div>
  `;
  card.querySelector('[data-action="open"]').onclick = () => onOpen(item.id);
  card.querySelector('[data-action="delete"]').onclick = () => onDelete(item.id);
  return card;
}
