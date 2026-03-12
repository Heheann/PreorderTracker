export function Timeline(item) {
  const events = [
    ["開賣", item.launchDate],
    ["下單", item.purchaseDate],
    ["已付訂金", item.depositAmount ? item.purchaseDate : ""],
    ["尾款截止", item.finalDueDate],
    ["出貨", item.shippingDate],
    ["收貨", item.status === "received" ? item.shippingDate : ""],
  ].filter(([, date]) => date);

  return `<ul class="timeline">${events
    .map(([label, date]) => `<li><strong>${label}</strong> · ${new Date(date).toLocaleString("zh-TW")}</li>`)
    .join("")}</ul>`;
}
