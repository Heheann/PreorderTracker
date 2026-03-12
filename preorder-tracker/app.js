import { ItemDB } from "./db/indexeddb.js";
import { ProductCard } from "./components/productCard.js";
import { DashboardCard } from "./components/dashboardCard.js";
import { Timeline } from "./components/timeline.js";
import { ImageGallery } from "./components/gallery.js";
import { actionRow, clayButton, formField, formSelect } from "./components/uiKit.js";

const screens = {
  home: document.getElementById("screen-home"),
  list: document.getElementById("screen-list"),
  calendar: document.getElementById("screen-calendar"),
  add: document.getElementById("screen-add"),
};
const detailModal = document.getElementById("detail-modal");
const detailContent = document.getElementById("detail-content");
const state = {
  items: [],
  filter: "all",
  editingId: null,
  viewMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
};

const statusOptions = {
  instock: ["upcoming_sale", "on_sale", "purchased", "shipped", "received", "cancelled"],
  preorder: ["upcoming_sale", "ordered", "deposit_paid", "waiting_final_payment", "paid", "waiting_shipment", "shipped", "received", "cancelled"],
};

const statusText = {
  upcoming_sale: "即將開賣",
  on_sale: "開賣中",
  purchased: "已購買",
  shipped: "已出貨",
  received: "已收貨",
  cancelled: "已取消",
  ordered: "已下單",
  deposit_paid: "已付訂金",
  waiting_final_payment: "等待尾款",
  paid: "已付清",
  waiting_shipment: "等待出貨",
};

const typeText = { instock: "現貨", preorder: "預購" };

const seedItems = [
  {
    id: crypto.randomUUID(),
    title: "月兔模型",
    store: "KawaiiMart",
    type: "preorder",
    status: "waiting_final_payment",
    launchDate: futureDate(3),
    purchaseDate: futureDate(-2),
    depositAmount: 20,
    finalAmount: 85,
    finalDueDate: futureDate(6),
    shippingDate: futureDate(22),
    url: "https://example.com/moon-bunny",
    images: [],
    notes: "記得確認特典明信片。",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: "薄荷鍵盤",
    store: "Daily Desk",
    type: "instock",
    status: "on_sale",
    launchDate: futureDate(1),
    purchaseDate: "",
    depositAmount: 0,
    finalAmount: 129,
    finalDueDate: "",
    shippingDate: futureDate(8),
    url: "https://example.com/mint-keyboard",
    images: [],
    notes: "可套用折扣碼。",
    createdAt: new Date().toISOString(),
  },
];

function futureDate(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
}
function daysUntil(dateString) {
  if (!dateString) return null;
  return Math.ceil((new Date(dateString) - new Date()) / 86400000);
}
function fmt(dateString) {
  return dateString ? new Date(dateString).toLocaleString("zh-TW") : "未設定";
}
function translateStatus(status) {
  return statusText[status] || status;
}
function translateType(type) {
  return typeText[type] || type;
}


function getSafeViewMonth() {
  if (!(state.viewMonth instanceof Date) || Number.isNaN(state.viewMonth.getTime())) {
    state.viewMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }
  return state.viewMonth;
}

function getNextEvent(item) {
  const candidates = [["開賣", item.launchDate], ["尾款", item.finalDueDate], ["出貨", item.shippingDate]]
    .filter(([, d]) => d && daysUntil(d) >= -7)
    .sort((a, b) => new Date(a[1]) - new Date(b[1]));
  const picked = candidates[0] || ["近期無事件", ""];
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
  if (state.filter === "pending") return items.filter((i) => !["cancelled", "received"].includes(i.status));
  if (state.filter === "completed") return items.filter((i) => ["cancelled", "received"].includes(i.status));
  return items.filter((i) => i.type === state.filter);
}

