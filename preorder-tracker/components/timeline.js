import { escapeHtml } from "./uiKit.js";

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("zh-TW");
}

export function Timeline(item) {
  const events = [
    ["開售", item.launchDate],
    ["下單", item.purchaseDate],
    ["訂金截止", item.depositDueDate],
    ["尾款截止", item.finalDueDate],
    ["預計出貨", item.shippingDate],
    ["完成收貨", item.status === "received" ? item.shippingDate : ""],
  ].filter(([, date]) => date);

  if (!events.length) return `<p class="meta">尚未設定時間軸資料</p>`;

  return `<ul class="timeline">${events
    .map(([label, date]) => `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(formatDate(date))}</span></li>`)
    .join("")}</ul>`;
}
