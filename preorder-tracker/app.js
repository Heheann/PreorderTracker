import { ItemDB } from "./db/indexeddb.js";
import { ProductCard } from "./components/productCard.js";
import { DashboardCard } from "./components/dashboardCard.js";
import { Timeline } from "./components/timeline.js";
import { ImageGallery } from "./components/gallery.js";

const screens = {
  home: document.getElementById("screen-home"),
  list: document.getElementById("screen-list"),
  calendar: document.getElementById("screen-calendar"),
  add: document.getElementById("screen-add"),
};
const detailModal = document.getElementById("detail-modal");
const detailContent = document.getElementById("detail-content");
const state = { items: [], filter: "all", editingId: null };

const statusOptions = {
  instock: ["upcoming_sale", "on_sale", "purchased", "shipped", "received", "cancelled"],
  preorder: ["upcoming_sale", "ordered", "deposit_paid", "waiting_final_payment", "paid", "waiting_shipment", "shipped", "received", "cancelled"],
};

const seedItems = [
  {
    id: crypto.randomUUID(), title: "Moon Bunny Figure", store: "KawaiiMart", type: "preorder", status: "waiting_final_payment",
    launchDate: futureDate(3), purchaseDate: futureDate(-2), depositAmount: 20, finalAmount: 85, finalDueDate: futureDate(6),
    shippingDate: futureDate(22), url: "https://example.com/moon-bunny", images: [], notes: "Remember to check bonus postcard.", createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(), title: "Mint Keyboard", store: "Daily Desk", type: "instock", status: "on_sale",
    launchDate: futureDate(1), purchaseDate: "", depositAmount: 0, finalAmount: 129, finalDueDate: "", shippingDate: futureDate(8),
    url: "https://example.com/mint-keyboard", images: [], notes: "Use discount code.", createdAt: new Date().toISOString(),
  },
];

function futureDate(dayOffset) { const d = new Date(); d.setDate(d.getDate() + dayOffset); return d.toISOString(); }
function daysUntil(dateString) { if (!dateString) return null; return Math.ceil((new Date(dateString) - new Date()) / 86400000); }
function fmt(dateString) { return dateString ? new Date(dateString).toLocaleString() : "Not set"; }

function getNextEvent(item) {
  const candidates = [
    ["Launch", item.launchDate],
    ["Final Payment", item.finalDueDate],
    ["Shipping", item.shippingDate],
  ].filter(([, d]) => d && daysUntil(d) >= -7).sort((a, b) => new Date(a[1]) - new Date(b[1]));
  const picked = candidates[0] || ["No upcoming event", ""];
  return { label: picked[0], dateLabel: fmt(picked[1]), days: daysUntil(picked[1]), date: picked[1] };
}

async function ensureSeed() {
  const current = await ItemDB.getAll();
  if (current.length) return;
  for (const item of seedItems) await ItemDB.put(item);
}

function mountNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      switchScreen(btn.dataset.screen);
    };
  });
  document.getElementById("floating-add").onclick = () => switchScreen("add");
}

function switchScreen(name) {
  Object.entries(screens).forEach(([k, v]) => v.classList.toggle("active", k === name));
  if (name === "add") renderAddEdit();
}

function filterItems(items) {
  if (state.filter === "all") return items;
  if (state.filter === "pending") return items.filter((i) => ["cancelled", "received"].indexOf(i.status) === -1);
  if (state.filter === "completed") return items.filter((i) => ["cancelled", "received"].includes(i.status));
  return items.filter((i) => i.type === state.filter);
}

function renderDashboard() {
  const wrappers = {
    launch: state.items.map((i) => ({ ...i, eventLabel: "Launch", date: i.launchDate })).filter((i) => i.date),
    due: state.items.map((i) => ({ ...i, eventLabel: "Final Payment", date: i.finalDueDate })).filter((i) => i.date),
    ship: state.items.filter((i) => i.status.includes("shipment") || i.status === "paid" || i.status === "shipped").map((i) => ({ ...i, eventLabel: "Shipping", date: i.shippingDate })),
    recent: [...state.items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3).map((i) => ({ ...i, eventLabel: "Added", date: i.createdAt })),
  };
  screens.home.innerHTML = "";
  const mapItems = (arr) => arr.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4).map((i) => ({
    title: i.title, eventLabel: i.eventLabel, dateLabel: fmt(i.date), countdown: daysText(daysUntil(i.date)),
  }));
  screens.home.append(
    DashboardCard("Upcoming Launch", mapItems(wrappers.launch)),
    DashboardCard("Final Payment Due", mapItems(wrappers.due)),
    DashboardCard("Waiting for Shipment", mapItems(wrappers.ship)),
    DashboardCard("Recent Items", mapItems(wrappers.recent)),
  );
}

