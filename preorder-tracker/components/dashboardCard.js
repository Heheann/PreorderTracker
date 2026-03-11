export function DashboardCard(title, items) {
  const card = document.createElement("article");
  card.className = "card";
  const body = items.length
    ? `<ul>${items
        .map(
          (i) => `<li><strong>${i.title}</strong> · ${i.eventLabel} · ${i.dateLabel} <span class="meta">(${i.countdown})</span></li>`
        )
        .join("")}</ul>`
    : `<p class="meta">Nothing here yet.</p>`;
  card.innerHTML = `<h3 style="margin-top:0">${title}</h3>${body}`;
  return card;
}