function renderDashboard() {
  const wrappers = {
    launch: state.items.map((i) => ({ ...i, eventLabel: "開賣", date: i.launchDate })).filter((i) => i.date),
    due: state.items.map((i) => ({ ...i, eventLabel: "尾款截止", date: i.finalDueDate })).filter((i) => i.date),
    ship: state.items
      .filter((i) => i.status.includes("shipment") || i.status === "paid" || i.status === "shipped")
      .map((i) => ({ ...i, eventLabel: "出貨", date: i.shippingDate })),
    recent: [...state.items]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3)
      .map((i) => ({ ...i, eventLabel: "新增", date: i.createdAt })),
  };
  screens.home.innerHTML = "";
  const mapItems = (arr) =>
    arr
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 4)
      .map((i) => ({
        title: i.title,
        eventLabel: i.eventLabel,
        dateLabel: fmt(i.date),
        countdown: daysText(daysUntil(i.date)),
      }));

  screens.home.append(
    DashboardCard("即將開賣", mapItems(wrappers.launch)),
    DashboardCard("尾款到期提醒", mapItems(wrappers.due)),
    DashboardCard("等待出貨", mapItems(wrappers.ship)),
    DashboardCard("最近新增", mapItems(wrappers.recent))
  );
}

function daysText(days) {
  if (days === null) return "未設定";
  if (days < 0) return `${Math.abs(days)} 天前`;
  if (days === 0) return "今天";
  return `${days} 天`;
}

function renderList() {
  const filters = [
    ["all", "全部"],
    ["instock", "現貨"],
    ["preorder", "預購"],
    ["pending", "待處理提醒"],
    ["completed", "已完成"],
  ];

  screens.list.innerHTML = `<div class="filters">${filters
    .map(
      ([value, label]) =>
        `<button class="filter-chip ${state.filter === value ? "active" : ""}" data-filter="${value}">${label}</button>`
    )
    .join("")}</div><div class="list-grid" id="list-grid"></div>`;

  screens.list.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.onclick = () => {
      state.filter = chip.dataset.filter;
      renderList();
    };
  });

  const grid = screens.list.querySelector("#list-grid");
  filterItems(state.items).forEach((item) => {
    grid.appendChild(ProductCard(item, getNextEvent(item), openDetail, deleteItem, translateType, translateStatus));
  });
}

function shiftMonth(step) {
  const viewMonth = getSafeViewMonth();
  state.viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + step, 1);
  renderCalendar();
}

function renderCalendar() {
  const viewMonth = getSafeViewMonth();
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const total = monthEnd.getDate();
  const eventsByDate = new Map();

  for (const item of state.items) {
    [["🔥", item.launchDate, "開賣"], ["💰", item.finalDueDate, "尾款"], ["📦", item.shippingDate, "出貨"]].forEach(
      ([icon, date, label]) => {
        if (!date) return;
        const key = new Date(date).toDateString();
        const value = eventsByDate.get(key) || [];
        value.push({ icon, label, title: item.title, itemId: item.id });
        eventsByDate.set(key, value);
      }
    );
  }

  screens.calendar.innerHTML = `<article class="card">
    <div class="calendar-title-row">
      ${clayButton("＜", 'id="prev-month" type="button"')}
      <h3 class="section-title">${viewMonth.getFullYear()}年${viewMonth.getMonth() + 1}月</h3>
      ${clayButton("＞", 'id="next-month" type="button"')}
    </div>
    <div class="calendar-weekdays">${["日", "一", "二", "三", "四", "五", "六"].map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="calendar-grid" id="calendar-grid"></div>
    <div id="calendar-events" class="card nested-card"><p class="meta">點選日期查看事件。</p></div>
  </article>`;

  screens.calendar.querySelector("#prev-month").onclick = () => shiftMonth(-1);
  screens.calendar.querySelector("#next-month").onclick = () => shiftMonth(1);

  const grid = screens.calendar.querySelector("#calendar-grid");
  for (let i = 0; i < firstWeekday; i++) grid.appendChild(document.createElement("div"));

  for (let day = 1; day <= total; day++) {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
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
    box.innerHTML = `<h4 class="sub-title">${date.toLocaleDateString("zh-TW")}</h4><p class="meta">這天沒有事件。</p>`;
    return;
  }
  box.innerHTML = `<h4 class="sub-title">${date.toLocaleDateString("zh-TW")}</h4><ul class="item-list">${events
    .map((e) => `<li>${e.icon} <strong>${e.title}</strong> · ${e.label}</li>`)
    .join("")}</ul>`;
}