function daysText(days) { if (days === null) return "n/a"; if (days < 0) return `${Math.abs(days)}d ago`; if (days === 0) return "today"; return `${days}d`; }

function renderList() {
  screens.list.innerHTML = `<div class="filters">
    ${["all", "instock", "preorder", "pending", "completed"].map((f) => `<button class="filter-chip ${state.filter === f ? "active" : ""}" data-filter="${f}">${f}</button>`).join("")}
  </div><div class="list-grid" id="list-grid"></div>`;
  screens.list.querySelectorAll(".filter-chip").forEach((chip) => chip.onclick = () => { state.filter = chip.dataset.filter; renderList(); });
  const grid = screens.list.querySelector("#list-grid");
  filterItems(state.items).forEach((item) => grid.appendChild(ProductCard(item, getNextEvent(item), openDetail, deleteItem)));
}

function renderCalendar() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const total = monthEnd.getDate();
  const eventsByDate = new Map();

  for (const item of state.items) {
    [["🔥", item.launchDate, "Launch"], ["💰", item.finalDueDate, "Final payment"], ["📦", item.shippingDate, "Shipping"]]
      .forEach(([icon, date, label]) => {
        if (!date) return;
        const key = new Date(date).toDateString();
        const value = eventsByDate.get(key) || [];
        value.push({ icon, label, title: item.title, itemId: item.id });
        eventsByDate.set(key, value);
      });
  }

  screens.calendar.innerHTML = `<article class="card"><h3 style="margin-top:0">${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}</h3><div class="calendar-grid" id="calendar-grid"></div><div id="calendar-events" class="card" style="margin-top:10px"><p class="meta">Tap a date to see events.</p></div></article>`;
  const grid = screens.calendar.querySelector("#calendar-grid");
  for (let i = 0; i < firstWeekday; i++) grid.appendChild(document.createElement("div"));
  for (let day = 1; day <= total; day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    const key = date.toDateString();
    const events = eventsByDate.get(key) || [];
    const btn = document.createElement("button");
    btn.className = `day-cell ${events.length ? "has-events" : ""}`;
    btn.innerHTML = `<strong>${day}</strong>${events.length ? `<div>${events.slice(0, 2).map((e) => e.icon).join(" ")}</div>` : ""}`;
    btn.onclick = () => renderCalendarEvents(date, events);
    grid.appendChild(btn);
  }
}

function renderCalendarEvents(date, events) {
  const box = document.getElementById("calendar-events");
  if (!events.length) {
    box.innerHTML = `<h4>${date.toDateString()}</h4><p class="meta">No events.</p>`;
    return;
  }
  box.innerHTML = `<h4>${date.toDateString()}</h4><ul>${events.map((e) => `<li>${e.icon} <strong>${e.title}</strong> · ${e.label}</li>`).join("")}</ul>`;
}

