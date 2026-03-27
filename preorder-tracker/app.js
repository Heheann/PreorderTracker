import { ItemDB } from "./db/indexeddb.js";
import { ProductCard } from "./components/productCard.js";
import { DashboardCard } from "./components/dashboardCard.js";
import { Timeline } from "./components/timeline.js";
import { ImageGallery } from "./components/gallery.js";
import { actionRow, clayButton, escapeHtml, formField, formSelect } from "./components/uiKit.js";
import { FIREBASE_WEB_CONFIG, hasFirebaseWebConfig } from "./firebase-config.js";
import {
  createDeviceId,
  requestNotificationPermission,
  setupFirebaseMessaging,
  getNotificationPermission,
  postJson,
} from "./firebase-client.js";

const screens = {
  home: document.getElementById("screen-home"),
  list: document.getElementById("screen-list"),
  calendar: document.getElementById("screen-calendar"),
  expense: document.getElementById("screen-expense"),
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
  expenseRange: "month",
  expenseMode: "paid_only",
  reminder: {
    supported: false,
    configured: hasFirebaseWebConfig(FIREBASE_WEB_CONFIG),
    enabled: false,
    busy: false,
    permission: getNotificationPermission(),
    message: "尚未啟用付款提醒",
    deviceId: createDeviceId(),
    token: "",
  },
};

const FILTERS = [
  ["all", "全部"],
  ["instock", "現貨"],
  ["preorder", "預購"],
  ["waitingpay", "待尾款"],
  ["shipsoon", "即將出貨"],
  ["completed", "已完成"],
];

const STATUS_OPTIONS = {
  instock: ["upcoming_sale", "on_sale", "purchased", "waiting_shipment", "shipped", "received", "cancelled"],
  preorder: [
    "upcoming_sale",
    "ordered",
    "deposit_paid",
    "waiting_final_payment",
    "paid",
    "waiting_shipment",
    "shipped",
    "received",
    "cancelled",
  ],
};

const STATUS_TEXT = {
  upcoming_sale: "尚未開售",
  on_sale: "開賣中",
  purchased: "已購買",
  shipped: "已出貨",
  received: "已收貨",
  cancelled: "已取消",
  ordered: "已下單",
  deposit_paid: "已付訂金",
  waiting_final_payment: "待付尾款",
  paid: "尾款已付",
  waiting_shipment: "待出貨",
};

const TYPE_TEXT = {
  instock: "現貨",
  preorder: "預購",
};

const PAID_INSTOCK_STATUSES = new Set(["purchased", "waiting_shipment", "shipped", "received"]);
const PAID_PREORDER_DEPOSIT_STATUSES = new Set([
  "deposit_paid",
  "waiting_final_payment",
  "paid",
  "waiting_shipment",
  "shipped",
  "received",
]);
const PAID_PREORDER_FINAL_STATUSES = new Set(["paid", "waiting_shipment", "shipped", "received"]);
const REMINDER_DAY_OFFSETS = [-3, -1, 0];
const REMINDER_TAIPEI_TIME = { hour: 9, minute: 0 };
const REMINDER_TZ = "Asia/Taipei";
const REMINDER_EVENT_LABELS = {
  launch: "開售",
  deposit: "訂金",
  final: "尾款",
};
const EMOJI_CHOICES = ["🎁", "🎮", "🧸", "📚", "🎧", "🧃", "🍰", "👟", "🧪", "🧴", "🧩", "🎀"];

let deferredInstallPrompt = null;
let appServiceWorkerRegistration = null;

const seedItems = [
  {
    id: crypto.randomUUID(),
    title: "初音 15th Anniversary Figure",
    store: "Good Smile Company",
    type: "preorder",
    status: "waiting_final_payment",
    launchDate: futureDate(-10),
    purchaseDate: futureDate(-14),
    depositAmount: 1200,
    depositDueDate: futureDate(-13),
    finalAmount: 5800,
    finalDueDate: futureDate(13),
    shippingDate: futureDate(26),
    url: "https://example.com/miku",
    images: [],
    notes: "需在尾款期限前完成付款。",
    createdAt: new Date().toISOString(),
    emoji: "🎀",
  },
  {
    id: crypto.randomUUID(),
    title: "咒術迴戰 五條悟 1/7 比例",
    store: "Aniplex",
    type: "preorder",
    status: "ordered",
    launchDate: futureDate(-3),
    purchaseDate: futureDate(-2),
    depositAmount: 1000,
    depositDueDate: futureDate(4),
    finalAmount: 8800,
    finalDueDate: futureDate(19),
    shippingDate: futureDate(40),
    url: "https://example.com/gojo",
    images: [],
    notes: "已下單，等待尾款通知。",
    createdAt: new Date().toISOString(),
    emoji: "🧿",
  },
  {
    id: crypto.randomUUID(),
    title: "鬼滅之刃 炭治郎 可動模型",
    store: "MegaHouse",
    type: "instock",
    status: "waiting_shipment",
    launchDate: futureDate(-7),
    purchaseDate: futureDate(-6),
    depositAmount: 0,
    depositDueDate: "",
    finalAmount: 4200,
    finalDueDate: "",
    shippingDate: futureDate(8),
    url: "https://example.com/tanjiro",
    images: [],
    notes: "等待商店安排出貨。",
    createdAt: new Date().toISOString(),
    emoji: "🔥",
  },
];

function futureDate(dayOffset, hour = 12) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function fmtDateTime(value) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";

  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(value) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return date.toLocaleDateString("zh-TW");
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / 86400000);
}

function daysText(days) {
  if (days === null) return "未設定";
  if (days < 0) return `已過 ${Math.abs(days)} 天`;
  if (days === 0) return "今天";
  return `${days} 天後`;
}

