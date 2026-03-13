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
const floatingAdd = document.getElementById("floating-add");

const state = {
  items: [],
  filter: "all",
  searchTerm: "",
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
  waiting_final_payment: "等待付款",
  paid: "已付清",
  waiting_shipment: "等待出貨",
};

const typeText = { instock: "現貨", preorder: "預售" };
const emojiChoices = ["💙", "💜", "🩷", "❤️", "💚", "💛", "🔥", "⭐", "🎁", "🦋", "🌸", "🐱", "👗", "⚔️"];

const seedItems = [
  { id: crypto.randomUUID(), title: "初音未來 15th Anniversary Figure", store: "Good Smile Company", type: "preorder", status: "waiting_final_payment", launchDate: futureDate(-10), purchaseDate: futureDate(-14), depositAmount: 1200, finalAmount: 5800, finalDueDate: futureDate(13), shippingDate: futureDate(26), url: "https://example.com/miku", images: [], notes: "含特典。", createdAt: new Date().toISOString(), emoji: "💙" },
  { id: crypto.randomUUID(), title: "咒術迴戰 五条悟 1/7 比例像", store: "Aniplex", type: "preorder", status: "ordered", launchDate: futureDate(-3), purchaseDate: futureDate(-2), depositAmount: 1000, finalAmount: 8800, finalDueDate: futureDate(19), shippingDate: futureDate(40), url: "https://example.com/gojo", images: [], notes: "尾款到期提醒。", createdAt: new Date().toISOString(), emoji: "🌌" },
  { id: crypto.randomUUID(), title: "鬼滅之刃 竈門炭治郎 全集結組", store: "MegaHouse", type: "instock", status: "waiting_shipment", launchDate: futureDate(-7), purchaseDate: futureDate(-6), depositAmount: 0, finalAmount: 4200, finalDueDate: "", shippingDate: futureDate(8), url: "https://example.com/tanjiro", images: [], notes: "盡快出貨。", createdAt: new Date().toISOString(), emoji: "🔥" },
];

function futureDate(dayOffset) { const d = new Date(); d.setDate(d.getDate() + dayOffset); return d.toISOString(); }
const fmt = (d) => (d ? new Date(d).toLocaleDateString("zh-TW") : "未設定");
const daysUntil = (d) => (!d ? null : Math.ceil((new Date(d) - new Date()) / 86400000));
const daysText = (days) => (days === null ? "未設定" : days < 0 ? `逾期 ${Math.abs(days)} 天` : days === 0 ? "今天" : `還有 ${days} 天`);
const translateStatus = (s) => statusText[s] || s;
const translateType = (t) => typeText[t] || t;

function getSafeViewMonth() {
  if (!(state.viewMonth instanceof Date) || Number.isNaN(state.viewMonth.getTime())) {
    state.viewMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }
  return state.viewMonth;
}

function getNextEvent(item) {
  const events = [["開賣", item.launchDate], ["尾款", item.finalDueDate], ["出貨", item.shippingDate]]
    .filter(([, d]) => d)
    .sort((a, b) => new Date(a[1]) - new Date(b[1]));
  const picked = events[0] || ["近期無事件", ""];
  return { label: picked[0], dateLabel: fmt(picked[1]), days: daysUntil(picked[1]) };
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
  floatingAdd.onclick = () => switchScreen("add");
}

function switchScreen(name) {
  Object.entries(screens).forEach(([k, v]) => v.classList.toggle("active", k === name));
  floatingAdd.classList.toggle("hidden", name === "add");
  if (name === "add") renderAddEdit(state.editingId ? state.items.find((i) => i.id === state.editingId) : null);
}

function filterItems(items) {
  let filtered = items;
  if (state.filter !== "all") {
    if (state.filter === "pending") filtered = filtered.filter((i) => !["cancelled", "received"].includes(i.status));
    else if (state.filter === "completed") filtered = filtered.filter((i) => ["cancelled", "received"].includes(i.status));
    else if (state.filter === "shipsoon") filtered = filtered.filter((i) => i.shippingDate && daysUntil(i.shippingDate) <= 7 && daysUntil(i.shippingDate) >= 0);
    else if (state.filter === "waitingpay") filtered = filtered.filter((i) => ["waiting_final_payment", "ordered"].includes(i.status));
    else filtered = filtered.filter((i) => i.type === state.filter);
  }

  if (state.searchTerm.trim()) {
    const q = state.searchTerm.trim().toLowerCase();
    filtered = filtered.filter((i) => `${i.title} ${i.store}`.toLowerCase().includes(q));
  }

  return filtered;
}

function goListWithFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector('.nav-btn[data-screen="list"]').classList.add("active");
  switchScreen("list");
  renderList();
}

function renderHomeProductList(items) {
  if (!items.length) return '<p class="meta">目前沒有商品。</p>';
  return `<div class="home-product-list">${items
    .map((i) => `<button class="home-product-item" data-id="${i.id}"><span class="left">${i.emoji || "📦"} ${i.title}</span><span class="status-mini">${translateStatus(i.status)}</span></button>`)
    .join("")}</div>`;
}

function renderDashboard() {
  const pending = state.items.filter((i) => !["received", "cancelled"].includes(i.status)).length;
  const waitingPay = state.items.filter((i) => ["waiting_final_payment", "ordered"].includes(i.status)).length;
  const shipSoon = state.items.filter((i) => i.shippingDate && daysUntil(i.shippingDate) <= 7 && daysUntil(i.shippingDate) >= 0).length;
  const total = state.items.reduce((sum, i) => sum + Number(i.finalAmount || 0), 0);

  const launchSoon = state.items.map((i) => ({ ...i, eventLabel: "開賣", date: i.launchDate })).filter((i) => i.date).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
  const paySoon = state.items.map((i) => ({ ...i, eventLabel: "尾款", date: i.finalDueDate })).filter((i) => i.date).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
  const shipSoonItems = state.items.map((i) => ({ ...i, eventLabel: "出貨", date: i.shippingDate })).filter((i) => i.date).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);

  screens.home.innerHTML = `
    <header class="page-title">
      <p>哈囉 👋</p>
      <h2>我的預購追蹤</h2>
      <button class="icon-bell">🔔</button>
    </header>
    <section class="stat-grid">
      <button class="stat-card pink" data-jump="pending"><h3>${pending}<small>件</small></h3><p>追蹤中</p></button>
      <button class="stat-card orange" data-jump="waitingpay"><h3>${waitingPay}<small>件</small></h3><p>等待付款</p></button>
      <button class="stat-card mint" data-jump="shipsoon"><h3>${shipSoon}<small>件</small></h3><p>即將出貨</p></button>
      <article class="stat-card purple"><h3>$${(total / 1000).toFixed(1)}k</h3><p>總金額</p></article>
    </section>
    <section class="section-block"><h3>🔥 即將開賣</h3><div id="home-launch"></div></section>
    <section class="section-block"><h3>💰 尾款提醒</h3><div id="home-pay"></div></section>
    <section class="section-block"><h3>📦 即將出貨</h3><div id="home-ship"></div></section>
    <section class="section-block"><h3>🛍️ 全部商品</h3><div id="home-all">${renderHomeProductList(state.items)}</div></section>
  `;

  screens.home.querySelectorAll(".stat-card[data-jump]").forEach((btn) => (btn.onclick = () => goListWithFilter(btn.dataset.jump)));
  screens.home.querySelectorAll(".home-product-item").forEach((btn) => (btn.onclick = () => openDetail(btn.dataset.id)));

  const mapRows = (arr) => arr.map((i) => ({ id: i.id, title: i.title, eventLabel: i.eventLabel, dateLabel: fmt(i.date), countdown: daysText(daysUntil(i.date)) }));
  screens.home.querySelector("#home-launch").appendChild(DashboardCard("", mapRows(launchSoon), openDetail));
  screens.home.querySelector("#home-pay").appendChild(DashboardCard("", mapRows(paySoon), openDetail));
  screens.home.querySelector("#home-ship").appendChild(DashboardCard("", mapRows(shipSoonItems), openDetail));
}

function renderList() {
  const filters = [["all", "全部"], ["instock", "現貨"], ["preorder", "預售"], ["waitingpay", "等待付款"], ["shipsoon", "即將出貨"], ["completed", "已完成"]];
  screens.list.innerHTML = `
    <header class="page-title list-header"><h2>預購清單 👜</h2><p>共 ${state.items.length} 件商品</p></header>
    <input id="search-input" class="search-box" placeholder="搜尋商品名稱或商店..." value="${state.searchTerm}" />
    <div class="filters">${filters.map(([v, l]) => `<button class="filter-chip ${state.filter === v ? "active" : ""}" data-filter="${v}">${l}</button>`).join("")}</div>
    <div class="list-grid" id="list-grid"></div>
  `;

  screens.list.querySelector("#search-input").oninput = (e) => {
    state.searchTerm = e.target.value;
    renderList();
  };

  screens.list.querySelectorAll(".filter-chip").forEach((c) => {
    c.onclick = () => {
      state.filter = c.dataset.filter;
      renderList();
    };
  });

  const grid = screens.list.querySelector("#list-grid");
  filterItems(state.items).forEach((item) => grid.appendChild(ProductCard(item, getNextEvent(item), openDetail, deleteItem, translateType, translateStatus)));
}