function field(name, label, value, required = false, type = "text") {
  const normalized = type === "datetime-local" && value ? new Date(value).toISOString().slice(0, 16) : value;
  return formField({ name, label, value: normalized, required, type });
}

function renderAddEdit(item = null) {
  const isEdit = Boolean(item);
  const typeOptions = [["instock", "現貨"], ["preorder", "預購"]]
    .map(([value, label]) => `<option ${item?.type === value ? "selected" : ""} value="${value}">${label}</option>`)
    .join("");

  screens.add.innerHTML = `<form id="item-form" class="card form-card">
    <h3 class="section-title">${isEdit ? "編輯商品" : "新增商品"}</h3>
    ${field("title", "商品名稱", item?.title || "", true)}
    ${field("store", "商店名稱", item?.store || "")}
    ${formSelect({ name: "type", id: "type", label: "商品類型", options: typeOptions })}
    ${formSelect({ name: "status", id: "status", label: "狀態", options: "" })}
    ${field("launchDate", "開賣日期時間", item?.launchDate || "", false, "datetime-local")}
    ${field("purchaseDate", "購買日期時間", item?.purchaseDate || "", false, "datetime-local")}
    ${field("depositAmount", "訂金", item?.depositAmount || "", false, "number")}
    ${field("finalAmount", "尾款", item?.finalAmount || "", false, "number")}
    ${field("finalDueDate", "尾款截止日", item?.finalDueDate || "", false, "datetime-local")}
    ${field("shippingDate", "預計出貨日", item?.shippingDate || "", false, "datetime-local")}
    ${field("url", "外部連結", item?.url || "", false, "url")}
    <div class="field"><label>上傳圖片</label><input type="file" id="images" accept="image/*" multiple /></div>
    <div class="field"><label>備註</label><textarea name="notes" rows="4">${item?.notes || ""}</textarea></div>
    ${actionRow([
      `<button class="clay-button primary" type="submit">${isEdit ? "儲存變更" : "儲存"}</button>`,
      isEdit ? clayButton("取消", 'type="button" id="cancel-edit"') : "",
    ])}
  </form>`;

  const typeEl = document.getElementById("type");
  const statusEl = document.getElementById("status");
  const syncStatus = () => {
    const opts = statusOptions[typeEl.value];
    statusEl.innerHTML = opts
      .map((s) => `<option ${item?.status === s ? "selected" : ""} value="${s}">${translateStatus(s)}</option>`)
      .join("");
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

  if (isEdit) {
    document.getElementById("cancel-edit").onclick = () => {
      state.editingId = null;
      switchScreen("list");
    };
  }
}

function toISO(v) {
  return v ? new Date(v).toISOString() : "";
}

function filesToDataUrls(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        })
    )
  );
}

function openDetail(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;

  detailContent.innerHTML = `
    <h3 class="section-title">${item.title}</h3>
    ${ImageGallery(item.images)}
    <p><strong>商店：</strong>${item.store || "-"}</p>
    <p><strong>類型：</strong>${translateType(item.type)}</p>
    <p><strong>狀態：</strong><span class="status-tag">${translateStatus(item.status)}</span></p>
    <h4 class="sub-title">時間軸</h4>${Timeline(item)}
    <h4 class="sub-title">金額資訊</h4>
    <p>訂金：$${item.depositAmount || 0}</p>
    <p>尾款：$${item.finalAmount || 0}</p>
    <p>尾款截止：${fmt(item.finalDueDate)}</p>
    <h4 class="sub-title">外部連結</h4>
    <p>${item.url ? `<a href="${item.url}" target="_blank" rel="noopener">${item.url}</a>` : "未提供連結"}</p>
    <h4 class="sub-title">備註</h4><p class="note-box">${item.notes || "-"}</p>
    ${actionRow([clayButton("編輯", 'id="edit-item"')])}
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
  if (!confirm("確定要刪除這個商品嗎？")) return;
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