function translateStatus(status) {
  return STATUS_TEXT[status] || status;
}

function translateType(type) {
  return TYPE_TEXT[type] || type;
}

function getSafeViewMonth() {
  if (!(state.viewMonth instanceof Date) || Number.isNaN(state.viewMonth.getTime())) {
    state.viewMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }
  return state.viewMonth;
}

function getNextEvent(item) {
  const events = [
    ["開售", item.launchDate],
    ["訂金", item.depositDueDate],
    ["尾款", item.finalDueDate],
    ["出貨", item.shippingDate],
  ]
    .filter(([, date]) => date)
    .sort((a, b) => new Date(a[1]) - new Date(b[1]));

  const [label, date] = events[0] || ["尚無事件", ""];
  const days = daysUntil(date);

  return {
    label,
    dateLabel: fmtDate(date),
    days,
    countdown: daysText(days),
  };
}

function toInputDateTime(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toISO(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("圖片讀取失敗"));
    reader.readAsDataURL(file);
  });
}

function localDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getSafeExternalUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
  } catch {
    return "";
  }
  return "";
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function firstValidDate(...candidates) {
  for (const candidate of candidates) {
    const date = toDate(candidate);
    if (date) return date;
  }
  return null;
}

function money(value) {
  return `NT$${Number(value || 0).toLocaleString()}`;
}

function compactMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 10000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toLocaleString();
}

function getItemTotalAmount(item) {
  return Number(item.depositAmount || 0) + Number(item.finalAmount || 0);
}

function getReminderApiBaseUrl() {
  return String(FIREBASE_WEB_CONFIG.apiBaseUrl || "").replace(/\/+$/, "");
}

function getReminderApiHeaders() {
  const headers = {};
  if (FIREBASE_WEB_CONFIG.apiSecret) headers["x-api-secret"] = FIREBASE_WEB_CONFIG.apiSecret;
  return headers;
}

function getTaipeiDateParts(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function toTaipeiMorningISO(value, dayOffset = 0) {
  const parts = getTaipeiDateParts(value);
  if (!parts) return "";
  const utcHour = REMINDER_TAIPEI_TIME.hour - 8;
  const utcBase = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, utcHour, REMINDER_TAIPEI_TIME.minute, 0, 0));
  utcBase.setUTCDate(utcBase.getUTCDate() + dayOffset);
  return utcBase.toISOString();
}

function fmtTaipeiDate(value) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return date.toLocaleDateString("zh-TW", { timeZone: REMINDER_TZ });
}