function renderAddEdit(item = null) {
  const isEdit = Boolean(item);
  screens.add.innerHTML = `<form id="item-form" class="card form-card">
    <h3 style="margin:0">${isEdit ? "Edit Item" : "Add Item"}</h3>
    ${field("title", "Product name", item?.title || "", true)}
    ${field("store", "Store name", item?.store || "")}
    <div class="field"><label>Product type</label><select name="type" id="type">${["instock", "preorder"].map((t) => `<option ${item?.type === t ? "selected" : ""} value="${t}">${t}</option>`).join("")}</select></div>
    <div class="field"><label>Status</label><select name="status" id="status"></select></div>
    ${field("launchDate", "Launch date/time", item?.launchDate || "", false, "datetime-local")}
    ${field("purchaseDate", "Purchase date/time", item?.purchaseDate || "", false, "datetime-local")}
    ${field("depositAmount", "Deposit amount", item?.depositAmount || "", false, "number")}
    ${field("finalAmount", "Final payment amount", item?.finalAmount || "", false, "number")}
    ${field("finalDueDate", "Final payment deadline", item?.finalDueDate || "", false, "datetime-local")}
    ${field("shippingDate", "Expected shipping date", item?.shippingDate || "", false, "datetime-local")}
    ${field("url", "External URL", item?.url || "", false, "url")}
    <div class="field"><label>Image upload</label><input type="file" id="images" accept="image/*" multiple /></div>
    <div class="field"><label>Notes</label><textarea name="notes" rows="4">${item?.notes || ""}</textarea></div>
    <div class="form-actions">
      <button class="clay-button primary" type="submit">${isEdit ? "Save changes" : "Add product"}</button>
      ${isEdit ? '<button class="clay-button" type="button" id="cancel-edit">Cancel</button>' : ""}
    </div>
  </form>`;

  const typeEl = document.getElementById("type");
  const statusEl = document.getElementById("status");
  const syncStatus = () => {
    const opts = statusOptions[typeEl.value];
    statusEl.innerHTML = opts.map((s) => `<option ${item?.status === s ? "selected" : ""} value="${s}">${s.replaceAll("_", " ")}</option>`).join("");
  };
  syncStatus();
  typeEl.onchange = syncStatus;

  document.getElementById("item-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const images = await filesToDataUrls(document.getElementById("images").files);
    const record = {
      id: item?.id || crypto.randomUUID(),
      title: form.get("title"),
      store: form.get("store"),
      type: form.get("type"),
      status: form.get("status"),
      launchDate: toISO(form.get("launchDate")),
      purchaseDate: toISO(form.get("purchaseDate")),
      depositAmount: Number(form.get("depositAmount") || 0),
      finalAmount: Number(form.get("finalAmount") || 0),
      finalDueDate: toISO(form.get("finalDueDate")),
      shippingDate: toISO(form.get("shippingDate")),
      url: form.get("url"),
      images: images.length ? images : item?.images || [],
      notes: form.get("notes"),
      createdAt: item?.createdAt || new Date().toISOString(),
    };
    await ItemDB.put(record);
    state.editingId = null;
    await loadAndRender();
    switchScreen("list");
  };

  if (isEdit) document.getElementById("cancel-edit").onclick = () => { state.editingId = null; switchScreen("list"); };
}

function toISO(v) { return v ? new Date(v).toISOString() : ""; }
function field(name, label, value, required = false, type = "text") {
  const normalized = type === "datetime-local" && value ? new Date(value).toISOString().slice(0, 16) : value;
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${normalized}" ${required ? "required" : ""}/></div>`;
}
function filesToDataUrls(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(files.map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  })));
}

function openDetail(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  detailContent.innerHTML = `
    <h3>${item.title}</h3>
    ${ImageGallery(item.images)}
    <p><strong>Store:</strong> ${item.store || "-"}</p>
    <p><strong>Type:</strong> ${item.type}</p>
    <p><strong>Status:</strong> <span class="status-tag">${item.status.replaceAll("_", " ")}</span></p>
    <h4>Timeline</h4>${Timeline(item)}
    <h4>Financial</h4>
    <p>Deposit: $${item.depositAmount || 0}</p>
    <p>Final: $${item.finalAmount || 0}</p>
    <p>Final due: ${fmt(item.finalDueDate)}</p>
    <h4>External link</h4>
    <p>${item.url ? `<a href="${item.url}" target="_blank" rel="noopener">${item.url}</a>` : "No URL"}</p>
    <h4>Notes</h4><p class="note-box">${item.notes || "-"}</p>
    <div style="display:flex;gap:8px;"><button class="clay-button" id="edit-item">Edit</button></div>
  `;
  detailContent.querySelector("#edit-item").onclick = () => {
    detailModal.close();
    state.editingId = item.id;
    renderAddEdit(item);
    switchScreen("add");
  };
  detailModal.showModal();
}

async function deleteItem(id) {
  if (!confirm("Delete this product?")) return;
  await ItemDB.delete(id);
  await loadAndRender();
}

async function loadAndRender() {
  state.items = await ItemDB.getAll();
  renderDashboard();
  renderList();
  renderCalendar();
  if (!state.editingId) renderAddEdit();
}

async function init() {
  await ensureSeed();
  mountNav();
  await loadAndRender();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js");
}

init();
