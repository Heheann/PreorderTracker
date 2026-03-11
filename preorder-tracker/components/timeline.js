export function Timeline(item) {
  const events = [
    ["Launch", item.launchDate],
    ["Ordered", item.purchaseDate],
    ["Deposit paid", item.depositAmount ? item.purchaseDate : ""],
    ["Final payment due", item.finalDueDate],
    ["Shipping", item.shippingDate],
    ["Received", item.status === "received" ? item.shippingDate : ""],
  ].filter(([, date]) => date);

  return `<ul class="timeline">${events
    .map(([label, date]) => `<li><strong>${label}</strong> · ${new Date(date).toLocaleString()}</li>`)
    .join("")}</ul>`;
}