function getTaipeiDateKey(value) {
  const parts = getTaipeiDateParts(value);
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function buildReminderJobId(deviceId, itemId, eventType, dayOffset) {
  return `${deviceId}:${itemId}:${eventType}:${dayOffset}`;
}

function buildReminderJob(item, deviceId, eventType, dueDate, dayOffset) {
  let triggerAt = toTaipeiMorningISO(dueDate, dayOffset);
  if (!triggerAt) return null;

  const triggerTime = new Date(triggerAt).getTime();
  const now = Date.now();
  if (triggerTime < now) {
    // Catch-up once: if missed 09:00 but still same Taipei day, dispatch immediately.
    if (getTaipeiDateKey(triggerAt) !== getTaipeiDateKey(new Date(now).toISOString())) {
      return null;
    }
    triggerAt = new Date(now + 5000).toISOString();
  }

  const eventLabel = REMINDER_EVENT_LABELS[eventType] || "付款";

  return {
    jobId: buildReminderJobId(deviceId, item.id, eventType, dayOffset),
    deviceId,
    itemId: item.id,
    itemTitle: item.title,
    eventType,
    dueDate,
    triggerAt,
    status: "scheduled",
    title: `提醒：${item.title}`,
    body: `${eventLabel}將於 ${fmtTaipeiDate(dueDate)} 到期`,
  };
}

function buildPaymentReminderJobs(items, deviceId) {
  const jobs = [];

  for (const item of items) {
    const dateEvents = [
      ["launch", item.launchDate],
      ["deposit", item.depositDueDate],
      ["final", item.finalDueDate],
    ];

    dateEvents.forEach(([eventType, dueDate]) => {
      if (!dueDate) return;
      REMINDER_DAY_OFFSETS.forEach((offset) => {
        const job = buildReminderJob(item, deviceId, eventType, dueDate, offset);
        if (job) jobs.push(job);
      });
    });
  }

  return jobs;
}

function reminderButtonLabel() {
  if (state.reminder.busy) return "啟用中...";
  if (state.reminder.enabled) return "付款提醒已啟用";
  if (!state.reminder.configured) return "尚未設定推播";
  if (!state.reminder.supported) return "此裝置不支援推播";
  if (state.reminder.permission === "denied") return "通知已被封鎖";
  return "啟用付款提醒";
}

function getReminderButtonHTML() {
  const disabled =
    state.reminder.busy ||
    state.reminder.enabled ||
    !state.reminder.configured ||
    !state.reminder.supported ||
    state.reminder.permission === "denied";
  return `<button id="enable-reminders" class="reminder-btn" ${disabled ? "disabled" : ""}>${escapeHtml(reminderButtonLabel())}</button>`;
}

function getReminderMetaHTML() {
  return `<p class="reminder-meta">${escapeHtml(state.reminder.message)}</p>`;
}

function updateReminderMessage(message) {
  state.reminder.message = message;
}

async function registerDeviceWithCloud(token) {
  const apiBaseUrl = getReminderApiBaseUrl();
  if (!apiBaseUrl) throw new Error("尚未設定提醒 API 位址");
  await postJson(`${apiBaseUrl}/registerDevice`, {
    deviceId: state.reminder.deviceId,
    fcmToken: token,
    platform: "web-pwa",
    timezone: REMINDER_TZ,
  }, getReminderApiHeaders());
}

async function syncPaymentReminders() {
  if (!state.reminder.enabled || !state.reminder.token) return;
  const apiBaseUrl = getReminderApiBaseUrl();
  if (!apiBaseUrl) return;
  const jobs = buildPaymentReminderJobs(state.items, state.reminder.deviceId);
  await postJson(`${apiBaseUrl}/syncReminderJobs`, {
    deviceId: state.reminder.deviceId,
    jobs,
  }, getReminderApiHeaders());
  updateReminderMessage(`付款提醒已啟用，已同步 ${jobs.length} 筆提醒。`);
  if (screens.home.classList.contains("active")) renderDashboard();
}

async function enablePaymentReminders() {
  if (state.reminder.busy) return;
  state.reminder.busy = true;
  updateReminderMessage("正在初始化付款提醒...");
  renderDashboard();

  try {
    if (!state.reminder.configured) {
      throw new Error("尚未設定 Firebase 推播參數，請先填寫 firebase-config.js。");
    }

    if (!appServiceWorkerRegistration) {
      appServiceWorkerRegistration = await registerServiceWorker();
    }

    const setup = await setupFirebaseMessaging(FIREBASE_WEB_CONFIG, appServiceWorkerRegistration);
    state.reminder.supported = setup.supported;
    if (!setup.supported) {
      throw new Error("此裝置或瀏覽器不支援 Web Push。");
    }

    const permission = await requestNotificationPermission();
    state.reminder.permission = permission;
    if (permission !== "granted") {
      throw new Error("尚未允許通知權限，請到瀏覽器設定開啟通知。");
    }

    const token = await setup.fetchToken();
    if (!token) {
      throw new Error("取得推播 Token 失敗，請確認 VAPID Key 與 Firebase 設定。");
    }

    state.reminder.token = token;
    state.reminder.enabled = true;
    await registerDeviceWithCloud(token);
    await syncPaymentReminders();
  } catch (error) {
    console.error("啟用付款提醒失敗", error);
    updateReminderMessage(error?.message || "啟用付款提醒失敗，請稍後再試。");
    state.reminder.enabled = false;
  } finally {
    state.reminder.busy = false;
    renderDashboard();
  }
}

function inRange(date, start, end) {
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

function buildExpenseEntries(items) {
  const entries = [];

  for (const item of items) {
    if (item.type === "instock" && PAID_INSTOCK_STATUSES.has(item.status)) {
      const amount = Number(item.finalAmount || 0);
      const date = firstValidDate(item.purchaseDate, item.createdAt);
      if (amount > 0 && date) {
        entries.push({ amount, date, type: "instock", eventType: "final" });
      }
    }

    if (item.type === "preorder") {
      if (PAID_PREORDER_DEPOSIT_STATUSES.has(item.status)) {
        const amount = Number(item.depositAmount || 0);
        const date = firstValidDate(item.purchaseDate, item.createdAt);
        if (amount > 0 && date) {
          entries.push({ amount, date, type: "preorder", eventType: "deposit" });
        }
      }

      if (PAID_PREORDER_FINAL_STATUSES.has(item.status)) {
        const amount = Number(item.finalAmount || 0);
        const date = firstValidDate(item.finalDueDate, item.purchaseDate, item.createdAt);
        if (amount > 0 && date) {
          entries.push({ amount, date, type: "preorder", eventType: "final" });
        }
      }
    }
  }

  return entries;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function monthLabel(monthIndex) {
  return `${monthIndex + 1}月`;
}

function buildExpenseBuckets(range) {
  const now = new Date();
  const buckets = [];

  if (range === "week") {
    const today = startOfDay(now);
    const rangeStart = addDays(today, -6);
    const rangeEnd = addDays(today, 1);

    for (let i = 0; i < 7; i += 1) {
      const start = addDays(rangeStart, i);
      const end = addDays(start, 1);
      buckets.push({
        key: start.toISOString(),
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        start,
        end,
      });
    }

    return { rangeStart, rangeEnd, title: "最近 7 天", buckets };
  }

  if (range === "year") {
    const year = now.getFullYear();
    const rangeStart = new Date(year, 0, 1);
    const rangeEnd = new Date(year + 1, 0, 1);

    for (let month = 0; month < 12; month += 1) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 1);
      buckets.push({
        key: `${year}-${month + 1}`,
        label: monthLabel(month),
        start,
        end,
      });
    }

    return { rangeStart, rangeEnd, title: `${year} 年`, buckets };
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let cursor = new Date(monthStart);
  let weekIndex = 1;

  while (cursor < monthEnd) {
    const start = new Date(cursor);
    const end = addDays(start, 7);
    if (end > monthEnd) end.setTime(monthEnd.getTime());

    buckets.push({
      key: `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}-w${weekIndex}`,
      label: `第${weekIndex}週`,
      start,
      end,
    });
    weekIndex += 1;
    cursor = end;
  }

  return { rangeStart: monthStart, rangeEnd: monthEnd, title: `${monthStart.getMonth() + 1} 月`, buckets };
}

function sum(numbers) {
  return numbers.reduce((acc, value) => acc + value, 0);
}

function renderExpenseBarChartSVG(buckets, totals) {
  const width = 360;
  const height = 220;
  const left = 28;
  const right = 8;
  const top = 22;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...totals, 1);
  const gap = 8;
  const barWidth = (chartWidth - gap * (buckets.length - 1)) / buckets.length;

  const bars = buckets
    .map((bucket, index) => {
      const value = totals[index];
      const x = left + index * (barWidth + gap);
      const barHeight = value > 0 ? Math.max(4, (value / maxValue) * chartHeight) : 0;
      const y = top + chartHeight - barHeight;
      const valueTextY = Math.max(12, y - 4);
      return `
        <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="6" fill="url(#expenseBarGradient)" />
        <text x="${(x + barWidth / 2).toFixed(2)}" y="${valueTextY.toFixed(2)}" text-anchor="middle" class="expense-bar-value">${value > 0 ? compactMoney(value) : ""}</text>
        <text x="${(x + barWidth / 2).toFixed(2)}" y="${height - 16}" text-anchor="middle" class="expense-axis-label">${escapeHtml(bucket.label)}</text>
      `;
    })
    .join("");

  return `
    <svg class="expense-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="花費直方圖">
      <defs>
        <linearGradient id="expenseBarGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#b87be4" />
          <stop offset="100%" stop-color="#8edfcc" />
        </linearGradient>
      </defs>
      <line x1="${left}" y1="${top + chartHeight}" x2="${width - right}" y2="${top + chartHeight}" stroke="#d8d1e6" stroke-width="1" />
      ${bars}
    </svg>
  `;
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}

function renderExpensePieChartSVG(typeTotals) {
  const total = Number(typeTotals.instock || 0) + Number(typeTotals.preorder || 0);
  if (total <= 0) return "";

  const segments = [
    { key: "instock", value: Number(typeTotals.instock || 0), color: "#8edfcc" },
    { key: "preorder", value: Number(typeTotals.preorder || 0), color: "#c991e8" },
  ].filter((segment) => segment.value > 0);

  const cx = 95;
  const cy = 95;
  const radius = 78;
  let angle = -Math.PI / 2;

  const paths =
    segments.length === 1
      ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${segments[0].color}" />`
      : segments
          .map((segment) => {
            const sweep = (segment.value / total) * Math.PI * 2;
            const path = arcPath(cx, cy, radius, angle, angle + sweep);
            angle += sweep;
            return `<path d="${path}" fill="${segment.color}" />`;
          })
          .join("");

  return `
    <svg class="expense-chart-svg" viewBox="0 0 190 190" role="img" aria-label="花費圓餅圖">
      ${paths}
      <circle cx="${cx}" cy="${cy}" r="42" fill="#fff" />
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="expense-axis-label">總花費</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="expense-bar-value">${compactMoney(total)}</text>
    </svg>
  `;
}

function renderExpense() {
  if (!screens.expense) return;

  const entries = buildExpenseEntries(state.items);
  const { title, buckets } = buildExpenseBuckets(state.expenseRange);
  const totals = buckets.map(() => 0);
  const rangedEntries = [];

  for (const entry of entries) {
    for (let index = 0; index < buckets.length; index += 1) {
      const bucket = buckets[index];
      if (inRange(entry.date, bucket.start, bucket.end)) {
        totals[index] += entry.amount;
        rangedEntries.push(entry);
        break;
      }
    }
  }

  const totalAmount = sum(totals);
  const typeTotals = rangedEntries.reduce(
    (acc, entry) => {
      acc[entry.type] += entry.amount;
      return acc;
    },
    { instock: 0, preorder: 0 }
  );

  const hasData = totalAmount > 0;
  const barChart = hasData ? renderExpenseBarChartSVG(buckets, totals) : '<p class="chart-empty">此期間尚無已付款花費。</p>';
  const pieChart = hasData ? renderExpensePieChartSVG(typeTotals) : '<p class="chart-empty">此期間尚無可分組資料。</p>';

  screens.expense.innerHTML = `
    <section class="expense-page">
      <header class="page-title list-header">
        <h2>花費分析</h2>
        <p>只統計已付款狀態的訂金/尾款</p>
      </header>

      <div class="expense-range" role="tablist" aria-label="花費區間">
        <button class="range-chip ${state.expenseRange === "week" ? "active" : ""}" data-range="week">一周</button>
        <button class="range-chip ${state.expenseRange === "month" ? "active" : ""}" data-range="month">一月</button>
        <button class="range-chip ${state.expenseRange === "year" ? "active" : ""}" data-range="year">一年</button>
      </div>

      <article class="expense-summary">
        <p class="meta">${title}</p>
        <h3 class="expense-total">${money(totalAmount)}</h3>
        <p class="expense-note">共 ${rangedEntries.length} 筆花費紀錄</p>
      </article>

      <article class="chart-card">
        <h3>花費趨勢（直方圖）</h3>
        ${barChart}
      </article>

      <article class="chart-card">
        <h3>花費比例（圓餅圖）</h3>
        ${pieChart}
        <div class="expense-legend">
          <div class="legend-item">
            <span class="legend-label">現貨</span>
            <span class="legend-value">${money(typeTotals.instock)}</span>
          </div>
          <div class="legend-item">
            <span class="legend-label">預購</span>
            <span class="legend-value">${money(typeTotals.preorder)}</span>
          </div>
        </div>
      </article>
    </section>
  `;

  screens.expense.querySelectorAll("[data-range]").forEach((btn) => {
    btn.onclick = () => {
      state.expenseRange = btn.dataset.range;
      renderExpense();
    };
  });
}

async function ensureSeed() {
  const current = await ItemDB.getAll();
  if (current.length) return;
  for (const item of seedItems) await ItemDB.put(item);
}

function setActiveNav(screenName) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.screen === screenName);
  });
}

function mountNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = () => {
      setActiveNav(btn.dataset.screen);
      switchScreen(btn.dataset.screen);
    };
  });

  floatingAdd.onclick = () => {
    setActiveNav("add");
    switchScreen("add");
  };
}

function switchScreen(name) {
  Object.entries(screens).forEach(([key, section]) => {
    if (!section) return;
    section.classList.toggle("active", key === name);
  });

  floatingAdd.classList.toggle("hidden", name === "add" || name === "expense");

  if (name === "add") {
    const editingItem = state.editingId ? state.items.find((item) => item.id === state.editingId) : null;
    renderAddEdit(editingItem || null);
  } else if (name === "expense") {
    renderExpense();
  }
}

function filterItems(items) {
  let filtered = items;

  if (state.filter !== "all") {
    if (state.filter === "pending") {
      filtered = filtered.filter((item) => !["cancelled", "received"].includes(item.status));
    } else if (state.filter === "completed") {
      filtered = filtered.filter((item) => ["cancelled", "received"].includes(item.status));
    } else if (state.filter === "shipsoon") {
      filtered = filtered.filter((item) => {
        const days = daysUntil(item.shippingDate);
        return days !== null && days >= 0 && days <= 7;
      });
    } else if (state.filter === "waitingpay") {
      filtered = filtered.filter((item) => ["waiting_final_payment", "ordered", "deposit_paid"].includes(item.status));
    } else {
      filtered = filtered.filter((item) => item.type === state.filter);
    }
  }

  const q = state.searchTerm.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((item) => `${item.title} ${item.store}`.toLowerCase().includes(q));
  }

  return filtered;
}