function shiftMonth(step) {
  const vm = getSafeViewMonth();
  state.viewMonth = new Date(vm.getFullYear(), vm.getMonth() + step, 1);
  renderCalendar();
}

function renderCalendar() {
  const vm = getSafeViewMonth();
  const monthStart = new Date(vm.getFullYear(), vm.getMonth(), 1);
  const monthEnd = new Date(vm.getFullYear(), vm.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const total = monthEnd.getDate();
  const eventsByDate = new Map();

  for (const item of state.items) {
    [["🔥", item.launchDate, "開賣"], ["💰", item.finalDueDate, "尾款"], ["📦", item.shippingDate, "出貨"]].forEach(([icon, date, label]) => {
      if (!date) return;
      const key = new Date(date).toDateString();
      const list = eventsByDate.get(key) || [];
      list.push({ icon, label, title: item.title });
      eventsByDate.set(key, list);
    });
  }

  screens.calendar.innerHTML = `
    <header class="page-title list-header"><h2>活動月曆 🗓️</h2><p>查看所有重要日期</p></header>
    <article class="calendar-panel">
      <div class="calendar-title-row">${clayButton("‹", 'id="prev-month"')}<h3>${vm.getMonth() + 1}月 <small>${vm.getFullYear()} 年</small></h3>${clayButton("›", 'id="next-month"')}</div>
      <div class="calendar-weekdays">${["日", "一", "二", "三", "四", "五", "六"].map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="calendar-grid" id="calendar-grid"></div>
    </article>
    <div class="legend">🔥 開賣　💰 尾款　📦 出貨</div>
    <section id="calendar-events" class="event-feed card"><p class="meta">點選日期查看事件。</p></section>
  `;

  screens.calendar.querySelector("#prev-month").onclick = () => shiftMonth(-1);
  screens.calendar.querySelector("#next-month").onclick = () => shiftMonth(1);

  const grid = screens.calendar.querySelector("#calendar-grid");
  for (let i = 0; i < firstWeekday; i++) grid.appendChild(document.createElement("div"));
  for (let day = 1; day <= total; day++) {
    const date = new Date(vm.getFullYear(), vm.getMonth(), day);
    const key = date.toDateString();
    const events = eventsByDate.get(key) || [];
    const btn = document.createElement("button");
    btn.className = `day-cell ${events.length ? "has-events" : ""}`;
    btn.innerHTML = `<strong>${day}</strong>${events[0] ? `<span>${events[0].icon}</span>` : ""}`;
    btn.onclick = () => renderCalendarEvents(date, events);
    grid.appendChild(btn);
  }
}

function renderCalendarEvents(date, events) {
  const box = document.getElementById("calendar-events");
  if (!events.length) {
    box.innerHTML = `<h4>${date.toLocaleDateString("zh-TW")}</h4><p class="meta">本日沒有活動</p>`;
    return;
  }
  box.innerHTML = `<h4>${date.toLocaleDateString("zh-TW")}</h4><ul class="item-list">${events.map((e) => `<li>${e.icon} ${e.title} · ${e.label}</li>`).join("")}</ul>`;
}

function field(name, label, value, required = false, type = "text") {
  const normalized = type === "datetime-local" && value ? new Date(value).toISOString().slice(0, 16) : value;
  return formField({ name, label, value: normalized, required, type });
}

function renderAddEdit(item = null) {
  const isEdit = Boolean(item);
  const emoji = item?.emoji || emojiChoices[0];
  const typeOptions = [["instock", "公仔"], ["preorder", "預售"]].map(([v, l]) => `<option ${item?.type === v ? "selected" : ""} value="${v}">${l}</option>`).join("");

  screens.add.innerHTML = `
    <header class="page-title add-header"><h2>✨ ${isEdit ? "編輯商品" : "新增商品"}</h2></header>
    <section class="card emoji-pick"><label>選擇圖示</label><div class="emoji-row">${emojiChoices.map((e) => `<button type="button" class="emoji-btn ${emoji === e ? "active" : ""}" data-emoji="${e}">${e}</button>`).join("")}</div></section>
    <form id="item-form" class="stack-form">
      <section class="card form-section">
        <h3>📋 基本資料</h3>
        ${field("title", "商品名稱", item?.title || "", true)}
        ${field("store", "商店", item?.store || "")}
        <div class="two-col">${formSelect({ name: "type", id: "type", label: "商品類型", options: typeOptions })}${formSelect({ name: "status", id: "status", label: "狀態", options: "" })}</div>
      </section>
      <section class="card form-section">
        <h3>💰 日期與金額</h3>
        ${field("launchDate", "開賣日期", item?.launchDate || "", false, "datetime-local")}
        <div class="two-col">${field("depositAmount", "訂金 (NT$)", item?.depositAmount || "", false, "number")}${field("finalAmount", "尾款 (NT$)", item?.finalAmount || "", false, "number")}</div>
        ${field("finalDueDate", "尾款期限", item?.finalDueDate || "", false, "datetime-local")}
        ${field("shippingDate", "預計出貨日期", item?.shippingDate || "", false, "datetime-local")}
      </section>
      <section class="card form-section">
        <h3>📝 其他資訊</h3>
        ${field("url", "商品連結", item?.url || "", false, "url")}
        <div class="field"><label>備註</label><textarea name="notes" rows="4">${item?.notes || ""}</textarea></div>
      </section>
      <div class="sticky-actions">${actionRow([
        clayButton("取消", 'type="button" id="cancel-edit"'),
        `<button class="clay-button primary" type="submit">${isEdit ? "儲存變更" : "儲存商品"}</button>`,
      ])}</div>
    </form>
  `;

  const typeEl = document.getElementById("type");
  const statusEl = document.getElementById("status");
  const syncStatus = () => {
    statusEl.innerHTML = statusOptions[typeEl.value].map((s) => `<option ${item?.status === s ? "selected" : ""} value="${s}">${translateStatus(s)}</option>`).join("");
  };
  syncStatus();
  typeEl.onchange = syncStatus;

  let selectedEmoji = emoji;
  screens.add.querySelectorAll(".emoji-btn").forEach((btn) => {
    btn.onclick = () => {
      selectedEmoji = btn.dataset.emoji;
      screens.add.querySelectorAll(".emoji-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });

  document.getElementById("item-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const record = {
      id: item?.id || crypto.randomUUID(),
      title: form.get("title"),
      store: form.get("store"),
      type: form.get("type"),
      status: form.get("status"),
      launchDate: toISO(form.get("launchDate")),
      purchaseDate: item?.purchaseDate || "",
      depositAmount: Number(form.get("depositAmount") || 0),
      finalAmount: Number(form.get("finalAmount") || 0),
      finalDueDate: toISO(form.get("finalDueDate")),
      shippingDate: toISO(form.get("shippingDate")),
      url: form.get("url"),
      images: item?.images || [],
      notes: form.get("notes"),
      createdAt: item?.createdAt || new Date().toISOString(),
      emoji: selectedEmoji,
    };
    await ItemDB.put(record);
    state.editingId = null;
    await loadAndRender();
    switchScreen("list");
  };

  document.getElementById("cancel-edit").onclick = () => {
    state.editingId = null;
    switchScreen("home");
  };
}

function toISO(v) { return v ? new Date(v).toISOString() : ""; }

function openDetail(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  detailContent.innerHTML = `
    <h3>${item.emoji || "📦"} ${item.title}</h3>
    ${ImageGallery(item.images)}
    <p><strong>商店：</strong>${item.store || "-"}</p>
    <p><strong>狀態：</strong><span class="status-tag">${translateStatus(item.status)}</span></p>
    <h4>時間軸</h4>${Timeline(item)}
    <h4>金額</h4><p>訂金：NT$${item.depositAmount || 0} / 尾款：NT$${item.finalAmount || 0}</p>
    <h4>連結</h4><p>${item.url ? `<a href="${item.url}" target="_blank" rel="noopener">${item.url}</a>` : "未提供連結"}</p>
    <h4>備註</h4><p class="note-box">${item.notes || "-"}</p>
    ${actionRow([clayButton("編輯", 'id="edit-item"'), clayButton("刪除", 'id="delete-item"')])}
  `;

  detailContent.querySelector("#edit-item").onclick = () => {
    detailModal.close();
    state.editingId = id;
    switchScreen("add");
  };

  detailContent.querySelector("#delete-item").onclick = async () => {
    detailModal.close();
    await deleteItem(id);
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