function goListWithFilter(filter) {
  state.filter = filter;
  setActiveNav("list");
  switchScreen("list");
  renderList();
}

function renderHomeProductList(items) {
  if (!items.length) return '<p class="meta">目前還沒有商品，先新增第一筆吧。</p>';

  return `<div class="home-product-list">${items
    .map(
      (item) => `<button class="home-product-item" data-id="${escapeHtml(item.id)}"><span class="left">${escapeHtml(item.emoji || "📦")} ${escapeHtml(item.title)}</span><span class="status-mini">${escapeHtml(translateStatus(item.status))}</span></button>`
    )
    .join("")}</div>`;
}

function getInstallButtonHTML() {
  if (!deferredInstallPrompt) return "";
  return '<button id="install-app" class="install-btn">安裝 App</button>';
}

function renderDashboard() {
  const pending = state.items.filter((item) => !["received", "cancelled"].includes(item.status)).length;
  const waitingPay = state.items.filter((item) => ["waiting_final_payment", "ordered", "deposit_paid"].includes(item.status)).length;
  const shipSoon = state.items.filter((item) => {
    const days = daysUntil(item.shippingDate);
    return days !== null && days >= 0 && days <= 7;
  }).length;
  const total = state.items.reduce((sum, item) => sum + getItemTotalAmount(item), 0);

  const launchSoon = state.items
    .map((item) => ({ ...item, eventLabel: "開售", date: item.launchDate }))
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);

  const paySoon = state.items
    .map((item) => ({ ...item, eventLabel: "尾款", date: item.finalDueDate }))
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);

  const shipSoonItems = state.items
    .map((item) => ({ ...item, eventLabel: "出貨", date: item.shippingDate }))
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);

  screens.home.innerHTML = `
    <header class="page-title">
      <p>你好，歡迎回來</p>
      <h2>預購追蹤器</h2>
      <div class="home-action-row">
        ${getInstallButtonHTML()}
        ${getReminderButtonHTML()}
      </div>
      ${getReminderMetaHTML()}
    </header>

    <section class="stat-grid">
      <button class="stat-card pink" data-jump="pending"><h3>${pending}<small> 件</small></h3><p>進行中</p></button>
      <button class="stat-card orange" data-jump="waitingpay"><h3>${waitingPay}<small> 件</small></h3><p>待尾款</p></button>
      <button class="stat-card mint" data-jump="shipsoon"><h3>${shipSoon}<small> 件</small></h3><p>即將出貨</p></button>
      <article class="stat-card purple"><h3>NT$${total.toLocaleString()}</h3><p>總金額</p></article>
    </section>

    <section class="section-block"><h3>🚀 即將開售</h3><div id="home-launch"></div></section>
    <section class="section-block"><h3>💳 即將到期的尾款</h3><div id="home-pay"></div></section>
    <section class="section-block"><h3>📦 即將出貨</h3><div id="home-ship"></div></section>
    <section class="section-block"><h3>📋 所有商品</h3><div id="home-all">${renderHomeProductList(state.items)}</div></section>
  `;

  screens.home.querySelectorAll(".stat-card[data-jump]").forEach((btn) => {
    btn.onclick = () => goListWithFilter(btn.dataset.jump);
  });

  screens.home.querySelectorAll(".home-product-item").forEach((btn) => {
    btn.onclick = () => openDetail(btn.dataset.id);
  });

  const installBtn = screens.home.querySelector("#install-app");
  if (installBtn) installBtn.onclick = promptInstall;

  const reminderBtn = screens.home.querySelector("#enable-reminders");
  if (reminderBtn) reminderBtn.onclick = enablePaymentReminders;

  const mapRows = (items) =>
    items.map((item) => ({
      id: item.id,
      title: item.title,
      eventLabel: item.eventLabel,
      dateLabel: fmtDate(item.date),
      countdown: daysText(daysUntil(item.date)),
    }));

  screens.home.querySelector("#home-launch").appendChild(DashboardCard("", mapRows(launchSoon), openDetail));
  screens.home.querySelector("#home-pay").appendChild(DashboardCard("", mapRows(paySoon), openDetail));
  screens.home.querySelector("#home-ship").appendChild(DashboardCard("", mapRows(shipSoonItems), openDetail));
}

function renderList() {
  const filteredItems = filterItems(state.items);

  screens.list.innerHTML = `
    <header class="page-title list-header"><h2>商品清單</h2><p>共 ${state.items.length} 筆商品</p></header>
    <input id="search-input" class="search-box" placeholder="搜尋商品名稱或店家..." value="${escapeHtml(state.searchTerm)}" />
    <div class="filters">${FILTERS.map(([value, label]) => `<button class="filter-chip ${state.filter === value ? "active" : ""}" data-filter="${value}">${label}</button>`).join("")}</div>
    <div class="list-grid" id="list-grid"></div>
  `;

  screens.list.querySelector("#search-input").oninput = (event) => {
    state.searchTerm = event.target.value;
    renderList();
  };

  screens.list.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.onclick = () => {
      state.filter = chip.dataset.filter;
      renderList();
    };
  });

  const grid = screens.list.querySelector("#list-grid");
  if (!filteredItems.length) {
    grid.innerHTML = '<p class="meta">目前沒有符合條件的商品。</p>';
    return;
  }

  filteredItems.forEach((item) => {
    grid.appendChild(ProductCard(item, getNextEvent(item), openDetail, deleteItem, translateType, translateStatus));
  });
}

function shiftMonth(step) {
  const month = getSafeViewMonth();
  state.viewMonth = new Date(month.getFullYear(), month.getMonth() + step, 1);
  renderCalendar();
}

function renderCalendar() {
  const month = getSafeViewMonth();
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const totalDays = monthEnd.getDate();
  const eventsByDate = new Map();

  state.items.forEach((item) => {
    [["🚀", item.launchDate, "開售"], ["🪙", item.depositDueDate, "訂金"], ["💳", item.finalDueDate, "尾款"], ["📦", item.shippingDate, "出貨"]].forEach(([icon, date, label]) => {
      if (!date) return;
      const key = localDateKey(date);
      if (!key) return;
      const list = eventsByDate.get(key) || [];
      list.push({ icon, label, title: item.title });
      eventsByDate.set(key, list);
    });
  });

  screens.calendar.innerHTML = `
    <header class="page-title list-header"><h2>月曆提醒</h2><p>點日期查看當天事件</p></header>
    <article class="calendar-panel">
      <div class="calendar-title-row">${clayButton("←", 'id="prev-month"')}<h3>${month.getMonth() + 1} 月<small>${month.getFullYear()} 年</small></h3>${clayButton("→", 'id="next-month"')}</div>
      <div class="calendar-weekdays">${["日", "一", "二", "三", "四", "五", "六"].map((day) => `<span>${day}</span>`).join("")}</div>
      <div class="calendar-grid" id="calendar-grid"></div>
    </article>
    <div class="legend">🚀 開售　🪙 訂金　💳 尾款　📦 出貨</div>
    <section id="calendar-events" class="event-feed card"><p class="meta">請點選日期查看事件</p></section>
  `;

  screens.calendar.querySelector("#prev-month").onclick = () => shiftMonth(-1);
  screens.calendar.querySelector("#next-month").onclick = () => shiftMonth(1);

  const grid = screens.calendar.querySelector("#calendar-grid");

  for (let i = 0; i < firstWeekday; i += 1) {
    const empty = document.createElement("div");
    empty.className = "empty-day";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const key = localDateKey(date);
    const events = eventsByDate.get(key) || [];

    const button = document.createElement("button");
    button.className = `day-cell ${events.length ? "has-events" : ""}`;
    button.innerHTML = `<strong>${day}</strong>${events[0] ? `<span>${events[0].icon}</span>` : ""}`;
    button.onclick = () => renderCalendarEvents(date, events);
    grid.appendChild(button);
  }
}

function renderCalendarEvents(date, events) {
  const box = document.getElementById("calendar-events");
  if (!box) return;

  if (!events.length) {
    box.innerHTML = `<h4>${date.toLocaleDateString("zh-TW")}</h4><p class="meta">這天沒有提醒事項。</p>`;
    return;
  }

  box.innerHTML = `<h4>${date.toLocaleDateString("zh-TW")}</h4><ul class="item-list">${events.map((event) => `<li>${escapeHtml(event.icon)} ${escapeHtml(event.title)} · ${escapeHtml(event.label)}</li>`).join("")}</ul>`;
}

function field(name, label, value, required = false, type = "text") {
  const normalized = type === "datetime-local" ? toInputDateTime(value) : value;
  return formField({ name, label, value: normalized, required, type });
}

function buildStatusOptions(type, currentStatus) {
  return STATUS_OPTIONS[type].map((status) => `<option value="${status}" ${status === currentStatus ? "selected" : ""}>${escapeHtml(translateStatus(status))}</option>`).join("");
}

function renderAddEdit(item = null) {
  const isEdit = Boolean(item);
  const selectedEmoji = item?.emoji || EMOJI_CHOICES[0];
  let images = Array.isArray(item?.images) ? [...item.images] : [];

  const typeOptions = Object.entries(TYPE_TEXT)
    .map(([value, label]) => `<option value="${value}" ${item?.type === value ? "selected" : ""}>${label}</option>`)
    .join("");

  screens.add.innerHTML = `
    <header class="page-title add-header"><h2>${isEdit ? "編輯商品" : "新增商品"}</h2></header>
    <section class="card emoji-pick"><label>選擇圖示</label><div class="emoji-row">${EMOJI_CHOICES.map((emoji) => `<button type="button" class="emoji-btn ${emoji === selectedEmoji ? "active" : ""}" data-emoji="${emoji}">${emoji}</button>`).join("")}</div></section>

    <form id="item-form" class="stack-form">
      <section class="card form-section">
        <h3>基本資訊</h3>
        ${field("title", "商品名稱", item?.title || "", true)}
        ${field("store", "店家", item?.store || "")}
        <div class="two-col">
          ${formSelect({ name: "type", id: "type", label: "類型", options: typeOptions })}
          ${formSelect({ name: "status", id: "status", label: "狀態", options: "" })}
        </div>
      </section>

      <section class="card form-section">
        <h3>時間與金額</h3>
        ${field("launchDate", "開售時間", item?.launchDate || "", false, "datetime-local")}
        <div class="two-col">
          ${field("depositAmount", "訂金 (NT$)", item?.depositAmount || "", false, "number")}
          ${field("finalAmount", "尾款 (NT$)", item?.finalAmount || "", false, "number")}
        </div>
        ${field("depositDueDate", "訂金截止", item?.depositDueDate || "", false, "datetime-local")}
        ${field("finalDueDate", "尾款截止", item?.finalDueDate || "", false, "datetime-local")}
        ${field("shippingDate", "預計出貨", item?.shippingDate || "", false, "datetime-local")}
      </section>

      <section class="card form-section">
        <h3>商品圖片</h3>
        <div class="field">
          <label>上傳圖片</label>
          <input id="item-images" type="file" accept="image/*" multiple />
          <p class="meta">最多 6 張，單張建議 2MB 內。</p>
        </div>
        <div id="image-preview" class="upload-preview-grid"></div>
      </section>

      <section class="card form-section">
        <h3>其他資訊</h3>
        ${field("url", "商品連結", item?.url || "", false, "url")}
        <div class="field"><label>備註</label><textarea name="notes" rows="4">${escapeHtml(item?.notes || "")}</textarea></div>
      </section>

      <div class="sticky-actions">
        ${actionRow([clayButton("取消", 'type="button" id="cancel-edit"'), `<button class="clay-button primary" type="submit">${isEdit ? "儲存修改" : "新增商品"}</button>`])}
      </div>
    </form>
  `;

  const typeEl = document.getElementById("type");
  const statusEl = document.getElementById("status");

  const syncStatus = () => {
    const type = typeEl.value;
    const current = item?.status && STATUS_OPTIONS[type].includes(item.status) ? item.status : STATUS_OPTIONS[type][0];
    statusEl.innerHTML = buildStatusOptions(type, current);
  };

  syncStatus();
  typeEl.onchange = syncStatus;

  let emoji = selectedEmoji;
  screens.add.querySelectorAll(".emoji-btn").forEach((btn) => {
    btn.onclick = () => {
      emoji = btn.dataset.emoji;
      screens.add.querySelectorAll(".emoji-btn").forEach((node) => node.classList.remove("active"));
      btn.classList.add("active");
    };
  });

  const imageInput = document.getElementById("item-images");
  const imagePreview = document.getElementById("image-preview");

  const bindImageActions = () => {
    imagePreview.querySelectorAll("[data-remove-index]").forEach((btn) => {
      btn.onclick = () => {
        const removeIndex = Number(btn.dataset.removeIndex);
        images = images.filter((_, idx) => idx !== removeIndex);
        renderImagePreview();
      };
    });
  };

  const renderImagePreview = () => {
    if (!images.length) {
      imagePreview.innerHTML = '<p class="meta">尚未上傳圖片</p>';
      return;
    }

    imagePreview.innerHTML = images
      .map(
        (src, index) => `
          <article class="upload-preview-item">
            <img src="${escapeHtml(src)}" alt="預覽圖片 ${index + 1}" loading="lazy" />
            <button type="button" class="clay-button image-remove-btn" data-remove-index="${index}">移除</button>
          </article>
        `
      )
      .join("");

    bindImageActions();
  };

  imageInput.onchange = async (event) => {
    const pickedFiles = Array.from(event.target.files || []);
    if (!pickedFiles.length) return;

    const maxImages = 6;
    const slots = Math.max(0, maxImages - images.length);
    if (slots === 0) {
      alert("最多只能上傳 6 張圖片。");
      imageInput.value = "";
      return;
    }

    const files = pickedFiles.slice(0, slots).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      alert("請選擇圖片檔案。");
      imageInput.value = "";
      return;
    }

    try {
      const newImages = await Promise.all(files.map((file) => readFileAsDataURL(file)));
      images = [...images, ...newImages];
      renderImagePreview();

      if (pickedFiles.length > files.length) {
        alert(`圖片已加入。最多保留 ${maxImages} 張，超出的部分已忽略。`);
      }
    } catch (error) {
      console.error("圖片讀取失敗", error);
      alert("圖片讀取失敗，請換一張再試。");
    } finally {
      imageInput.value = "";
    }
  };

  renderImagePreview();

  document.getElementById("item-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);

    const record = {
      id: item?.id || crypto.randomUUID(),
      title: String(form.get("title") || "").trim(),
      store: String(form.get("store") || "").trim(),
      type: String(form.get("type") || "preorder"),
      status: String(form.get("status") || "upcoming_sale"),
      launchDate: toISO(form.get("launchDate")),
      purchaseDate: item?.purchaseDate || new Date().toISOString(),
      depositAmount: Number(form.get("depositAmount") || 0),
      finalAmount: Number(form.get("finalAmount") || 0),
      depositDueDate: toISO(form.get("depositDueDate")),
      finalDueDate: toISO(form.get("finalDueDate")),
      shippingDate: toISO(form.get("shippingDate")),
      url: String(form.get("url") || "").trim(),
      images,
      notes: String(form.get("notes") || "").trim(),
      createdAt: item?.createdAt || new Date().toISOString(),
      emoji,
    };

    if (!record.title) {
      alert("請填寫商品名稱。");
      return;
    }

    await ItemDB.put(record);
    state.editingId = null;
    await loadAndRender();
    setActiveNav("list");
    switchScreen("list");
  };

  document.getElementById("cancel-edit").onclick = () => {
    state.editingId = null;
    setActiveNav("home");
    switchScreen("home");
  };
}

function openDetail(id) {
  const item = state.items.find((record) => record.id === id);
  if (!item) return;

  const safeUrl = getSafeExternalUrl(item.url);

  detailContent.innerHTML = `
    <div class="detail-head">
      <h3>${escapeHtml(item.emoji || "📦")} ${escapeHtml(item.title)}</h3>
      ${ImageGallery(item.images)}
    </div>
    <p><strong>店家：</strong>${escapeHtml(item.store || "-")}</p>
    <p><strong>類型：</strong>${escapeHtml(translateType(item.type))}</p>
    <p><strong>狀態：</strong><span class="status-tag">${escapeHtml(translateStatus(item.status))}</span></p>

    <h4>時間軸</h4>
    ${Timeline(item)}

    <h4>金額</h4>
    <p>訂金：NT$${Number(item.depositAmount || 0).toLocaleString()} / 尾款：NT$${Number(item.finalAmount || 0).toLocaleString()}</p>

    <h4>連結</h4>
    <p>${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeUrl)}</a>` : "未提供"}</p>

    <h4>提醒時間</h4>
    <p>開售：${escapeHtml(fmtDateTime(item.launchDate))}</p>
    <p>訂金截止：${escapeHtml(fmtDateTime(item.depositDueDate))}</p>
    <p>尾款截止：${escapeHtml(fmtDateTime(item.finalDueDate))}</p>
    <p>出貨：${escapeHtml(fmtDateTime(item.shippingDate))}</p>

    <h4>備註</h4>
    <p class="note-box">${escapeHtml(item.notes || "-")}</p>

    ${actionRow([clayButton("編輯", 'id="edit-item"'), clayButton("刪除", 'id="delete-item"')])}
  `;

  detailContent.querySelector("#edit-item").onclick = () => {
    detailModal.close();
    state.editingId = id;
    setActiveNav("add");
    switchScreen("add");
  };

  detailContent.querySelector("#delete-item").onclick = async () => {
    detailModal.close();
    await deleteItem(id);
  };

  detailModal.showModal();
}

async function deleteItem(id) {
  if (!confirm("確定要刪除此商品嗎？此動作無法復原。")) return;
  await ItemDB.delete(id);
  if (state.editingId === id) state.editingId = null;
  await loadAndRender();
}

async function loadAndRender() {
  state.items = await ItemDB.getAll();
  state.items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  renderDashboard();
  renderList();
  renderCalendar();
  renderExpense();
  if (!state.editingId) renderAddEdit();
  if (state.reminder.enabled) {
    syncPaymentReminders().catch((error) => {
      console.error("同步提醒失敗", error);
      updateReminderMessage("提醒同步失敗，稍後會再嘗試。");
      if (screens.home.classList.contains("active")) renderDashboard();
    });
  }
}

function bindInstallEvents() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (screens.home.classList.contains("active")) renderDashboard();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (screens.home.classList.contains("active")) renderDashboard();
  });
}

async function promptInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (screens.home.classList.contains("active")) renderDashboard();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isSecureContext = window.location.protocol === "https:" || isLocalhost;
  if (!isSecureContext) {
    console.info("Service Worker 需要 https 或 localhost 環境。");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js");
    registration.update().catch(() => undefined);
    return registration;
  } catch (error) {
    console.error("Service Worker 註冊失敗", error);
    return null;
  }
}

async function initReminderState() {
  if (!state.reminder.configured) {
    state.reminder.supported = false;
    updateReminderMessage("尚未設定 Firebase 推播參數（firebase-config.js）。");
    return;
  }

  const setup = await setupFirebaseMessaging(FIREBASE_WEB_CONFIG, appServiceWorkerRegistration);
  state.reminder.supported = setup.supported;
  state.reminder.permission = getNotificationPermission();

  if (!state.reminder.supported) {
    updateReminderMessage("此裝置或瀏覽器不支援 Web Push。");
    return;
  }

  if (state.reminder.permission === "denied") {
    updateReminderMessage("通知權限已被封鎖，請到瀏覽器設定重新開啟。");
    return;
  }

  if (state.reminder.permission !== "granted") {
    updateReminderMessage("尚未授權通知，請點「啟用付款提醒」。");
    return;
  }

  try {
    const token = await setup.fetchToken();
    if (!token) {
      updateReminderMessage("通知已授權，但尚未取得 Token。");
      return;
    }
    state.reminder.token = token;
    state.reminder.enabled = true;
    await registerDeviceWithCloud(token);
    updateReminderMessage("付款提醒已啟用，裝置已完成註冊。");
  } catch (error) {
    console.error("恢復付款提醒狀態失敗", error);
    updateReminderMessage("提醒初始化失敗，請重新啟用一次。");
  }
}

function handleNotificationEntry() {
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get("itemId");
  if (!itemId) return;

  const target = state.items.find((item) => item.id === itemId);
  if (!target) return;

  setActiveNav("list");
  switchScreen("list");
  openDetail(itemId);

  params.delete("itemId");
  params.delete("from");
  const query = params.toString();
  const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, "", newUrl);
}

async function init() {
  await ensureSeed();
  mountNav();
  bindInstallEvents();
  appServiceWorkerRegistration = await registerServiceWorker();
  await initReminderState();
  await loadAndRender();
  handleNotificationEntry();
}

init().catch((error) => {
  console.error("初始化失敗", error);
  alert("初始化失敗，請重新整理後再試一次。");
});
