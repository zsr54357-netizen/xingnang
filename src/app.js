/* =========================================================
   行囊 · 出差清点
   Local-first packing checklist for mobile
   ========================================================= */
(() => {
  'use strict';

  const APP_TITLE = '行囊 · 出差清点';
  const STORAGE_KEY = 'xingnang.packing.v1';
  const VERSION = '1.5.0';
  const MAX_PACKAGES = 40;
  const MAX_ITEMS_PER_PACKAGE = 250;
  const MAX_TOTAL_ITEMS = 600;
  const MAX_TODO_LISTS = 40;
  const MAX_TODOS_PER_LIST = 300;
  const MAX_TOTAL_TODOS = 1000;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const CATEGORIES = [
    { key: 'id', label: '证件', icon: 'id-card' },
    { key: 'tech', label: '电子', icon: 'zap' },
    { key: 'clothes', label: '衣物', icon: 'shirt' },
    { key: 'wash', label: '洗护', icon: 'droplet' },
    { key: 'meds', label: '药品', icon: 'pill' },
    { key: 'docs', label: '文件', icon: 'file-text' },
    { key: 'travel', label: '出行', icon: 'umbrella' },
    { key: 'other', label: '其他', icon: 'box' }
  ];
  const CATEGORY_MAP = new Map(CATEGORIES.map((cat) => [cat.key, cat]));

  const PACKAGE_ICONS = [
    { key: 'luggage', label: '行李箱' },
    { key: 'backpack', label: '背包' },
    { key: 'briefcase', label: '手提包' },
    { key: 'tote', label: '托特包' },
    { key: 'camera-bag', label: '相机包' }
  ];
  const PACKAGE_ICON_KEYS = new Set(PACKAGE_ICONS.map((item) => item.key));

  const PACKAGE_COLORS = [
    { key: 'orange', label: '暖橙' },
    { key: 'blue', label: '群青' },
    { key: 'green', label: '青竹' },
    { key: 'violet', label: '暮紫' },
    { key: 'rose', label: '山茶' },
    { key: 'teal', label: '湖蓝' },
    { key: 'slate', label: '石墨' }
  ];
  const PACKAGE_COLOR_KEYS = new Set(PACKAGE_COLORS.map((color) => color.key));

  const DEFAULT_SUGGESTIONS = [
    '身份证', '充电器', '充电宝', '数据线', '折叠伞', '常用药', '洗漱包', '换洗衣物'
  ];
  const TODO_SUGGESTIONS = [
    '确认时间', '整理资料', '联系对方', '采购用品'
  ];

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkModeMedia = window.matchMedia('(prefers-color-scheme: dark)');

  const categoryKeywords = {
    id: [
      '身份证', '护照', '签证', '驾照', '驾驶证', '证件', '通行证', '银行卡', '信用卡',
      '社保卡', '门禁', '钥匙', '工牌', '员工证', '户口本', '证件照', '身份证件'
    ],
    tech: [
      '充电', '数据线', '电脑', '手机', '平板', '耳机', '鼠标', '键盘', '相机', '电池',
      '充电宝', '转接', '电源', '手表', 'kindle', 'u盘', '硬盘', '插排', '插头', '读卡器',
      '麦克风', '投影', '遥控', '自拍杆', 'vlog'
    ],
    clothes: [
      '衣', '裤', '袜', '鞋', '外套', '衬衫', '睡衣', '内衣', '围巾', '帽', '裙', '羽绒',
      '泳衣', '皮带', '领带', '风衣', '夹克'
    ],
    wash: [
      '牙', '洗', '沐', '巾', '护肤', '剃须', '化妆', '防晒', '牙线', '棉签', '梳', '面膜',
      '湿巾', '洁面', '卸妆', '护手霜', '香水', '指甲刀'
    ],
    meds: [
      '药', '创可贴', '体温计', '口罩', '晕车', '肠胃', '感冒', '消炎', '退烧', '棉片',
      '眼药水', '藿香'
    ],
    docs: [
      '文件', '合同', '资料', '笔', '本子', '名片', '发票', '报表', '书', '笔记本', '便签',
      '印章', '证件袋'
    ],
    travel: [
      '雨伞', '雨衣', '水杯', '保温杯', '眼罩', '颈枕', '行李', '登机', '收纳', '折叠伞',
      '伞', '墨镜', '耳塞', '旅行', '锁', '行李牌'
    ]
  };

  let state;
  let layers = [];
  let currentSheetRef = null;
  let detailFilter = 'all';
  let searchQuery = '';
  let expenseTab = 'overview';
  let expenseMonth = null;
  let pendingImport = null;
  let installPrompt = null;
  let welcomeOpen = false;
  let toastHideTimer = null;
  let toastActionHandler = null;
  let storageAvailable = true;
  let historyEnabled = true;
  let historyDepth = 0;
  let navigationLockedUntil = 0;
  let bootNotice = '';
  let detailHighlightTimer = 0;

  /* ---------------- Helpers ---------------- */

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function icon(name, className = '') {
    const safeName = String(name || 'box').replace(/[^a-z0-9-]/g, '');
    const cls = className ? ` class="${className}"` : '';
    return `<svg${cls} aria-hidden="true" focusable="false"><use href="#i-${safeName}"></use></svg>`;
  }

  function iconMarkup(name, className = '', label = '') {
    const safeName = String(name || 'box').replace(/[^a-z0-9-]/g, '');
    const cls = className ? ` class="${className}"` : '';
    const aria = label ? ` role="img" aria-label="${escapeHTML(label)}"` : ' aria-hidden="true"';
    return `<svg${cls}${aria} focusable="false"><use href="#i-${safeName}"></use></svg>`;
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}_${window.crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    }
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  }

  function clampInt(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function cleanText(value, maxLength = 80) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function normalizeName(value, maxLength) {
    return cleanText(value, maxLength);
  }

  function formatQty(qty) {
    return qty > 1 ? `×${qty}` : '';
  }

  function haptic(pattern = 10) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (_) { /* ignore */ }
    }
  }

  function announce(message) {
    const el = $('#srStatus');
    if (!el) return;
    el.textContent = '';
    window.setTimeout(() => { el.textContent = message; }, 30);
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(date);
    } catch (_) {
      return date.toLocaleString();
    }
  }

  function fileDateStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const ISO_MONTH_RE = /^\d{4}-\d{2}$/;

  function isValidISODate(value) {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
    const date = parseISODate(value);
    if (!date) return false;
    return toISODate(date) === value;
  }

  function parseISODate(value) {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function toISODate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDaysISO(isoDate, count) {
    const date = parseISODate(isoDate);
    if (!date) return isoDate;
    date.setDate(date.getDate() + count);
    return toISODate(date);
  }

  function daysInclusive(startISO, endISO) {
    const start = parseISODate(startISO);
    const end = parseISODate(endISO);
    if (!start || !end || end < start) return 0;
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  function monthOfISO(isoDate) {
    return typeof isoDate === 'string' ? isoDate.slice(0, 7) : '';
  }

  function currentMonthISO() {
    return currentMonthFromDate(new Date());
  }

  function currentMonthFromDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function isValidISOMonth(value) {
    if (typeof value !== 'string' || !ISO_MONTH_RE.test(value)) return false;
    const parts = value.split('-').map(Number);
    return parts[1] >= 1 && parts[1] <= 12;
  }

  function shiftMonthISO(month, delta) {
    if (!isValidISOMonth(month)) return currentMonthISO();
    const [year, monthNumber] = month.split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + delta, 1, 12);
    return currentMonthFromDate(date);
  }

  function monthOrdinal(month) {
    if (!isValidISOMonth(month)) return 0;
    const [year, monthNumber] = month.split('-').map(Number);
    return year * 12 + monthNumber;
  }

  function formatExpenseDate(isoDate, includeYear = false) {
    const date = parseISODate(isoDate);
    if (!date) return isoDate || '';
    return includeYear
      ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
      : `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatExpenseWeekday(isoDate) {
    const date = parseISODate(isoDate);
    if (!date) return '';
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  }

  function formatExpenseRange(startISO, endISO) {
    const start = parseISODate(startISO);
    const end = parseISODate(endISO);
    if (!start) return '';
    if (!end || startISO === endISO) return formatExpenseDate(startISO, true);
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.getFullYear()}年${formatExpenseDate(startISO)} - ${formatExpenseDate(endISO)}`;
    }
    return `${formatExpenseDate(startISO, true)} - ${formatExpenseDate(endISO, true)}`;
  }

  function formatExpenseMonthLabel(month) {
    if (!isValidISOMonth(month)) return month || '';
    const [year, monthNumber] = month.split('-').map(Number);
    return `${year}年${monthNumber}月`;
  }

  function formatInputNumber(value) {
    if (!Number.isFinite(Number(value))) return '';
    return String(Number(value));
  }

  const moneyFormatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function formatMoneyCNY(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `¥ ${moneyFormatter.format(amount)}`;
  }

  function formatPlainAmount(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return moneyFormatter.format(amount);
  }

  function parseAmountInput(value) {
    if (typeof value === 'number') return value;
    const parsed = Number.parseFloat(String(value == null ? '' : value).replace(/[,，\s¥￥$]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function markMatch(text, query) {
    const source = String(text || '');
    const q = String(query || '').trim();
    if (!q) return escapeHTML(source);
    const lowerSource = source.toLocaleLowerCase();
    const lowerQuery = q.toLocaleLowerCase();
    const index = lowerSource.indexOf(lowerQuery);
    if (index < 0) return escapeHTML(source);
    return `${escapeHTML(source.slice(0, index))}<mark>${escapeHTML(source.slice(index, index + q.length))}</mark>${escapeHTML(source.slice(index + q.length))}`;
  }

  function inferCategory(name) {
    const text = String(name || '').toLocaleLowerCase();
    if (!text) return 'other';
    for (const [category, words] of Object.entries(categoryKeywords)) {
      if (words.some((word) => text.includes(word.toLocaleLowerCase()))) return category;
    }
    return 'other';
  }

  function catInfo(key) {
    return CATEGORY_MAP.get(key) || CATEGORY_MAP.get('other');
  }

  function pkgTone(pkg) {
    return PACKAGE_COLOR_KEYS.has(pkg && pkg.color) ? pkg.color : 'orange';
  }

  function pkgIconKey(pkg) {
    return PACKAGE_ICON_KEYS.has(pkg && pkg.icon) ? pkg.icon : 'luggage';
  }

  function getPackageById(id) {
    return state.packages.find((pkg) => pkg.id === id) || null;
  }

  function getItem(packageId, itemId) {
    const pkg = getPackageById(packageId);
    if (!pkg) return { pkg: null, item: null };
    return { pkg, item: pkg.items.find((item) => item.id === itemId) || null };
  }

  function getPackageStats(pkg) {
    let total = 0;
    let done = 0;
    let fixed = 0;
    let fixedDone = 0;
    for (const item of pkg.items) {
      total += 1;
      if (item.checked) done += 1;
      if (item.fixed) {
        fixed += 1;
        if (item.checked) fixedDone += 1;
      }
    }
    return { total, done, remaining: total - done, fixed, fixedDone, fixedRemaining: fixed - fixedDone };
  }

  function getGlobalStats() {
    let total = 0;
    let done = 0;
    let fixed = 0;
    let fixedDone = 0;
    for (const pkg of state.packages) {
      const stats = getPackageStats(pkg);
      total += stats.total;
      done += stats.done;
      fixed += stats.fixed;
      fixedDone += stats.fixedDone;
    }
    return {
      total,
      done,
      remaining: total - done,
      fixed,
      fixedDone,
      fixedRemaining: fixed - fixedDone,
      percent: total ? Math.round((done / total) * 100) : 0,
      packageCount: state.packages.length
    };
  }

  function getFixedEntries() {
    const entries = [];
    for (const pkg of state.packages) {
      for (const item of pkg.items) {
        if (item.fixed) entries.push({ pkg, item });
      }
    }
    return entries;
  }

  function getTodoListById(id) {
    return state.todoLists.find((list) => list.id === id) || null;
  }

  function findTodoEntry(id) {
    for (const list of state.todoLists) {
      const index = list.items.findIndex((todo) => todo.id === id);
      if (index >= 0) return { list, todo: list.items[index], index };
    }
    return null;
  }

  function getTodoById(id) {
    const entry = findTodoEntry(id);
    return entry ? entry.todo : null;
  }

  function getTodoListStats(list) {
    if (!list) return { total: 0, done: 0, remaining: 0, percent: 0 };
    const total = list.items.length;
    const done = list.items.filter((todo) => todo.checked).length;
    return {
      total,
      done,
      remaining: total - done,
      percent: total ? Math.round((done / total) * 100) : 0
    };
  }

  function getTodoStats() {
    let total = 0;
    let done = 0;
    for (const list of state.todoLists) {
      for (const todo of list.items) {
        total += 1;
        if (todo.checked) done += 1;
      }
    }
    return {
      total,
      done,
      remaining: total - done,
      percent: total ? Math.round((done / total) * 100) : 0,
      listCount: state.todoLists.length
    };
  }

  function getExpenseActiveTrip() {
    if (!state.expense || !state.expense.activeTripId) return null;
    return state.expense.trips.find((trip) => trip.id === state.expense.activeTripId && trip.status === 'active') || null;
  }

  function getLatestFinishedExpenseTrip() {
    if (!state.expense) return null;
    return state.expense.trips
      .filter((trip) => trip.status === 'finished')
      .sort((a, b) => {
        const dateCompare = String(b.endDate || '').localeCompare(String(a.endDate || ''));
        return dateCompare || (b.createdAt || 0) - (a.createdAt || 0);
      })[0] || null;
  }

  function getDisplayedExpenseTrip() {
    return getExpenseActiveTrip() || getLatestFinishedExpenseTrip();
  }

  function getExpenseTripById(id) {
    return state.expense.trips.find((trip) => trip.id === id) || null;
  }

  function getExpenseTripExpenses(tripId) {
    return state.expense.expenses
      .filter((expense) => expense.tripId === tripId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  }

  function resolveExpenseRate(month) {
    const rates = state.expense ? state.expense.rates : {};
    const months = Object.keys(rates).filter((key) => isValidISOMonth(key)).sort();
    if (!months.length) {
      return { rate: 0, sourceMonth: null, hasRate: false, exact: false };
    }
    if (Object.prototype.hasOwnProperty.call(rates, month)) {
      return { rate: Number(rates[month]), sourceMonth: month, hasRate: true, exact: true };
    }
    const target = monthOrdinal(month);
    let best = months[0];
    let bestDiff = Infinity;
    for (const candidate of months) {
      const diff = Math.abs(monthOrdinal(candidate) - target);
      if (diff < bestDiff) {
        best = candidate;
        bestDiff = diff;
      }
    }
    return { rate: Number(rates[best]), sourceMonth: best, hasRate: true, exact: false };
  }

  function computeExpenseSummary(trip) {
    if (!trip) return null;
    const endDate = trip.endDate || todayISO();
    const totalDays = daysInclusive(trip.startDate, endDate);
    const currentMonthRate = resolveExpenseRate(currentMonthISO());
    const daily = [];
    let foreignDays = 0;
    let domesticDays = 0;
    let allowanceCny = 0;

    if (totalDays > 0) {
      for (let index = 0; index < totalDays; index += 1) {
        const date = addDaysISO(trip.startDate, index);
        const isForeign = trip.dayNatures[date] !== 'domestic';
        const month = monthOfISO(date);
        const rateInfo = resolveExpenseRate(month);
        const hasOverride = Object.prototype.hasOwnProperty.call(trip.dayAllowances, date);
        const originalAmount = isForeign
          ? (hasOverride ? trip.dayAllowances[date] : state.expense.allowances.foreign)
          : state.expense.allowances.domestic;
        const cny = isForeign ? originalAmount * rateInfo.rate : originalAmount;
        if (isForeign) foreignDays += 1;
        else domesticDays += 1;
        allowanceCny += cny;
        daily.push({
          date,
          isForeign,
          originalAmount,
          cny,
          rate: rateInfo.rate,
          rateMonth: rateInfo.sourceMonth,
          exactRate: rateInfo.exact,
          hasOverride
        });
      }
    }

    const expenseItems = getExpenseTripExpenses(trip.id).map((expense) => {
      const rateInfo = resolveExpenseRate(monthOfISO(expense.date));
      const cny = expense.currency === 'USD' ? expense.amount * rateInfo.rate : expense.amount;
      return {
        ...expense,
        cny,
        rate: rateInfo.rate,
        rateMonth: rateInfo.sourceMonth
      };
    });
    const expenseCny = expenseItems.reduce((total, expense) => total + expense.cny, 0);
    return {
      trip,
      endDate,
      currentMonthRate,
      hasRate: Object.keys(state.expense.rates).length > 0,
      totalDays,
      foreignDays,
      domesticDays,
      allowanceCny,
      expenseCny,
      totalCny: allowanceCny + expenseCny,
      daily,
      expenseItems
    };
  }

  function updateExpenseButton() {
    const button = $('#expenseBtn');
    const dot = $('#expenseActiveDot');
    if (!button || !dot || !state) return;
    const active = getExpenseActiveTrip();
    dot.hidden = !active;
    button.setAttribute('aria-label', active ? '出差费用，出差进行中' : '出差费用');
  }

  function getPendingCount(pkg) {
    return pkg.items.filter((item) => !item.checked).length;
  }

  function snapshotChecks() {
    const snapshot = new Map();
    for (const pkg of state.packages) {
      for (const item of pkg.items) snapshot.set(`${pkg.id}|${item.id}`, item.checked);
    }
    return snapshot;
  }

  function restoreChecks(snapshot) {
    for (const pkg of state.packages) {
      for (const item of pkg.items) {
        if (snapshot.has(`${pkg.id}|${item.id}`)) {
          item.checked = snapshot.get(`${pkg.id}|${item.id}`);
        }
      }
    }
  }

  function resetChecks({ autoCheckFixed = false } = {}) {
    for (const pkg of state.packages) {
      for (const item of pkg.items) {
        item.checked = autoCheckFixed ? Boolean(item.fixed) : false;
      }
    }
  }

  function allItems() {
    const list = [];
    for (const pkg of state.packages) {
      for (const item of pkg.items) list.push({ pkg, item });
    }
    return list;
  }

  /* ---------------- Seed / normalization / storage ---------------- */

  function defaultSettings(overrides = {}) {
    return Object.assign({
      theme: 'auto',
      autoCheckFixedOnNewTrip: false,
      onboarded: false,
      lastBackupAt: null
    }, overrides);
  }

  function defaultExpenseState() {
    return {
      trips: [],
      activeTripId: null,
      rates: {},
      allowances: { foreign: 65, domestic: 100 },
      expenses: []
    };
  }

  function createSeedState() {
    const now = Date.now();
    let order = 0;
    const makeItem = (name, category, qty, fixed, note = '') => {
      order += 1;
      return {
        id: makeId('item'),
        name,
        cat: category,
        qty,
        fixed,
        checked: false,
        note,
        createdAt: now + order
      };
    };
    const luggage = {
      id: makeId('pkg'),
      name: '行李箱',
      icon: 'luggage',
      color: 'orange',
      createdAt: now + 1,
      items: [
        makeItem('换洗衣物', 'clothes', 3, false, '按出差天数准备'),
        makeItem('洗漱包', 'wash', 1, true, '旅行装，回程再补'),
        makeItem('睡衣', 'clothes', 1, false),
        makeItem('常用药', 'meds', 1, true, '感冒药、肠胃药'),
        makeItem('折叠伞', 'travel', 1, false),
        makeItem('运动鞋', 'clothes', 1, false)
      ]
    };
    const backpack = {
      id: makeId('pkg'),
      name: '随身背包',
      icon: 'backpack',
      color: 'blue',
      createdAt: now + 2,
      items: [
        makeItem('身份证', 'id', 1, true, '放在内袋'),
        makeItem('手机', 'tech', 1, true),
        makeItem('充电宝', 'tech', 1, true),
        makeItem('数据线', 'tech', 2, true),
        makeItem('纸巾', 'other', 1, false),
        makeItem('保温杯', 'travel', 1, false)
      ]
    };
    const laptopBag = {
      id: makeId('pkg'),
      name: '电脑包',
      icon: 'briefcase',
      color: 'green',
      createdAt: now + 3,
      items: [
        makeItem('笔记本电脑', 'tech', 1, true, '关机前确认已保存'),
        makeItem('电脑充电器', 'tech', 1, true),
        makeItem('鼠标', 'tech', 1, false),
        makeItem('工牌', 'id', 1, true),
        makeItem('转接头', 'tech', 1, true, 'HDMI / Type-C'),
        makeItem('笔记本和笔', 'docs', 1, false)
      ]
    };
    const makeTodo = (title, note, offset) => ({
      id: makeId('todo'),
      title,
      note,
      checked: false,
      createdAt: now + offset
    });
    const todoList = {
      id: makeId('tolist'),
      name: '行前待办',
      createdAt: now + 29,
      items: [
        makeTodo('确认酒店和往返车票', '出发前再核对一次', 30),
        makeTodo('在线值机', '航班起飞前一天', 31)
      ]
    };
    return {
      version: 1,
      packages: [luggage, backpack, laptopBag],
      todoLists: [todoList],
      expense: defaultExpenseState(),
      settings: defaultSettings()
    };
  }

  function normalizeState(raw, { forImport = false } = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('INVALID_OBJECT');
    }
    const source = raw.state && typeof raw.state === 'object' && !Array.isArray(raw.state) ? raw.state : raw;
    if (!source || !Array.isArray(source.packages)) throw new Error('MISSING_PACKAGES');

    const usedPackageIds = new Set();
    const usedItemIds = new Set();
    const usedTodoListIds = new Set();
    const usedTodoIds = new Set();
    let totalItems = 0;
    let totalTodos = 0;

    const uniqueId = (prefix, candidate, used) => {
      if (typeof candidate === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(candidate) && !used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
      let next = makeId(prefix);
      while (used.has(next)) next = makeId(prefix);
      used.add(next);
      return next;
    };

    const packages = [];
    source.packages.slice(0, MAX_PACKAGES).forEach((rawPkg, packageIndex) => {
      if (!rawPkg || typeof rawPkg !== 'object' || Array.isArray(rawPkg)) return;
      const pkg = {
        id: uniqueId('pkg', rawPkg.id, usedPackageIds),
        name: normalizeName(rawPkg.name, 24) || `未命名包裹 ${packageIndex + 1}`,
        icon: PACKAGE_ICON_KEYS.has(rawPkg.icon) ? rawPkg.icon : PACKAGE_ICONS[packageIndex % PACKAGE_ICONS.length].key,
        color: PACKAGE_COLOR_KEYS.has(rawPkg.color) ? rawPkg.color : PACKAGE_COLORS[packageIndex % PACKAGE_COLORS.length].key,
        items: [],
        createdAt: Number.isFinite(Number(rawPkg.createdAt)) ? Number(rawPkg.createdAt) : Date.now() + packageIndex
      };
      if (Array.isArray(rawPkg.items)) {
        rawPkg.items.slice(0, MAX_ITEMS_PER_PACKAGE).forEach((rawItem) => {
          if (totalItems >= MAX_TOTAL_ITEMS) return;
          if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) return;
          const name = normalizeName(rawItem.name, 40);
          if (!name) return;
          const cat = CATEGORY_MAP.has(rawItem.cat) ? rawItem.cat : inferCategory(name);
          pkg.items.push({
            id: uniqueId('item', rawItem.id, usedItemIds),
            name,
            cat,
            qty: clampInt(rawItem.qty, 1, 999, 1),
            fixed: rawItem.fixed === true,
            checked: rawItem.checked === true,
            note: normalizeName(rawItem.note, 80),
            createdAt: Number.isFinite(Number(rawItem.createdAt)) ? Number(rawItem.createdAt) : Date.now() + totalItems
          });
          totalItems += 1;
        });
      }
      packages.push(pkg);
    });

    const rawSettings = source.settings && typeof source.settings === 'object' && !Array.isArray(source.settings)
      ? source.settings
      : {};
    const theme = ['auto', 'light', 'dark'].includes(rawSettings.theme) ? rawSettings.theme : 'auto';
    let lastBackupAt = null;
    if (typeof rawSettings.lastBackupAt === 'string' && !Number.isNaN(new Date(rawSettings.lastBackupAt).getTime())) {
      lastBackupAt = rawSettings.lastBackupAt;
    }

    const parseTodoItems = (rawItems) => {
      const items = [];
      if (!Array.isArray(rawItems)) return items;
      rawItems.slice(0, MAX_TODOS_PER_LIST).forEach((rawTodo) => {
        if (totalTodos >= MAX_TOTAL_TODOS) return;
        if (!rawTodo || typeof rawTodo !== 'object' || Array.isArray(rawTodo)) return;
        const title = normalizeName(rawTodo.title, 60);
        if (!title) return;
        items.push({
          id: uniqueId('todo', rawTodo.id, usedTodoIds),
          title,
          note: normalizeName(rawTodo.note, 120),
          checked: rawTodo.checked === true,
          createdAt: Number.isFinite(Number(rawTodo.createdAt)) ? Number(rawTodo.createdAt) : Date.now() + totalTodos
        });
        totalTodos += 1;
      });
      return items;
    };

    const todoLists = [];
    if (Array.isArray(source.todoLists)) {
      source.todoLists.slice(0, MAX_TODO_LISTS).forEach((rawList, listIndex) => {
        if (!rawList || typeof rawList !== 'object' || Array.isArray(rawList)) return;
        todoLists.push({
          id: uniqueId('tolist', rawList.id, usedTodoListIds),
          name: normalizeName(rawList.name, 30) || `未命名清单 ${listIndex + 1}`,
          createdAt: Number.isFinite(Number(rawList.createdAt)) ? Number(rawList.createdAt) : Date.now() + listIndex,
          items: parseTodoItems(rawList.items)
        });
      });
    } else if (Array.isArray(source.todos)) {
      const items = parseTodoItems(source.todos);
      const createdAt = items.reduce((earliest, item) => Math.min(earliest, item.createdAt), Date.now());
      todoLists.push({
        id: uniqueId('tolist', null, usedTodoListIds),
        name: items.length ? '行前待办' : '我的待办',
        createdAt,
        items
      });
    }

    const rawExpense = source.expense && typeof source.expense === 'object' && !Array.isArray(source.expense)
      ? source.expense
      : {};
    const usedTripIds = new Set();
    const usedExpenseIds = new Set();
    const expense = defaultExpenseState();
    if (rawExpense.allowances && typeof rawExpense.allowances === 'object') {
      if (Number.isFinite(Number(rawExpense.allowances.foreign)) && Number(rawExpense.allowances.foreign) > 0) {
        expense.allowances.foreign = Number(rawExpense.allowances.foreign);
      }
      if (Number.isFinite(Number(rawExpense.allowances.domestic)) && Number(rawExpense.allowances.domestic) > 0) {
        expense.allowances.domestic = Number(rawExpense.allowances.domestic);
      }
    }
    if (rawExpense.rates && typeof rawExpense.rates === 'object' && !Array.isArray(rawExpense.rates)) {
      Object.entries(rawExpense.rates).slice(0, 240).forEach(([month, value]) => {
        const rate = Number(value);
        if (isValidISOMonth(month) && Number.isFinite(rate) && rate > 0) {
          expense.rates[month] = rate;
        }
      });
    }

    const parsedTrips = [];
    if (Array.isArray(rawExpense.trips)) {
      rawExpense.trips.slice(0, 100).forEach((rawTrip) => {
        if (!rawTrip || typeof rawTrip !== 'object' || Array.isArray(rawTrip)) return;
        if (!isValidISODate(rawTrip.startDate)) return;
        const startDate = rawTrip.startDate;
        let endDate = isValidISODate(rawTrip.endDate) && rawTrip.endDate >= startDate ? rawTrip.endDate : null;
        let status = rawTrip.status === 'active' && !endDate ? 'active' : 'finished';
        if (status === 'finished' && !endDate) endDate = startDate;
        const dayNatures = {};
        if (rawTrip.dayNatures && typeof rawTrip.dayNatures === 'object' && !Array.isArray(rawTrip.dayNatures)) {
          Object.entries(rawTrip.dayNatures).slice(0, 370).forEach(([date, nature]) => {
            if (isValidISODate(date) && nature === 'domestic') dayNatures[date] = 'domestic';
          });
        }
        const dayAllowances = {};
        if (rawTrip.dayAllowances && typeof rawTrip.dayAllowances === 'object' && !Array.isArray(rawTrip.dayAllowances)) {
          Object.entries(rawTrip.dayAllowances).slice(0, 370).forEach(([date, amount]) => {
            const parsed = Number(amount);
            if (isValidISODate(date) && Number.isFinite(parsed) && parsed > 0) dayAllowances[date] = parsed;
          });
        }
        parsedTrips.push({
          id: uniqueId('xtrip', rawTrip.id, usedTripIds),
          startDate,
          endDate,
          status,
          createdAt: Number.isFinite(Number(rawTrip.createdAt)) ? Number(rawTrip.createdAt) : Date.now(),
          dayNatures,
          dayAllowances
        });
      });
    }
    const activeIds = parsedTrips.filter((trip) => trip.status === 'active').map((trip) => trip.id);
    const requestedActiveId = typeof rawExpense.activeTripId === 'string' ? rawExpense.activeTripId : '';
    const activeTripId = activeIds.includes(requestedActiveId) ? requestedActiveId : (activeIds[0] || null);
    for (const trip of parsedTrips) {
      if (trip.status === 'active' && trip.id !== activeTripId) {
        trip.status = 'finished';
        trip.endDate = trip.endDate || trip.startDate;
      }
    }
    expense.trips = parsedTrips;
    expense.activeTripId = activeTripId;

    const validTripIds = new Set(parsedTrips.map((trip) => trip.id));
    if (Array.isArray(rawExpense.expenses)) {
      rawExpense.expenses.slice(0, 1000).forEach((rawExp) => {
        if (!rawExp || typeof rawExp !== 'object' || Array.isArray(rawExp)) return;
        if (!validTripIds.has(rawExp.tripId)) return;
        const amount = Number(rawExp.amount);
        if (!Number.isFinite(amount) || amount <= 0) return;
        if (!isValidISODate(rawExp.date)) return;
        const currency = rawExp.currency === 'CNY' ? 'CNY' : rawExp.currency === 'USD' ? 'USD' : null;
        if (!currency) return;
        expense.expenses.push({
          id: uniqueId('xexp', rawExp.id, usedExpenseIds),
          tripId: rawExp.tripId,
          amount,
          currency,
          note: normalizeName(rawExp.note, 100),
          date: rawExp.date,
          createdAt: Number.isFinite(Number(rawExp.createdAt)) ? Number(rawExp.createdAt) : Date.now()
        });
      });
    }

    return {
      version: 1,
      packages,
      todoLists,
      expense,
      settings: defaultSettings({
        theme,
        autoCheckFixedOnNewTrip: rawSettings.autoCheckFixedOnNewTrip === true,
        onboarded: forImport ? true : rawSettings.onboarded !== false,
        lastBackupAt
      })
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
      syncAndroidWidget();
      return true;
    } catch (error) {
      storageAvailable = false;
      console.warn('无法写入本地存储', error);
      syncAndroidWidget();
      return false;
    }
  }

  function buildWidgetSummary() {
    const activeTrip = getExpenseActiveTrip();
    const summary = activeTrip ? computeExpenseSummary(activeTrip) : null;
    const pack = getGlobalStats();
    const todo = getTodoStats();
    return {
      updatedAt: new Date().toISOString(),
      tripActive: Boolean(activeTrip),
      tripDays: summary ? summary.totalDays : 0,
      tripRange: activeTrip ? `${formatExpenseDate(activeTrip.startDate, true)} 至今` : '',
      totalCny: summary ? Math.round(summary.totalCny * 100) / 100 : 0,
      allowanceCny: summary ? Math.round(summary.allowanceCny * 100) / 100 : 0,
      expenseCny: summary ? Math.round(summary.expenseCny * 100) / 100 : 0,
      packTotal: pack.total,
      packDone: pack.done,
      packRemaining: pack.remaining,
      packPercent: pack.percent,
      todoTotal: todo.total,
      todoDone: todo.done,
      todoRemaining: todo.remaining,
      todoListCount: todo.listCount
    };
  }

  function syncAndroidWidget() {
    if (!window.AndroidBridge || typeof window.AndroidBridge.updateWidgetData !== 'function') return;
    try {
      window.AndroidBridge.updateWidgetData(JSON.stringify(buildWidgetSummary()));
    } catch (error) {
      console.warn('无法同步桌面小部件数据', error);
    }
  }

  function loadState() {
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
      console.warn('无法读取本地存储', error);
      return createSeedState();
    }
    if (!stored) {
      const seeded = createSeedState();
      state = seeded;
      saveState();
      return seeded;
    }
    try {
      return normalizeState(JSON.parse(stored), { forImport: false });
    } catch (error) {
      console.warn('本地数据读取失败，已恢复示例清单', error);
      bootNotice = '本地数据读取失败，已载入示例清单';
      const seeded = createSeedState();
      seeded.settings.onboarded = true;
      state = seeded;
      saveState();
      return seeded;
    }
  }

  /* ---------------- Theme ---------------- */

  function resolvedTheme() {
    if (!state) return 'light';
    if (state.settings.theme === 'auto') return darkModeMedia.matches ? 'dark' : 'light';
    return state.settings.theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme() {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
    const meta = $('#themeColor');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#100F0D' : '#F6F2EB');
    notifyAndroidTheme(theme);
    renderThemeSegment();
  }

  function notifyAndroidTheme(theme) {
    if (window.AndroidBridge && typeof window.AndroidBridge.setTheme === 'function') {
      try {
        window.AndroidBridge.setTheme(theme);
      } catch (error) {
        console.warn('无法同步 Android 系统栏主题', error);
      }
    }
  }

  function renderThemeSegment() {
    if (!state) return;
    $$('.theme-segment button').forEach((button) => {
      const active = button.dataset.themeValue === state.settings.theme;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function setTheme(theme) {
    if (!['auto', 'light', 'dark'].includes(theme)) return;
    state.settings.theme = theme;
    saveState();
    applyTheme();
    renderSettings();
    const labels = { auto: '跟随系统', light: '浅色', dark: '深色' };
    announce(`主题已切换为${labels[theme]}`);
  }

  /* ---------------- Toast / celebration ---------------- */

  function hideToast(immediate = false) {
    const toast = $('#toast');
    if (!toast) return;
    window.clearTimeout(toastHideTimer);
    toast.classList.remove('is-visible');
    toastActionHandler = null;
    if (immediate) {
      toast.hidden = true;
      return;
    }
    toastHideTimer = window.setTimeout(() => {
      if (!toast.classList.contains('is-visible')) toast.hidden = true;
    }, 220);
  }

  function showToast(message, actionLabel = '', action = null, duration = 4200) {
    const toast = $('#toast');
    const text = $('#toastText');
    const actionButton = $('#toastAction');
    if (!toast || !text || !actionButton) return;
    window.clearTimeout(toastHideTimer);
    text.textContent = message;
    toastActionHandler = typeof action === 'function' ? action : null;
    if (actionLabel && toastActionHandler) {
      actionButton.hidden = false;
      actionButton.textContent = actionLabel;
    } else {
      actionButton.hidden = true;
      actionButton.textContent = '';
    }
    toast.hidden = false;
    positionToast();
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    toastHideTimer = window.setTimeout(() => hideToast(), duration);
  }

  function positionToast() {
    const toast = $('#toast');
    const sheetRoot = $('#sheetRoot');
    const sheet = $('#sheet');
    if (!toast) return;
    if (sheetRoot && !sheetRoot.hidden && sheet) {
      const rect = sheet.getBoundingClientRect();
      const topSpace = Math.max(14, window.innerHeight - rect.top + 12);
      toast.style.bottom = `${topSpace}px`;
    } else {
      toast.style.bottom = '';
    }
  }

  function celebrate() {
    if (prefersReducedMotion.matches) return;
    const layer = $('#confettiLayer');
    if (!layer) return;
    layer.innerHTML = '';
    const colors = ['#FF7A29', '#FFB05C', '#16865A', '#75C9A5', '#2E6BE6', '#FFD36A', '#D44163'];
    const amount = 34;
    for (let i = 0; i < amount; i += 1) {
      const piece = document.createElement('i');
      piece.className = 'confetti-piece';
      const size = 4 + Math.random() * 6;
      piece.style.width = `${size}px`;
      piece.style.height = `${size * (Math.random() > .55 ? 1.7 : 1)}px`;
      piece.style.left = `${44 + Math.random() * 12}%`;
      piece.style.top = `${28 + Math.random() * 10}%`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      if (Math.random() > .5) piece.style.borderRadius = '50%';
      layer.appendChild(piece);
      const dx = (Math.random() - .5) * Math.min(680, window.innerWidth * 1.25);
      const up = 110 + Math.random() * 220;
      const fall = 280 + Math.random() * 360;
      const rotate = (Math.random() - .5) * 900;
      piece.animate([
        { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate3d(${dx * .6}px, ${-up}px, 0) rotate(${rotate * .55}deg)`, opacity: 1, offset: .42 },
        { transform: `translate3d(${dx}px, ${fall}px, 0) rotate(${rotate}deg)`, opacity: 0 }
      ], {
        duration: 1450 + Math.random() * 850,
        delay: Math.random() * 160,
        easing: 'cubic-bezier(.16,.72,.32,1)',
        fill: 'forwards'
      });
    }
    window.setTimeout(() => { layer.innerHTML = ''; }, 2600);
  }

  /* ---------------- Home rendering ---------------- */

  function setHeroRing(percent) {
    const circle = $('#heroRingValue');
    if (!circle) return;
    const circumference = 2 * Math.PI * 52;
    circle.style.strokeDashoffset = String(circumference * (1 - Math.min(100, Math.max(0, percent)) / 100));
  }

  function updateTodoBadge() {
    const badge = $('#todoBadge');
    const button = $('#todoBtn');
    if (!badge || !button || !state) return;
    const stats = getTodoStats();
    if (stats.remaining > 0) {
      badge.hidden = false;
      badge.textContent = stats.remaining > 9 ? '9+' : String(stats.remaining);
    } else {
      badge.hidden = true;
      badge.textContent = '';
    }
    if (stats.total === 0) button.setAttribute('aria-label', '待办清单');
    else if (stats.remaining > 0) button.setAttribute('aria-label', `待办清单，还有 ${stats.remaining} 项未完成`);
    else button.setAttribute('aria-label', '待办清单，已全部完成');
  }

  function renderHome() {
    if (!state) return;
    const stats = getGlobalStats();
    const todoStats = getTodoStats();
    const hero = $('#hero');
    const fixedScroll = $('#fixedScroll');
    const packageGrid = $('#packageGrid');
    const checkAllFixedBtn = $('#checkAllFixedBtn');
    const newTripBtn = $('#newTripBtn');
    const continueBtn = $('#continueBtn');
    const addFabLabel = $('#addFabLabel');
    const addFab = $('#addFab');
    const activePackageCount = state.packages.filter((pkg) => pkg.items.length > 0).length;

    if (!hero || !fixedScroll || !packageGrid) return;
    updateTodoBadge();
    updateExpenseButton();

    const heroState = stats.total === 0 ? 'empty' : (stats.remaining === 0 ? 'complete' : 'active');
    hero.dataset.state = heroState;
    setHeroRing(stats.percent);

    $('#heroPercent').textContent = `${stats.percent}%`;
    $('#heroEyebrow').textContent = heroState === 'complete'
      ? (todoStats.remaining > 0 ? '物品清点完成' : '全部清点完成')
      : '本次出差';
    $('#packageCount').textContent = String(stats.packageCount);
    $('#fixedCount').textContent = String(stats.fixed);

    if (heroState === 'empty') {
      $('#heroTitle').textContent = '从第一件开始';
      $('#heroSub').textContent = stats.packageCount === 0
        ? '先建一个包裹，再装入要带的东西'
        : '包裹已经建好，把要带的东西加进去吧';
      $('#continueLabel').textContent = stats.packageCount === 0 ? '新建包裹' : '添加物品';
      $('#heroHint').textContent = '把常驻物品固定下来，出发前少操一份心';
      if (continueBtn) continueBtn.setAttribute('aria-label', stats.packageCount === 0 ? '新建第一个包裹' : '添加第一件物品');
    } else if (heroState === 'complete') {
      $('#heroTitle').textContent = todoStats.remaining > 0 ? '物品带齐了' : '都带齐了';
      $('#heroSub').textContent = `共 ${stats.total} 件物品 · ${activePackageCount} 个包裹全部就位`;
      $('#continueLabel').textContent = '从头再查一遍';
      $('#heroHint').textContent = todoStats.remaining > 0
        ? `物品都带齐了，待办清单还剩 ${todoStats.remaining} 项。`
        : '出发吧，祝你一路顺利，早点回家。';
      if (continueBtn) continueBtn.setAttribute('aria-label', '回到清单重新检查');
    } else {
      $('#heroTitle').textContent = `还差 ${stats.remaining} 件`;
      $('#heroSub').textContent = `已带 ${stats.done} 件 · 共 ${stats.total} 件 · 固定 ${stats.fixed} 件`;
      $('#continueLabel').textContent = '继续清点';
      $('#heroHint').textContent = stats.fixedRemaining > 0
        ? `还有 ${stats.fixedRemaining} 件固定物品没勾选，出发前再确认一遍`
        : '固定物品已置顶，最后再确认一遍';
      if (continueBtn) continueBtn.setAttribute('aria-label', `继续清点，还差 ${stats.remaining} 件物品`);
    }

    if (newTripBtn) newTripBtn.hidden = stats.total === 0;
    if (addFabLabel) addFabLabel.textContent = stats.packageCount === 0 ? '新建包裹' : '添加物品';
    if (addFab) addFab.setAttribute('aria-label', stats.packageCount === 0 ? '新建包裹' : '添加物品');

    // Fixed items
    const fixedEntries = getFixedEntries();
    const previousScroll = fixedScroll.scrollLeft;
    if (fixedEntries.length === 0) {
      fixedScroll.innerHTML = `
        <div class="fixed-empty">
          <span class="fixed-empty-icon">${icon('pin')}</span>
          <div class="fixed-empty-copy">
            <strong>还没有固定物品</strong>
            <p>点物品右侧的图钉，把每次必带的东西固定下来。</p>
          </div>
          <button type="button" data-action="scroll-to-packages">去设置</button>
        </div>`;
      if (checkAllFixedBtn) checkAllFixedBtn.hidden = true;
    } else {
      if (checkAllFixedBtn) {
        checkAllFixedBtn.hidden = false;
        const pending = fixedEntries.filter((entry) => !entry.item.checked).length;
        checkAllFixedBtn.disabled = pending === 0;
        checkAllFixedBtn.textContent = pending === 0 ? '已全部勾选' : '全部勾选';
      }
      fixedScroll.innerHTML = fixedEntries.map(({ pkg, item }) => {
        const checked = item.checked;
        return `
          <button class="fixed-chip ${checked ? 'is-checked' : ''} tone-${pkgTone(pkg)}"
            type="button"
            data-action="toggle-fixed-chip"
            data-package-id="${escapeHTML(pkg.id)}"
            data-item-id="${escapeHTML(item.id)}"
            aria-pressed="${checked}"
            aria-label="${escapeHTML(item.name)}，${escapeHTML(pkg.name)}，${checked ? '已带，点击取消勾选' : '待带，点击勾选'}">
            <span class="fixed-check" aria-hidden="true">${icon('check')}</span>
            <span class="fixed-text">
              <span class="fixed-name">${escapeHTML(item.name)}</span>
              <span class="fixed-bag"><i class="fixed-bag-dot"></i>${escapeHTML(pkg.name)}${item.qty > 1 ? ` <span class="fixed-qty">×${item.qty}</span>` : ''}</span>
            </span>
          </button>`;
      }).join('');
      requestAnimationFrame(() => { fixedScroll.scrollLeft = previousScroll; });
    }

    // Packages
    packageGrid.classList.toggle('is-empty', state.packages.length === 0);
    if (state.packages.length === 0) {
      packageGrid.innerHTML = `
        <button class="pkg-add" type="button" data-action="add-package">
          <span class="pkg-add-icon">${icon('plus')}</span>
          <strong>新建第一个包裹</strong>
          <small>行李箱、背包、电脑包，都能分开清点</small>
        </button>`;
    } else {
      const cards = state.packages.map((pkg) => {
        const pkgStats = getPackageStats(pkg);
        const percent = pkgStats.total ? Math.round((pkgStats.done / pkgStats.total) * 100) : 0;
        const complete = pkgStats.total > 0 && pkgStats.remaining === 0;
        let meta;
        if (pkgStats.total === 0) meta = '还没有物品';
        else if (complete) meta = '已全部带齐';
        else meta = `待带 ${pkgStats.remaining} 件`;
        const ariaLabel = `${pkg.name}，${complete ? '已全部带齐' : `共 ${pkgStats.total} 件，已带 ${pkgStats.done} 件`}，点击打开包裹`;
        return `
          <button class="pkg-card tone-${pkgTone(pkg)} ${complete ? 'is-complete' : ''}"
            type="button"
            data-action="open-package"
            data-package-id="${escapeHTML(pkg.id)}"
            aria-label="${escapeHTML(ariaLabel)}">
            <span class="pkg-card-top">
              <span class="pkg-icon" aria-hidden="true">${icon(pkgIconKey(pkg))}</span>
              <span class="pkg-count" aria-hidden="true"><b>${pkgStats.done}</b>/${pkgStats.total}</span>
            </span>
            <span class="pkg-name">${escapeHTML(pkg.name)}</span>
            <span class="pkg-meta">
              <span>${meta}</span>
              ${pkgStats.fixed > 0 ? `<i class="meta-dot"></i><span>固定 ${pkgStats.fixed}</span>` : ''}
            </span>
            <span class="pkg-progress" aria-hidden="true"><span style="width:${percent}%"></span></span>
          </button>`;
      }).join('');
      packageGrid.innerHTML = `${cards}
        <button class="pkg-add" type="button" data-action="add-package">
          <span class="pkg-add-icon">${icon('plus')}</span>
          <strong>新建包裹</strong>
          <small>再分一个，更好找</small>
        </button>`;
    }
  }

  function scrollToPackages() {
    const section = $('.packages-section');
    if (!section) return;
    section.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function handleContinue() {
    if (!state.packages.length) {
      openPackageSheet();
      return;
    }
    const stats = getGlobalStats();
    if (stats.total === 0) {
      if (state.packages.length) openItemSheet(state.packages[0].id);
      else openPackageSheet();
      return;
    }
    const uncheckedFixed = getFixedEntries().find((entry) => !entry.item.checked);
    if (uncheckedFixed) {
      const fixedSection = $('#fixedSection');
      if (fixedSection) {
        fixedSection.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
        window.setTimeout(() => {
          const chip = $(`[data-action="toggle-fixed-chip"][data-item-id="${escapeHTML(uncheckedFixed.item.id)}"]`);
          if (chip && $('#fixedScroll')) {
            $('#fixedScroll').scrollTo({ left: Math.max(0, chip.offsetLeft - 20), behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
          }
        }, 320);
      }
      return;
    }
    const firstPending = state.packages.find((pkg) => getPendingCount(pkg) > 0);
    if (firstPending) {
      const card = $(`[data-action="open-package"][data-package-id="${escapeHTML(firstPending.id)}"]`);
      if (card) {
        card.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
        card.classList.remove('card-pulse');
        void card.offsetWidth;
        card.classList.add('card-pulse');
        window.setTimeout(() => card.classList.remove('card-pulse'), 700);
      }
    } else {
      scrollToPackages();
    }
  }

  function renderHubPage() {
    const pack = getGlobalStats();
    const todo = getTodoStats();
    const activeTrip = getExpenseActiveTrip();
    const lastTrip = activeTrip ? null : getLatestFinishedExpenseTrip();
    const summaryTrip = activeTrip || lastTrip;
    const summary = summaryTrip ? computeExpenseSummary(summaryTrip) : null;

    const todoBtn = $('#hubTodoBtn');
    const todoStat = $('#hubTodoStat');
    const todoMeta = $('#hubTodoMeta');
    if (todoStat && todoMeta) {
      if (!todo.total) {
        todoStat.textContent = '还没有待办';
        todoMeta.textContent = '新建第一份清单';
      } else if (todo.remaining > 0) {
        todoStat.textContent = `${todo.remaining} 项未完成`;
        todoMeta.textContent = `${todo.listCount} 份清单 · 已完成 ${todo.done} 项`;
      } else {
        todoStat.textContent = '全部完成';
        todoMeta.textContent = `${todo.listCount} 份清单 · 共 ${todo.total} 项`;
      }
      if (todoBtn) todoBtn.setAttribute('aria-label', `待办，${todoStat.textContent}，${todoMeta.textContent}`);
    }

    const expenseBtn = $('#hubExpenseBtn');
    const expenseStat = $('#hubExpenseStat');
    const expenseMeta = $('#hubExpenseMeta');
    if (expenseStat && expenseMeta) {
      if (!summary) {
        expenseStat.textContent = '开始记录';
        expenseMeta.textContent = '按天补贴与额外支出';
      } else if (activeTrip) {
        expenseStat.textContent = formatMoneyCNY(summary.totalCny);
        expenseMeta.textContent = `出差 ${summary.totalDays} 天 · 进行中`;
      } else {
        expenseStat.textContent = formatMoneyCNY(summary.totalCny);
        expenseMeta.textContent = `上次出差 · ${summary.totalDays} 天`;
      }
      if (expenseBtn) expenseBtn.setAttribute('aria-label', `出差费用，${expenseStat.textContent}，${expenseMeta.textContent}`);
    }

    const packBtn = $('#hubPackBtn');
    const packStat = $('#hubPackStat');
    const packMeta = $('#hubPackMeta');
    const packBar = $('#hubPackBar');
    if (packStat && packMeta) {
      if (!pack.total) {
        packStat.textContent = '还没有物品';
        packMeta.textContent = '先建一个包裹';
      } else if (pack.remaining > 0) {
        packStat.textContent = `还差 ${pack.remaining} 件`;
        packMeta.textContent = `已带 ${pack.done} / ${pack.total} 件 · ${pack.packageCount} 个包裹`;
      } else {
        packStat.textContent = '全部带齐';
        packMeta.textContent = `共 ${pack.total} 件 · ${pack.packageCount} 个包裹`;
      }
      if (packBar) packBar.style.width = `${pack.percent}%`;
      if (packBtn) packBtn.setAttribute('aria-label', `打包清单，${packStat.textContent}，${packMeta.textContent}`);
    }
  }

  /* ---------------- Navigation / overlays ---------------- */

  function getTopLayer() {
    return layers.length ? layers[layers.length - 1] : null;
  }

  function getPageLayer() {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      if (layers[index].type !== 'sheet') return layers[index];
    }
    return null;
  }

  function getSheetLayer() {
    const top = getTopLayer();
    return top && top.type === 'sheet' ? top : null;
  }

  function pushHistoryEntry() {
    if (!historyEnabled) return;
    try {
      history.pushState({ xingnangDepth: layers.length }, '');
      historyDepth = layers.length;
    } catch (error) {
      console.warn('浏览器历史记录不可用，改为页内返回', error);
      historyEnabled = false;
      historyDepth = 0;
    }
  }

  function pushLayer(layer) {
    layer.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    navigationLockedUntil = 0;
    layers.push(layer);
    pushHistoryEntry();
    syncUI({ reason: 'push' });
  }

  function replaceSheet(sheet) {
    const top = getTopLayer();
    if (!top || top.type !== 'sheet') {
      openSheet(sheet);
      return;
    }
    top.sheet = sheet;
    currentSheetRef = null;
    syncUI({ reason: 'replace' });
  }

  function openSheet(sheet) {
    if (!sheet || !sheet.kind) return;
    if (getTopLayer() && getTopLayer().type === 'sheet') {
      replaceSheet(sheet);
      return;
    }
    pushLayer({ type: 'sheet', sheet });
  }

  function closeTopLayer() {
    if (!layers.length) return;
    if (!historyEnabled) {
      closeTopDirect();
      return;
    }
    const now = Date.now();
    if (now < navigationLockedUntil) return;
    navigationLockedUntil = now + 320;
    history.back();
  }

  function closeTopDirect(focusTarget = null) {
    if (!layers.length) return;
    const removed = layers.pop();
    currentSheetRef = null;
    syncUI({ reason: 'pop', focusTarget: focusTarget || (removed && removed.returnFocus) });
  }

  function closeAllLayers() {
    if (!layers.length) return;
    const count = layers.length;
    layers = [];
    currentSheetRef = null;
    navigationLockedUntil = Date.now() + 320;
    syncUI({ reason: 'closeAll' });
    if (historyEnabled && historyDepth > 0) {
      historyDepth = 0;
      try { history.go(-count); } catch (_) { /* ignore */ }
    }
  }

  function openDetail(packageId, options = {}) {
    const pkg = getPackageById(packageId);
    if (!pkg) return;
    detailFilter = 'all';
    pushLayer({
      type: 'detail',
      id: packageId,
      highlight: options.highlight || null
    });
    const scroll = $('#detailScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function openSettings(options = {}) {
    pushLayer({ type: 'settings', scrollToData: options.scrollToData === true });
    const scroll = $('.settings-scroll');
    if (scroll) scroll.scrollTop = 0;
    if (options.scrollToData) {
      window.setTimeout(() => {
        const target = $('#dataHeading');
        if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start', behavior: 'auto' });
      }, 420);
    }
  }

  function openSearch() {
    searchQuery = '';
    const input = $('#searchInput');
    if (input) input.value = '';
    const clear = $('#searchClearBtn');
    if (clear) clear.hidden = true;
    pushLayer({ type: 'search' });
    const scroll = $('#searchScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function openHubPage() {
    const top = getTopLayer();
    if (top && top.type === 'hub') return;
    pushLayer({ type: 'hub' });
    const scroll = $('#hubPage .page-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function openTodoPage() {
    pushLayer({ type: 'todo' });
    const scroll = $('#todoScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function openTodoListPage(listId) {
    const list = getTodoListById(listId);
    if (!list) return;
    pushLayer({ type: 'todoList', listId: list.id });
    const scroll = $('#todoListScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function openExpensePage() {
    expenseTab = 'overview';
    expenseMonth = currentMonthISO();
    pushLayer({ type: 'expense' });
    const scroll = $('#expenseScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function visiblePageElement() {
    const pageLayer = getPageLayer();
    if (!pageLayer) return null;
    if (pageLayer.type === 'detail') return $('#detailPage');
    if (pageLayer.type === 'settings') return $('#settingsPage');
    if (pageLayer.type === 'search') return $('#searchPage');
    if (pageLayer.type === 'hub') return $('#hubPage');
    if (pageLayer.type === 'todo') return $('#todoPage');
    if (pageLayer.type === 'todoList') return $('#todoListPage');
    if (pageLayer.type === 'expense') return $('#expensePage');
    return null;
  }

  function focusFallback() {
    const pageLayer = getPageLayer();
    if (pageLayer && pageLayer.type === 'detail') return $('#detailBackBtn');
    if (pageLayer && pageLayer.type === 'settings') return $('#settingsBackBtn');
    if (pageLayer && pageLayer.type === 'search') return $('#searchBackBtn');
    if (pageLayer && pageLayer.type === 'hub') return $('#hubSettingsBtn');
    if (pageLayer && pageLayer.type === 'todo') return $('#todoBackBtn');
    if (pageLayer && pageLayer.type === 'todoList') return $('#todoListBackBtn');
    if (pageLayer && pageLayer.type === 'expense') return $('#expenseBackBtn');
    return $('#addFab');
  }

  function focusSheetInitial(sheet) {
    if (!sheet) return;
    let target = null;
    if (sheet.kind === 'item') target = $('#itemName');
    else if (sheet.kind === 'package') target = $('#packageName');
    else if (sheet.kind === 'todo') target = $('#todoTitle');
    else if (sheet.kind === 'todoList') target = $('#todoListName');
    else if (sheet.kind === 'expenseAdd') target = $('#expenseAmount');
    else if (sheet.kind === 'expenseDay') target = $('#expenseDayAmount');
    else if (sheet.kind === 'expenseTripDate') target = $('#sheetCloseBtn');
    if (!target) target = $('#sheetCloseBtn');
    if (target && target.isConnected) {
      try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
    }
  }

  function scheduleFocus(options) {
    const { reason, focusTarget } = options;
    const isOpening = reason === 'push' || reason === 'replace';
    if (isOpening) {
      const sheetLayer = getSheetLayer();
      const pageLayer = getPageLayer();
      const delay = prefersReducedMotion.matches ? 20 : 300;
      window.setTimeout(() => {
        if (welcomeOpen) return;
        if (sheetLayer) {
          if (getTopLayer() === sheetLayer) focusSheetInitial(sheetLayer.sheet);
          return;
        }
        if (!pageLayer || getPageLayer() !== pageLayer) return;
        if (pageLayer.type === 'search') {
          const input = $('#searchInput');
          if (input) {
            try { input.focus({ preventScroll: false }); } catch (_) { input.focus(); }
          }
        } else if (pageLayer.type === 'detail') {
          const target = $('#detailBackBtn');
          if (target) target.focus({ preventScroll: true });
        } else if (pageLayer.type === 'settings') {
          const target = $('#settingsBackBtn');
          if (target) target.focus({ preventScroll: true });
        } else if (pageLayer.type === 'todo') {
          const target = $('#todoBackBtn');
          if (target) target.focus({ preventScroll: true });
        } else if (pageLayer.type === 'hub') {
          const target = $('#hubSettingsBtn');
          if (target) target.focus({ preventScroll: true });
        } else if (pageLayer.type === 'todoList') {
          const target = $('#todoListBackBtn');
          if (target) target.focus({ preventScroll: true });
        } else if (pageLayer.type === 'expense') {
          const target = $('#expenseBackBtn');
          if (target) target.focus({ preventScroll: true });
        }
      }, delay);
      return;
    }
    if (reason === 'pop' || reason === 'closeAll') {
      window.setTimeout(() => {
        if (welcomeOpen) return;
        let target = null;
        if (focusTarget && focusTarget.isConnected) {
          const hiddenAncestor = focusTarget.closest('.page:not(.is-open), [inert]');
          if (!hiddenAncestor) target = focusTarget;
        }
        if (!target) target = focusFallback();
        if (target && target.isConnected) {
          try { target.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
        }
      }, 60);
    }
  }

  function syncUI(options = {}) {
    const { reason = 'update', focusTarget = null } = options;
    const pageLayer = getPageLayer();
    const sheetLayer = getSheetLayer();
    const pageMap = {
      detail: $('#detailPage'),
      settings: $('#settingsPage'),
      search: $('#searchPage'),
      hub: $('#hubPage'),
      todo: $('#todoPage'),
      todoList: $('#todoListPage'),
      expense: $('#expensePage')
    };
    const visibleType = pageLayer ? pageLayer.type : null;

    Object.entries(pageMap).forEach(([type, page]) => {
      if (!page) return;
      const open = type === visibleType;
      page.classList.toggle('is-open', open);
      page.setAttribute('aria-hidden', String(!open));
      if ('inert' in page) page.inert = !open || Boolean(sheetLayer);
    });

    if (visibleType === 'detail' && pageLayer) renderDetail(pageLayer);
    else if (visibleType === 'settings') renderSettings();
    else if (visibleType === 'search') renderSearch();
    else if (visibleType === 'hub') renderHubPage();
    else if (visibleType === 'todo') renderTodoPage();
    else if (visibleType === 'todoList') renderTodoListPage(pageLayer);
    else if (visibleType === 'expense') renderExpensePage();
    else window.clearTimeout(detailHighlightTimer);

    const sheetRoot = $('#sheetRoot');
    if (sheetLayer) {
      if (sheetRoot) sheetRoot.hidden = false;
      if (currentSheetRef !== sheetLayer.sheet) {
        currentSheetRef = sheetLayer.sheet;
        renderSheet(sheetLayer.sheet);
      }
      requestAnimationFrame(positionToast);
      window.setTimeout(positionToast, 380);
    } else {
      if (sheetRoot) sheetRoot.hidden = true;
      currentSheetRef = null;
      requestAnimationFrame(positionToast);
    }

    const hasOverlay = Boolean(pageLayer) || Boolean(sheetLayer) || welcomeOpen;
    const app = $('#app');
    if (app && 'inert' in app) app.inert = Boolean(pageLayer) || Boolean(sheetLayer) || welcomeOpen;
    document.body.classList.toggle('is-locked', hasOverlay);

    if (pageLayer && pageLayer.type === 'detail') {
      const pkg = getPackageById(pageLayer.id);
      document.title = pkg ? `${pkg.name} · 行囊` : APP_TITLE;
    } else if (pageLayer && pageLayer.type === 'settings') {
      document.title = `设置 · 行囊`;
    } else if (pageLayer && pageLayer.type === 'search') {
      document.title = `搜索 · 行囊`;
    } else if (pageLayer && pageLayer.type === 'todo') {
      document.title = `待办清单 · 行囊`;
    } else if (pageLayer && pageLayer.type === 'hub') {
      document.title = APP_TITLE;
    } else if (pageLayer && pageLayer.type === 'todoList') {
      const list = getTodoListById(pageLayer.listId);
      document.title = `${list ? list.name : '待办清单'} · 行囊`;
    } else if (pageLayer && pageLayer.type === 'expense') {
      document.title = `出差费用 · 行囊`;
    } else {
      document.title = APP_TITLE;
    }

    scheduleFocus({ reason, focusTarget });
  }

  /* ---------------- Detail page ---------------- */

  function renderItemRow(pkg, item) {
    const category = catInfo(item.cat);
    const metaParts = [`<span>${escapeHTML(category.label)}</span>`];
    if (item.qty > 1) metaParts.push('<i class="item-meta-dot"></i>', `<span>×${item.qty}</span>`);
    if (item.note) metaParts.push('<i class="item-meta-dot"></i>', `<span>${escapeHTML(item.note)}</span>`);
    const checked = item.checked;
    return `
      <div class="item-row ${checked ? 'is-checked' : ''}" data-item-id="${escapeHTML(item.id)}">
        <button class="item-check" type="button"
          data-action="toggle-item"
          data-package-id="${escapeHTML(pkg.id)}"
          data-item-id="${escapeHTML(item.id)}"
          aria-pressed="${checked}"
          aria-label="${checked ? '取消已带' : '标记已带'}：${escapeHTML(item.name)}">
          <span aria-hidden="true">${icon('check')}</span>
        </button>
        <span class="item-icon cat-${escapeHTML(category.key)}" aria-hidden="true">${icon(category.icon)}</span>
        <button class="item-main" type="button"
          data-action="toggle-item"
          data-package-id="${escapeHTML(pkg.id)}"
          data-item-id="${escapeHTML(item.id)}"
          aria-pressed="${checked}"
          aria-label="${escapeHTML(item.name)}，${checked ? '已带，点击取消' : '待带，点击标记已带'}">
          <span class="item-name">${escapeHTML(item.name)}</span>
          <span class="item-meta">${metaParts.join('')}</span>
        </button>
        <button class="pin-btn ${item.fixed ? 'is-active' : ''}" type="button"
          data-action="toggle-pin"
          data-package-id="${escapeHTML(pkg.id)}"
          data-item-id="${escapeHTML(item.id)}"
          aria-pressed="${item.fixed}"
          aria-label="${item.fixed ? '取消固定' : '固定为每次必带'}：${escapeHTML(item.name)}">
          ${icon('pin')}
        </button>
        <button class="more-btn" type="button"
          data-action="item-menu"
          data-package-id="${escapeHTML(pkg.id)}"
          data-item-id="${escapeHTML(item.id)}"
          aria-label="更多操作：${escapeHTML(item.name)}">
          ${icon('more')}
        </button>
      </div>`;
  }

  function itemGroupMarkup(title, groupIcon, items, pkg, note = '', mutedIcon = false) {
    if (!items.length) return '';
    return `
      <section class="item-group" aria-label="${escapeHTML(title)}">
        <div class="group-head">
          <div class="group-title">
            ${icon(groupIcon, mutedIcon ? 'muted-icon' : '')}
            <span>${escapeHTML(title)}</span>
            ${note ? `<span class="group-note">${escapeHTML(note)}</span>` : ''}
          </div>
          <span class="group-count">${items.length}</span>
        </div>
        <div class="item-list">
          ${items.map((item) => renderItemRow(pkg, item)).join('')}
        </div>
      </section>`;
  }

  function renderDetail(pageLayer) {
    const pkg = getPackageById(pageLayer.id);
    const content = $('#detailContent');
    const topTitle = $('#detailPage .page-topbar-title');
    if (!content) return;
    if (!pkg) {
      content.innerHTML = `
        <div class="detail-empty">
          <span class="empty-orb">${icon('box')}</span>
          <h3>这个包裹不见了</h3>
          <p>它可能已经被删除，回到清单重新看看。</p>
          <button type="button" data-action="close-all">返回清单</button>
        </div>`;
      if (topTitle) topTitle.textContent = '包裹详情';
      return;
    }

    if (topTitle) topTitle.textContent = pkg.name;
    const stats = getPackageStats(pkg);
    const globalStats = getGlobalStats();
    const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
    const complete = stats.total > 0 && stats.done === stats.total;
    const circumference = 2 * Math.PI * 23;
    const ringOffset = circumference * (1 - percent / 100);
    const todoCount = pkg.items.filter((item) => !item.checked).length;
    const doneCount = pkg.items.length - todoCount;
    const fixedItems = pkg.items.filter((item) => item.fixed);
    const otherItems = pkg.items.filter((item) => !item.fixed);
    const filtered = pkg.items.filter((item) => {
      if (detailFilter === 'todo') return !item.checked;
      if (detailFilter === 'done') return item.checked;
      return true;
    });
    const visibleFixed = filtered.filter((item) => item.fixed);
    const visibleOther = filtered.filter((item) => !item.fixed);
    const kicker = stats.total === 0
      ? '还没放入物品'
      : complete
        ? '已全部带齐'
        : stats.done > 0 ? '正在清点' : '准备出发';
    const kickerIcon = complete ? 'check' : stats.total === 0 ? 'box' : 'list-checks';

    let filtersMarkup = '';
    if (stats.total > 0) {
      filtersMarkup = `
        <div class="detail-filters" role="group" aria-label="筛选物品">
          <button class="filter-chip ${detailFilter === 'all' ? 'is-active' : ''}" type="button" data-action="set-filter" data-filter="all" aria-pressed="${detailFilter === 'all'}">全部 <span class="filter-count">${stats.total}</span></button>
          <button class="filter-chip ${detailFilter === 'todo' ? 'is-active' : ''}" type="button" data-action="set-filter" data-filter="todo" aria-pressed="${detailFilter === 'todo'}">待带 <span class="filter-count">${todoCount}</span></button>
          <button class="filter-chip ${detailFilter === 'done' ? 'is-active' : ''}" type="button" data-action="set-filter" data-filter="done" aria-pressed="${detailFilter === 'done'}">已带 <span class="filter-count">${doneCount}</span></button>
        </div>`;
    }

    const completeBanner = complete ? `
      <div class="complete-banner">
        <span class="complete-icon">${icon('check')}</span>
        <div class="complete-copy">
          <strong>这个包裹收好了</strong>
          <p>${globalStats.remaining === 0 ? '所有包裹都确认完毕，可以出发了。' : `还有 ${globalStats.remaining} 件在别的包裹里。`}</p>
        </div>
      </div>` : '';

    let bodyMarkup;
    if (stats.total === 0) {
      bodyMarkup = `
        <div class="detail-empty">
          <span class="empty-orb">${icon(pkgIconKey(pkg))}</span>
          <h3>这个包裹还没有物品</h3>
          <p>把要放在「${escapeHTML(pkg.name)}」里的东西一件件加进来。</p>
          <button type="button" data-action="add-item" data-package-id="${escapeHTML(pkg.id)}">添加第一件物品</button>
        </div>`;
    } else if (filtered.length === 0) {
      bodyMarkup = `
        <div class="filtered-empty">
          ${icon(detailFilter === 'done' ? 'box' : 'list-checks')}
          <p>${detailFilter === 'done' ? '还没有已带的物品' : '这个包裹已经全部勾选了'}</p>
          <button type="button" data-action="set-filter" data-filter="all">查看全部物品</button>
        </div>`;
    } else {
      bodyMarkup = `
        ${itemGroupMarkup('固定物品', 'pin', visibleFixed, pkg, '每次必带', false)}
        ${itemGroupMarkup('其他物品', 'list-checks', visibleOther, pkg, '', true)}
        ${fixedItems.length === 0 && detailFilter === 'all' ? `
          <div class="detail-tip">
            ${icon('pin')}
            <span>点物品右侧的图钉，就能固定成每次必带的东西。</span>
          </div>` : ''}`;
    }

    content.innerHTML = `
      <section class="bag-hero tone-${pkgTone(pkg)}" aria-labelledby="bagTitle">
        <div class="bag-hero-main">
          <span class="bag-icon" aria-hidden="true">${icon(pkgIconKey(pkg))}</span>
          <div class="bag-info">
            <p class="bag-kicker">${icon(kickerIcon)} ${escapeHTML(kicker)}</p>
            <h1 class="bag-title" id="bagTitle">${escapeHTML(pkg.name)}</h1>
            <p class="bag-meta">${stats.total ? `<span>已带 ${stats.done} 件</span><i class="meta-dot"></i><span>共 ${stats.total} 件</span>${stats.fixed ? `<i class="meta-dot"></i><span>固定 ${stats.fixed}</span>` : ''}` : '<span>这个包裹还是空的</span>'}</p>
          </div>
          <div class="bag-ring" aria-hidden="true">
            <svg viewBox="0 0 60 60">
              <circle class="track" cx="30" cy="30" r="23"></circle>
              <circle class="value" cx="30" cy="30" r="23" style="stroke-dashoffset:${ringOffset}"></circle>
            </svg>
            <span>${percent}%</span>
          </div>
        </div>
        <div class="bag-progress">
          <div class="bag-progress-track" aria-hidden="true"><div class="bag-progress-fill" style="width:${percent}%"></div></div>
          <div class="bag-progress-caption"><span>已清点 ${percent}%</span><span>${stats.total === 0 ? '还没有物品' : stats.remaining ? `<b>还差 ${stats.remaining} 件</b>` : '全部就位'}</span></div>
        </div>
      </section>
      ${completeBanner}
      ${filtersMarkup}
      ${bodyMarkup}`;

    if (pageLayer.highlight) {
      const highlightId = pageLayer.highlight;
      pageLayer.highlight = null;
      window.clearTimeout(detailHighlightTimer);
      detailHighlightTimer = window.setTimeout(() => {
        if (!getPageLayer() || getPageLayer().type !== 'detail') return;
        const row = Array.from(content.querySelectorAll('.item-row')).find((el) => el.dataset.itemId === highlightId);
        if (!row) return;
        row.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
        row.classList.add('is-highlight');
        window.setTimeout(() => row.classList.remove('is-highlight'), 1900);
      }, prefersReducedMotion.matches ? 20 : 420);
    }
  }

  /* ---------------- To-do page ---------------- */

  function renderTodoRow(todo) {
    const checked = todo.checked;
    return `
      <div class="item-row todo-row ${checked ? 'is-checked' : ''}" data-todo-id="${escapeHTML(todo.id)}">
        <button class="item-check" type="button"
          data-action="toggle-todo"
          data-todo-id="${escapeHTML(todo.id)}"
          aria-pressed="${checked}"
          aria-label="${checked ? '取消完成' : '标记完成'}：${escapeHTML(todo.title)}">
          <span aria-hidden="true">${icon('check')}</span>
        </button>
        <span class="item-icon todo-icon" aria-hidden="true">${icon('list-checks')}</span>
        <button class="item-main" type="button"
          data-action="toggle-todo"
          data-todo-id="${escapeHTML(todo.id)}"
          aria-pressed="${checked}"
          aria-label="${escapeHTML(todo.title)}，${checked ? '已完成，点击取消' : '待办，点击标记完成'}">
          <span class="item-name">${escapeHTML(todo.title)}</span>
          <span class="item-meta">${todo.note ? escapeHTML(todo.note) : (checked ? '已完成' : '待办')}</span>
        </button>
        <button class="more-btn" type="button"
          data-action="edit-todo"
          data-todo-id="${escapeHTML(todo.id)}"
          aria-label="编辑待办：${escapeHTML(todo.title)}">
          ${icon('pencil')}
        </button>
      </div>`;
  }

  function renderTodoGroup(title, groupIcon, todos, note = '', muted = false) {
    if (!todos.length) return '';
    return `
      <section class="item-group" aria-label="${escapeHTML(title)}">
        <div class="group-head">
          <div class="group-title">
            ${icon(groupIcon, muted ? 'muted-icon' : '')}
            <span>${escapeHTML(title)}</span>
            ${note ? `<span class="group-note">${escapeHTML(note)}</span>` : ''}
          </div>
          <span class="group-count">${todos.length}</span>
        </div>
        <div class="item-list">
          ${todos.map(renderTodoRow).join('')}
        </div>
      </section>`;
  }

  function todoListCardMarkup(list) {
    const stats = getTodoListStats(list);
    const complete = stats.total > 0 && stats.remaining === 0;
    const meta = stats.total
      ? `${stats.remaining} 项待完成 · 共 ${stats.total} 项`
      : '还没有待办';
    return `
      <div class="todo-list-card ${complete ? 'is-complete' : ''}">
        <button class="todo-list-main" type="button" data-action="open-todo-list" data-list-id="${escapeHTML(list.id)}" aria-label="打开清单：${escapeHTML(list.name)}，${escapeHTML(meta)}">
          <span class="todo-list-icon" aria-hidden="true">${icon(complete ? 'check' : 'list-checks')}</span>
          <span class="todo-list-info">
            <span class="todo-list-name">${escapeHTML(list.name)}</span>
            <span class="todo-list-meta">${escapeHTML(meta)}</span>
            <span class="todo-list-progress" aria-hidden="true"><i style="width:${stats.percent}%"></i></span>
          </span>
          <span class="todo-list-percent">${stats.percent}%</span>
        </button>
        <button class="todo-list-edit" type="button" data-action="edit-todo-list" data-list-id="${escapeHTML(list.id)}" aria-label="编辑清单：${escapeHTML(list.name)}">
          ${icon('pencil')}
        </button>
      </div>`;
  }

  function renderTodoPage() {
    const content = $('#todoContent');
    if (!content) return;
    updateTodoBadge();
    const lists = state.todoLists;
    const stats = getTodoStats();
    if (!lists.length) {
      content.innerHTML = `
        <div class="detail-empty todo-lists-empty">
          <span class="empty-orb">${icon('list-checks')}</span>
          <h3>还没有待办清单</h3>
          <p>工作、购物、生活、出行……把不同的事分开列，完成得更清楚。</p>
          <button type="button" data-action="add-todo-list">新建第一份清单</button>
        </div>
        <div class="detail-tip">
          ${icon('shield')}
          <span>每份清单可以单独命名，清单和待办都会自动保存在本机。</span>
        </div>`;
      return;
    }

    const total = stats.total;
    const complete = total > 0 && stats.remaining === 0;
    const circumference = 2 * Math.PI * 23;
    const ringOffset = circumference * (1 - stats.percent / 100);
    content.innerHTML = `
      <section class="bag-hero todo-hero todo-overview-hero ${complete ? 'tone-green' : 'tone-orange'}" aria-labelledby="todoOverviewHeroTitle">
        <div class="bag-hero-main">
          <span class="bag-icon" aria-hidden="true">${icon(complete ? 'check' : 'list-checks')}</span>
          <div class="bag-info">
            <p class="bag-kicker">${icon('list-checks')} 待办总览</p>
            <h1 class="bag-title" id="todoOverviewHeroTitle">${total === 0 ? '从第一件待办开始' : complete ? '清单都完成了' : `还剩 ${stats.remaining} 项`}</h1>
            <p class="bag-meta"><span>${lists.length} 份清单</span><i class="meta-dot"></i><span>已完成 ${stats.done} / ${total} 项</span></p>
          </div>
          <div class="bag-ring" aria-hidden="true">
            <svg viewBox="0 0 60 60">
              <circle class="track" cx="30" cy="30" r="23"></circle>
              <circle class="value" cx="30" cy="30" r="23" style="stroke-dashoffset:${ringOffset}"></circle>
            </svg>
            <span>${stats.percent}%</span>
          </div>
        </div>
        <div class="bag-progress">
          <div class="bag-progress-track" aria-hidden="true"><div class="bag-progress-fill" style="width:${stats.percent}%"></div></div>
          <div class="bag-progress-caption"><span>已完成 ${stats.percent}%</span><span>${total === 0 ? '等待添加' : complete ? '全部完成' : `还剩 ${stats.remaining} 项`}</span></div>
        </div>
      </section>
      <div class="section-head todo-lists-head">
        <div class="section-title-wrap">
          <p class="section-kicker">${icon('list-checks')} 分开管理</p>
          <h2>我的清单 <span class="section-count">${lists.length}</span></h2>
        </div>
        <button class="text-action" type="button" data-action="add-todo-list">新建</button>
      </div>
      <div class="todo-list-grid">${lists.map(todoListCardMarkup).join('')}</div>
      <div class="detail-tip">
        ${icon('shield')}
        <span>每份清单单独命名、独立保存，可以用于工作、购物、生活或任何想分开的事情。</span>
      </div>`;
  }

  function renderTodoListPage(pageLayer = getPageLayer()) {
    const content = $('#todoListContent');
    const title = $('#todoListPageTitle');
    const editButton = $('#todoListEditBtn');
    const pageElement = $('#todoListPage');
    if (!content) return;
    const list = pageLayer && getTodoListById(pageLayer.listId);
    if (!list) {
      if (title) title.textContent = '待办清单';
      if (editButton) editButton.disabled = true;
      content.innerHTML = `
        <div class="detail-empty">
          <span class="empty-orb">${icon('list-checks')}</span>
          <h3>这份清单不存在了</h3>
          <p>它可能已经被删除，返回全部清单看看其他安排。</p>
        </div>`;
      return;
    }
    if (title) title.textContent = list.name;
    if (editButton) editButton.disabled = false;
    if (pageElement) pageElement.setAttribute('aria-label', `待办清单：${list.name}`);
    updateTodoBadge();

    const stats = getTodoListStats(list);
    const pending = list.items.filter((todo) => !todo.checked);
    const completed = list.items.filter((todo) => todo.checked);
    const total = stats.total;
    const complete = total > 0 && stats.remaining === 0;
    const circumference = 2 * Math.PI * 23;
    const ringOffset = circumference * (1 - stats.percent / 100);

    let bodyMarkup;
    if (total === 0) {
      bodyMarkup = `
        <div class="detail-empty">
          <span class="empty-orb">${icon('list-checks')}</span>
          <h3>这份清单还是空的</h3>
          <p>添加第一件要做的事，它会自动保存在本机。</p>
          <button type="button" data-action="add-todo" data-list-id="${escapeHTML(list.id)}">添加第一件待办</button>
        </div>
        <div class="detail-tip">
          ${icon('shield')}
          <span>待办清单和物品清点相互独立；清单内容会自动保存在本机。</span>
        </div>`;
    } else {
      bodyMarkup = `
        ${complete ? `
          <div class="complete-banner">
            <span class="complete-icon">${icon('check')}</span>
            <div class="complete-copy">
              <strong>这份清单已全部完成</strong>
              <p>可以继续添加新任务，或回到全部清单查看其他安排。</p>
            </div>
          </div>` : ''}
        ${renderTodoGroup('未完成', 'list-checks', pending, '逐条处理')}
        ${renderTodoGroup('已完成', 'check', completed, '', true)}
        <div class="detail-tip">
          ${icon('shield')}
          <span>清单独立保存；需要新的分类时，回到全部清单点「新建」。</span>
        </div>`;
    }

    content.innerHTML = `
      <section class="bag-hero todo-hero ${complete ? 'tone-green' : 'tone-orange'}" aria-labelledby="todoListHeroTitle">
        <div class="bag-hero-main">
          <span class="bag-icon" aria-hidden="true">${icon(complete ? 'check' : 'list-checks')}</span>
          <div class="bag-info">
            <p class="bag-kicker">${icon('list-checks')} 清单进度</p>
            <h1 class="bag-title" id="todoListHeroTitle">${total === 0 ? '从第一件待办开始' : complete ? '这份清单完成了' : `还剩 ${stats.remaining} 项`}</h1>
            <p class="bag-meta">${total ? `<span>已完成 ${stats.done} 项</span><i class="meta-dot"></i><span>共 ${total} 项</span>` : '<span>这份清单还是空的</span>'}</p>
          </div>
          <div class="bag-ring" aria-hidden="true">
            <svg viewBox="0 0 60 60">
              <circle class="track" cx="30" cy="30" r="23"></circle>
              <circle class="value" cx="30" cy="30" r="23" style="stroke-dashoffset:${ringOffset}"></circle>
            </svg>
            <span>${stats.percent}%</span>
          </div>
        </div>
        <div class="bag-progress">
          <div class="bag-progress-track" aria-hidden="true"><div class="bag-progress-fill" style="width:${stats.percent}%"></div></div>
          <div class="bag-progress-caption"><span>已完成 ${stats.percent}%</span><span>${total === 0 ? '等待添加' : complete ? '全部完成' : `还剩 ${stats.remaining} 项`}</span></div>
        </div>
      </section>
      ${bodyMarkup}`;
  }

  function refreshTodoViews() {
    renderHome();
    updateTodoBadge();
    const page = getPageLayer();
    if (page && page.type === 'todo') renderTodoPage();
    else if (page && page.type === 'todoList') renderTodoListPage(page);
  }

  function toggleTodoChecked(todoId) {
    const entry = findTodoEntry(todoId);
    if (!entry) return null;
    const { list, todo } = entry;
    const beforeList = getTodoListStats(list);
    todo.checked = !todo.checked;
    saveState();
    haptic(todo.checked ? 10 : 7);
    refreshTodoViews();
    const afterList = getTodoListStats(list);
    const justCompleted = todo.checked && beforeList.remaining > 0 && afterList.remaining === 0;
    if (justCompleted) {
      const allStats = getTodoStats();
      const message = allStats.remaining === 0 ? '所有待办清单都完成了' : `「${list.name}」已完成`;
      haptic([10, 30, 10]);
      showToast(message, '', null, 3200);
      announce(message);
    } else {
      announce(`「${todo.title}」${todo.checked ? '已完成' : '已恢复待办'}，这份清单还剩 ${afterList.remaining} 项`);
    }
    return todo;
  }

  function openTodoSheet(todoId = null, listId = null) {
    let list = null;
    let todo = null;
    if (todoId) {
      const entry = findTodoEntry(todoId);
      if (!entry) return;
      list = entry.list;
      todo = entry.todo;
    } else {
      const page = getPageLayer();
      const targetListId = listId || (page && page.type === 'todoList' ? page.listId : null);
      list = getTodoListById(targetListId);
      if (!list) {
        showToast('请先新建一份待办清单');
        return;
      }
    }
    openSheet({
      kind: 'todo',
      title: todo ? '编辑待办' : '新建待办',
      subtitle: todo ? `「${list.name}」 · 修改后立即保存` : `添加到「${list.name}」`,
      data: todo ? {
        mode: 'edit',
        id: todo.id,
        listId: list.id,
        title: todo.title,
        note: todo.note,
        checked: todo.checked
      } : {
        mode: 'create',
        id: null,
        listId: list.id,
        title: '',
        note: '',
        checked: false
      }
    });
  }

  function openDeleteTodoConfirm(todoId) {
    const entry = findTodoEntry(todoId);
    if (!entry) return;
    const { list, todo, index } = entry;
    replaceSheet({
      kind: 'confirm',
      title: '删除这条待办？',
      subtitle: '',
      data: {
        visual: 'danger',
        visualIcon: 'trash',
        text: `确定要删除「<strong>${escapeHTML(todo.title)}</strong>」吗？删除后仍可撤销。`,
        confirmText: '删除待办',
        cancelText: '再想想',
        onConfirm: () => {
          const liveEntry = findTodoEntry(todo.id);
          if (!liveEntry) {
            closeTopLayer();
            return;
          }
          const removed = liveEntry.list.items.splice(liveEntry.index, 1)[0];
          saveState();
          haptic(12);
          refreshTodoViews();
          closeTopLayer();
          showToast(`已删除「${removed.title}」`, '撤销', () => {
            const targetList = getTodoListById(list.id);
            if (!targetList) return;
            targetList.items.splice(Math.min(index, targetList.items.length), 0, removed);
            saveState();
            refreshTodoViews();
            announce(`已恢复待办「${removed.title}」`);
          }, 5000);
        }
      }
    });
  }

  function openTodoListSheet(listId = null, options = {}) {
    const list = listId ? getTodoListById(listId) : null;
    if (listId && !list) return;
    if (!listId && state.todoLists.length >= MAX_TODO_LISTS) {
      showToast(`最多可以建 ${MAX_TODO_LISTS} 份清单`);
      return;
    }
    const source = options.source === 'detail' ? 'detail' : 'overview';
    openSheet({
      kind: 'todoList',
      title: list ? '编辑待办清单' : '新建待办清单',
      subtitle: list ? '修改清单名称' : '给这份清单起一个名字',
      data: {
        mode: list ? 'edit' : 'create',
        id: list ? list.id : null,
        name: list ? list.name : '',
        source,
        itemCount: list ? list.items.length : 0
      }
    });
  }

  function renderTodoListSheet(sheet) {
    const body = $('#sheetBody');
    const draft = sheet.data;
    if (!body) return;
    body.innerHTML = `
      <form id="todoListForm" novalidate>
        <div class="field">
          <label for="todoListName">清单名称</label>
          <input class="text-input" id="todoListName" type="text" maxlength="30" autocomplete="off" placeholder="例如：工作、购物、周末安排" value="${escapeHTML(draft.name)}">
        </div>
        <p class="input-hint">每份清单可以单独命名，待办内容互不混合；最多 30 个字。</p>
        ${draft.mode === 'edit' ? `<div class="todo-list-sheet-meta">${icon('list-checks')} 这份清单已有 ${draft.itemCount} 条待办</div>` : ''}
        <div class="form-actions">
          <button class="button button-ghost button-cancel" type="button" data-close-sheet>取消</button>
          <button class="button button-primary button-save" type="submit">${draft.mode === 'edit' ? '保存名称' : '创建清单'}</button>
        </div>
        ${draft.mode === 'edit' && draft.source === 'overview' ? `<button class="danger-link" type="button" data-action="request-delete-todo-list">${icon('trash')}删除这份清单</button>` : ''}
        ${draft.mode === 'edit' && draft.source === 'detail' ? '<p class="input-hint todo-list-delete-hint">如需删除清单，请回到全部清单操作。</p>' : ''}
      </form>`;

    const form = $('#todoListForm');
    const nameInput = $('#todoListName');
    if (!form || !nameInput) return;
    nameInput.addEventListener('input', () => {
      draft.name = nameInput.value;
      nameInput.removeAttribute('aria-invalid');
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveTodoListSheet(sheet);
    });
  }

  function saveTodoListSheet(sheet) {
    const draft = sheet && sheet.data;
    if (!draft) return;
    const input = $('#todoListName');
    const name = normalizeName(draft.name, 30);
    if (!name) {
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      }
      showToast('先给清单起个名字');
      haptic([8, 40, 8]);
      return;
    }
    if (draft.mode === 'edit') {
      const list = getTodoListById(draft.id);
      if (!list) {
        showToast('这份清单已经不存在了');
        return;
      }
      list.name = name;
      saveState();
      haptic(8);
      refreshTodoViews();
      closeTopLayer();
      showToast(`清单已改名为「${name}」`);
      announce(`清单已改名为「${name}」`);
    } else {
      if (state.todoLists.length >= MAX_TODO_LISTS) {
        showToast(`最多可以建 ${MAX_TODO_LISTS} 份清单`);
        return;
      }
      const list = {
        id: makeId('tolist'),
        name,
        createdAt: Date.now(),
        items: []
      };
      state.todoLists.unshift(list);
      saveState();
      haptic(12);
      refreshTodoViews();
      closeTopLayer();
      showToast(`已新建清单「${name}」`);
      announce(`已新建清单「${name}」`);
    }
  }

  function openDeleteTodoListConfirm(listId) {
    const list = getTodoListById(listId);
    if (!list) return;
    const index = state.todoLists.findIndex((entry) => entry.id === list.id);
    if (index < 0) return;
    const itemText = list.items.length ? `其中的 ${list.items.length} 条待办也会一起删除` : '这份清单目前是空的';
    replaceSheet({
      kind: 'confirm',
      title: '删除这份清单？',
      subtitle: '',
      data: {
        visual: 'danger',
        visualIcon: 'trash',
        text: `确定要删除「<strong>${escapeHTML(list.name)}</strong>」吗？<br>${itemText}，删除后仍可撤销。`,
        confirmText: '删除清单',
        cancelText: '再想想',
        onConfirm: () => {
          const liveIndex = state.todoLists.findIndex((entry) => entry.id === list.id);
          if (liveIndex < 0) {
            closeTopLayer();
            return;
          }
          const removed = state.todoLists.splice(liveIndex, 1)[0];
          saveState();
          haptic(12);
          refreshTodoViews();
          closeTopLayer();
          showToast(`已删除清单「${removed.name}」`, '撤销', () => {
            state.todoLists.splice(Math.min(index, state.todoLists.length), 0, removed);
            saveState();
            refreshTodoViews();
            announce(`已恢复清单「${removed.name}」`);
          }, 5000);
        }
      }
    });
  }

  /* ---------------- Expense module ---------------- */

  function updateExpenseTabs() {
    $$('.expense-tabs [data-expense-tab]').forEach((button) => {
      const active = button.dataset.expenseTab === expenseTab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function setExpenseTab(tab) {
    if (!['overview', 'expenses', 'settings'].includes(tab)) return;
    expenseTab = tab;
    renderExpensePage();
    const scroll = $('#expenseScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function updateExpensePrimaryButton() {
    const bar = $('#expenseBottomBar');
    const button = $('#expensePrimaryBtn');
    if (!bar || !button) return;
    if (expenseTab === 'settings') {
      bar.hidden = true;
      return;
    }
    const active = getExpenseActiveTrip();
    let action = 'start';
    let label = '开始出差';
    let symbol = 'arrow-right';
    if (expenseTab === 'expenses' && active) {
      action = 'add-expense';
      label = '添加支出';
      symbol = 'plus';
    } else if (active) {
      action = 'end-trip';
      label = '结束出差';
      symbol = 'check';
    } else if (state.expense.trips.length > 0) {
      label = '开始新出差';
    }
    bar.hidden = false;
    button.dataset.expenseAction = action;
    button.setAttribute('aria-label', label);
    button.innerHTML = `${icon(symbol)}<span>${label}</span>`;
  }

  function handleExpensePrimary() {
    if (expenseTab === 'settings') return;
    const active = getExpenseActiveTrip();
    if (expenseTab === 'expenses' && active) {
      openExpenseAddSheet();
      return;
    }
    if (active) openExpenseTripDateSheet('end');
    else openExpenseTripDateSheet('start');
  }

  function refreshExpenseViews() {
    renderHome();
    updateExpenseButton();
    const page = getPageLayer();
    if (page && page.type === 'expense') renderExpensePage();
  }

  function expenseEmptyMarkup(mode = 'overview') {
    if (mode === 'expenses') {
      return `
        <div class="expense-empty">
          <span class="empty-orb">${icon('receipt')}</span>
          <h1>先开始一趟出差</h1>
          <p>开始出差后，就可以记录餐饮、交通、住宿等额外支出，系统会自动折算成人民币。</p>
        </div>
        <p class="expense-tip">额外支出只属于当前这趟出差；结束后仍可查看，但不能再修改。</p>`;
    }
    return `
      <section class="expense-empty">
        <span class="empty-orb">${icon('calculator')}</span>
        <h1>把出差费用算清楚</h1>
        <p>按自然日累计补贴，按月设置汇率，额外支出自动折算成人民币，最后生成可复制的提报文本。</p>
        <div class="expense-feature-list">
          <span>${icon('receipt')} 每日补贴与额外支出分开汇总</span>
          <span>${icon('refresh')} 不同月份分别使用对应汇率</span>
          <span>${icon('copy')} 一键复制本次提报文本</span>
        </div>
      </section>
      <p class="expense-tip">先点下方「开始出差」并选择起始日期，之后每天会自动累计；结束时再补上结束日期。</p>`;
  }

  function expenseHeroMarkup(summary) {
    const trip = summary.trip;
    const active = state.expense.activeTripId === trip.id;
    const usesRate = summary.foreignDays > 0 || summary.expenseItems.some((expense) => expense.currency === 'USD');
    const rateMonths = new Set();
    for (const day of summary.daily) {
      if (day.isForeign) rateMonths.add(monthOfISO(day.date));
    }
    for (const expense of summary.expenseItems) {
      if (expense.currency === 'USD') rateMonths.add(monthOfISO(expense.date));
    }
    const sortedRateMonths = Array.from(rateMonths).sort();
    let rateText = '';
    let rateWarning = false;
    if (!usesRate) {
      rateText = '本次没有需要汇率折算的项目';
    } else if (!summary.hasRate) {
      rateWarning = true;
      rateText = '尚未设置汇率，国外补贴和美元支出暂按 ¥0 计算';
    } else {
      const lastMonth = sortedRateMonths[sortedRateMonths.length - 1] || currentMonthISO();
      const lastRate = resolveExpenseRate(lastMonth);
      const rateLabel = lastRate.exact
        ? `${formatExpenseMonthLabel(lastMonth)}汇率`
        : `沿用${formatExpenseMonthLabel(lastRate.sourceMonth)}汇率`;
      if (sortedRateMonths.length > 1) {
        rateText = `各月汇率分别折算（最近可用：1 美元 ≈ ${formatPlainAmount(lastRate.rate)} 人民币）`;
      } else {
        rateText = `${rateLabel}：1 美元 ≈ ${formatPlainAmount(lastRate.rate)} 人民币`;
      }
    }
    const dateRange = active
      ? `${formatExpenseDate(trip.startDate, true)} 至今`
      : formatExpenseRange(trip.startDate, summary.endDate);
    return `
      <section class="expense-hero ${active ? '' : 'is-finished'}" aria-label="${active ? '进行中的出差' : '已结束的出差'}">
        <div class="expense-hero-top">
          <span class="expense-status ${active ? '' : 'is-finished'}"><span class="expense-status-dot"></span>${active ? '出差进行中' : '已完成'}</span>
          <span class="expense-date-range">${escapeHTML(dateRange)}</span>
        </div>
        <p class="expense-label">${active ? '累计应报销' : '本次应报销'}</p>
        <p class="expense-total">${formatMoneyCNY(summary.totalCny)}</p>
        <p class="expense-meta">共 ${summary.totalDays} 天 · 国外 ${summary.foreignDays} 天 / 国内 ${summary.domesticDays} 天</p>
        <p class="expense-rate-line ${rateWarning ? 'is-warning' : ''}">${icon(rateWarning ? 'info' : 'refresh')}<span>${escapeHTML(rateText)}</span></p>
      </section>`;
  }

  function expenseDayRowMarkup(item, active) {
    const amountText = formatMoneyCNY(item.cny);
    let subText;
    if (item.isForeign) {
      const ratePart = item.rate > 0 ? ` × ${formatPlainAmount(item.rate)}` : ' · 未设汇率';
      subText = `${item.hasOverride ? '自定义 · ' : ''}${formatPlainAmount(item.originalAmount)} USD${ratePart}`;
    } else {
      subText = `国内补贴 · ${formatPlainAmount(item.originalAmount)} CNY/天`;
    }
    const actionLabel = `切换为${item.isForeign ? '国内' : '国外'}补贴`;
    return `
      <div class="expense-day-row">
        <button class="expense-day-main" type="button"
          data-action="toggle-expense-nature"
          data-expense-date="${escapeHTML(item.date)}"
          ${active ? '' : 'disabled'}
          aria-label="${escapeHTML(formatExpenseDate(item.date, true))}，${item.isForeign ? '国外' : '国内'}补贴，${escapeHTML(amountText)}。${active ? escapeHTML(actionLabel) : '已完成，只读'}">
          <span class="expense-day-date"><b>${escapeHTML(formatExpenseDate(item.date))}</b><small>${escapeHTML(formatExpenseWeekday(item.date))}</small></span>
          <span class="nature-pill ${item.isForeign ? 'is-foreign' : 'is-domestic'}">${item.isForeign ? '国外' : '国内'}</span>
          <span class="expense-day-amount">${escapeHTML(amountText)}<small>${escapeHTML(subText)}</small></span>
        </button>
        ${active ? `<button class="expense-day-edit" type="button" data-action="edit-expense-day" data-expense-date="${escapeHTML(item.date)}" aria-label="修改 ${escapeHTML(formatExpenseDate(item.date, true))} 的补贴">${icon('pencil')}</button>` : ''}
      </div>`;
  }

  function renderExpenseOverview(trip, summary) {
    const active = state.expense.activeTripId === trip.id;
    const dayList = summary.daily.length
      ? `<div class="expense-day-list">${summary.daily.map((item) => expenseDayRowMarkup(item, active)).join('')}</div>`
      : `<div class="expense-empty-small">${icon('receipt')}<p>还没有可计算的出差日期</p></div>`;
    return `
      ${expenseHeroMarkup(summary)}
      <div class="expense-metrics">
        <div class="expense-metric"><span>每日补贴</span><strong>${formatMoneyCNY(summary.allowanceCny)}</strong></div>
        <div class="expense-metric"><span>额外支出</span><strong>${formatMoneyCNY(summary.expenseCny)}</strong></div>
      </div>
      <section class="expense-section" aria-labelledby="expenseDailyHeading">
        <div class="expense-section-head">
          <h2 id="expenseDailyHeading">${icon('receipt')} 每日明细 <span class="expense-count-pill">${summary.totalDays}</span></h2>
          <span class="section-note">${active ? '点按切换国内 / 国外' : '已完成，只读'}</span>
        </div>
        ${dayList}
      </section>
      <div class="expense-actions">
        <button class="button button-soft" type="button" data-action="copy-expense-report">${icon('copy')}复制提报文本</button>
        <button class="button button-ghost" type="button" data-action="expense-go-settings">${icon('sliders')}汇率 / 补贴</button>
      </div>
      <p class="expense-tip">${active
        ? '点日期行可切换国内 / 国外；点铅笔可单独修改当天国外补贴。结束出差后记录仍会保留，但不能再修改。'
        : '本次出差已结束，已保留在费用记录中；需要新一趟出差时，点下方「开始新出差」。'
      }</p>`;
  }

  function expenseRecordMarkup(item, active, hasRate) {
    const currencyLabel = item.currency === 'USD' ? '美元原币' : '人民币';
    const mainAmount = item.currency === 'USD'
      ? `$ ${formatPlainAmount(item.amount)}`
      : formatMoneyCNY(item.amount);
    let converted = item.currency === 'USD'
      ? (hasRate ? `≈ ${formatMoneyCNY(item.cny)}` : '未设置汇率')
      : '直接计入';
    return `
      <div class="expense-record">
        <span class="expense-record-icon">${icon('receipt')}</span>
        <div class="expense-record-main">
          <div class="expense-record-title">${escapeHTML(item.note || (item.currency === 'USD' ? '美元支出' : '人民币支出'))}</div>
          <div class="expense-record-sub">${escapeHTML(formatExpenseDate(item.date, true))} · ${currencyLabel}</div>
        </div>
        <div class="expense-record-amount">${mainAmount}<small>${converted}</small></div>
        ${active ? `<button class="expense-record-delete" type="button" data-action="delete-expense" data-expense-id="${escapeHTML(item.id)}" aria-label="删除这笔支出">${icon('trash')}</button>` : ''}
      </div>`;
  }

  function renderExpenseExpenses(trip, summary) {
    if (!trip || !summary) return expenseEmptyMarkup('expenses');
    const active = state.expense.activeTripId === trip.id;
    const records = summary.expenseItems;
    return `
      <div class="expense-total-card">
        <span>本趟额外支出 · ${records.length} 笔</span>
        <strong>${formatMoneyCNY(summary.expenseCny)}</strong>
      </div>
      <section class="expense-section" aria-labelledby="expenseRecordsHeading" style="margin-top:0">
        <div class="expense-section-head">
          <h2 id="expenseRecordsHeading">${icon('receipt')} 支出记录</h2>
          <span class="section-note">${active ? '可在下方继续添加' : '已结束，只读'}</span>
        </div>
        ${records.length
          ? `<div class="expense-records">${records.map((item) => expenseRecordMarkup(item, active, summary.hasRate)).join('')}</div>`
          : `<div class="expense-records"><div class="expense-empty-small">${icon('receipt')}<p>还没有额外支出<br>餐饮、交通、住宿等都可以记在这里</p></div></div>`
        }
      </section>
      <p class="expense-tip">${active
        ? '美元支出会按消费日期所在月份的汇率折算；人民币支出直接计入总额。'
        : '本次出差已结束，支出记录仅供查看。'
      }</p>`;
  }

  function renderExpenseSettings() {
    if (!isValidISOMonth(expenseMonth)) expenseMonth = currentMonthISO();
    const exactRate = Object.prototype.hasOwnProperty.call(state.expense.rates, expenseMonth)
      ? Number(state.expense.rates[expenseMonth])
      : null;
    const fallbackRate = exactRate == null ? resolveExpenseRate(expenseMonth) : null;
    const rates = Object.entries(state.expense.rates)
      .filter(([month]) => isValidISOMonth(month))
      .sort(([a], [b]) => b.localeCompare(a));
    const rateChips = rates.length
      ? `<div class="rate-list">${rates.map(([month, rate]) => `<span class="rate-chip">${escapeHTML(formatExpenseMonthLabel(month))} · ${formatPlainAmount(rate)}</span>`).join('')}</div>`
      : '';
    let rateHint = '未设置时，会沿用最近一个已设置月份的汇率。';
    if (exactRate == null && fallbackRate && fallbackRate.hasRate) {
      rateHint = `当前将沿用 ${formatExpenseMonthLabel(fallbackRate.sourceMonth)} 的汇率 ${formatPlainAmount(fallbackRate.rate)}。`;
    }
    return `
      <section class="expense-card">
        <h2>汇率设置（按月）</h2>
        <p class="expense-hint">每个月可单独设置「1 美元 = X 人民币」；出差按每天所在月份的汇率折算。${escapeHTML(rateHint)}</p>
        <div class="month-switcher">
          <button type="button" data-action="expense-shift-month" data-delta="-1" aria-label="上一个月">${icon('chevron-right')}</button>
          <strong>${escapeHTML(formatExpenseMonthLabel(expenseMonth))}</strong>
          <button type="button" data-action="expense-shift-month" data-delta="1" aria-label="下一个月">${icon('chevron-right')}</button>
        </div>
        <div class="field">
          <label for="expenseRateInput">1 美元 = ? 人民币</label>
          <input class="text-input" id="expenseRateInput" type="text" inputmode="decimal" autocomplete="off" placeholder="例如：7.20" value="${exactRate == null ? '' : formatInputNumber(exactRate)}">
        </div>
        <button class="button button-soft button-wide" type="button" data-action="expense-save-rate">${icon('check')}保存 ${escapeHTML(formatExpenseMonthLabel(expenseMonth))} 汇率</button>
        ${rateChips}
      </section>
      <section class="expense-card">
        <h2>每日补贴默认值</h2>
        <p class="expense-hint">国外补贴按美元计算并乘汇率；国内补贴直接用人民币计算。</p>
        <div class="expense-two-col">
          <div class="field">
            <label for="expenseForeignAllowance">国外 / 美元</label>
            <input class="text-input" id="expenseForeignAllowance" type="text" inputmode="decimal" autocomplete="off" value="${formatInputNumber(state.expense.allowances.foreign)}">
          </div>
          <div class="field">
            <label for="expenseDomesticAllowance">国内 / 人民币</label>
            <input class="text-input" id="expenseDomesticAllowance" type="text" inputmode="decimal" autocomplete="off" value="${formatInputNumber(state.expense.allowances.domestic)}">
          </div>
        </div>
        <button class="button button-soft button-wide" type="button" data-action="expense-save-allowances">${icon('check')}保存补贴默认值</button>
      </section>
      <section class="expense-card">
        <h2>按天单独调整</h2>
        <p class="expense-hint">在「概览 → 每日明细」里点按某一日，可切换国内 / 国外；点右侧铅笔可单独修改当天国外补贴，也可以同时设为后续默认值。</p>
        <div class="expense-settings-note">${icon('shield')}所有费用数据只保存在本机，并会一起写入「行囊」的 JSON 备份。</div>
      </section>`;
  }

  function renderExpensePage() {
    const content = $('#expenseContent');
    if (!content) return;
    if (!['overview', 'expenses', 'settings'].includes(expenseTab)) expenseTab = 'overview';
    if (!isValidISOMonth(expenseMonth)) expenseMonth = currentMonthISO();
    updateExpenseTabs();
    const trip = getDisplayedExpenseTrip();
    const summary = trip ? computeExpenseSummary(trip) : null;
    if (expenseTab === 'overview') {
      content.innerHTML = trip ? renderExpenseOverview(trip, summary) : expenseEmptyMarkup('overview');
    } else if (expenseTab === 'expenses') {
      content.innerHTML = renderExpenseExpenses(trip, summary);
    } else {
      content.innerHTML = renderExpenseSettings();
    }
    updateExpensePrimaryButton();
    updateExpenseButton();
  }

  /* ---------------- Settings ---------------- */

  function renderSettings() {
    if (!state) return;
    renderThemeSegment();
    const installState = $('#installState');
    if (installState) {
      if (isStandalone()) installState.textContent = '已安装';
      else if (installPrompt) installState.textContent = '去安装';
      else installState.textContent = '查看方法';
    }
    const backupFootnote = $('#backupFootnote');
    if (backupFootnote) {
      if (!storageAvailable) {
        backupFootnote.textContent = '当前浏览器限制了本地存储，请尽快导出备份';
      } else if (state.settings.lastBackupAt) {
        backupFootnote.textContent = `上次备份：${formatDate(state.settings.lastBackupAt)}`;
      } else {
        backupFootnote.textContent = '还没有导出过备份';
      }
    }
  }

  /* ---------------- Search ---------------- */

  function getSearchResults(query) {
    const q = cleanText(query, 40).toLocaleLowerCase();
    if (!q) return [];
    const results = [];
    for (const pkg of state.packages) {
      const packageMatches = pkg.name.toLocaleLowerCase().includes(q);
      for (const item of pkg.items) {
        const category = catInfo(item.cat);
        const haystack = [
          item.name, item.note, category.label, pkg.name
        ].join(' ').toLocaleLowerCase();
        if (packageMatches || haystack.includes(q)) results.push({ pkg, item });
      }
    }
    return results;
  }

  function renderSearch() {
    const content = $('#searchContent');
    if (!content) return;
    const input = $('#searchInput');
    if (input && input.value !== searchQuery) input.value = searchQuery;
    const clearBtn = $('#searchClearBtn');
    if (clearBtn) clearBtn.hidden = !searchQuery;

    if (!searchQuery) {
      const fixedEntries = getFixedEntries();
      const quickEntries = fixedEntries.length ? fixedEntries.slice(0, 10) : allItems().slice(0, 10);
      const quickTitle = fixedEntries.length ? '固定物品' : '清单里的物品';
      const packageChips = state.packages.map((pkg) => `
        <button class="quick-chip tone-${pkgTone(pkg)}" type="button" data-action="search-open-package" data-package-id="${escapeHTML(pkg.id)}">
          <span class="quick-tone"></span>${escapeHTML(pkg.name)}
          ${icon('chevron-right')}
        </button>`).join('');
      const itemChips = quickEntries.map(({ pkg, item }) => `
        <button class="quick-chip tone-${pkgTone(pkg)}" type="button" data-action="open-search-result" data-package-id="${escapeHTML(pkg.id)}" data-item-id="${escapeHTML(item.id)}">
          <span class="quick-tone"></span>${escapeHTML(item.name)}
        </button>`).join('');

      if (!state.packages.length) {
        content.innerHTML = `
          <div class="search-intro">
            <h1>找一件东西</h1>
            <p>输入物品名称，就能看到它在哪个包裹里。</p>
          </div>
          <div class="search-empty">
            <span class="search-empty-orb">${icon('search')}</span>
            <h2>清单还是空的</h2>
            <p>先回首页建一个包裹，把出差要带的东西装进去。</p>
          </div>`;
        return;
      }

      content.innerHTML = `
        <div class="search-intro">
          <h1>找一件东西</h1>
          <p>输入物品名称或备注，快速看到它在哪个包裹、有没有装好。</p>
        </div>
        <section class="search-block">
          <h2>按包裹找</h2>
          <div class="quick-grid">${packageChips}</div>
        </section>
        ${quickEntries.length ? `
          <section class="search-block">
            <h2>${quickTitle}</h2>
            <div class="quick-grid">${itemChips}</div>
          </section>` : ''}`;
      return;
    }

    const results = getSearchResults(searchQuery);
    if (!results.length) {
      content.innerHTML = `
        <div class="search-empty">
          <span class="search-empty-orb">${icon('search')}</span>
          <h2>没找到「${escapeHTML(searchQuery)}」</h2>
          <p>试试更短的关键词，或者换个叫法。也可能是还没有把它加进清单。</p>
        </div>`;
      return;
    }

    const grouped = new Map();
    for (const result of results) {
      if (!grouped.has(result.pkg.id)) grouped.set(result.pkg.id, { pkg: result.pkg, items: [] });
      grouped.get(result.pkg.id).items.push(result.item);
    }

    const groupsMarkup = Array.from(grouped.values()).map(({ pkg, items }) => `
      <section class="search-result-group">
        <div class="search-result-group-head tone-${pkgTone(pkg)}"><span></span>${escapeHTML(pkg.name)}<b>· ${items.length}</b></div>
        <div class="search-result-list">
          ${items.map((item) => {
            const category = catInfo(item.cat);
            const statusClass = item.checked ? 'is-done' : item.fixed ? 'is-fixed' : '';
            const statusIcon = item.checked ? 'check' : item.fixed ? 'pin' : '';
            return `
              <button class="search-result" type="button" data-action="open-search-result" data-package-id="${escapeHTML(pkg.id)}" data-item-id="${escapeHTML(item.id)}">
                <span class="item-icon cat-${escapeHTML(category.key)}" aria-hidden="true">${icon(category.icon)}</span>
                <span class="search-result-main">
                  <span class="search-result-name">${markMatch(item.name, searchQuery)}</span>
                  <span class="search-result-sub">${escapeHTML(category.label)}${item.qty > 1 ? ` · ×${item.qty}` : ''}${item.note ? ` · ${escapeHTML(item.note)}` : ''}</span>
                </span>
                <span class="search-status ${statusClass}" aria-label="${item.checked ? '已带' : item.fixed ? '固定物品，待带' : '待带'}">${statusIcon ? icon(statusIcon) : ''}</span>
                ${icon('chevron-right', 'search-chevron')}
              </button>`;
          }).join('')}
        </div>
      </section>`).join('');

    content.innerHTML = `
      <p class="search-count">找到 ${results.length} 件物品</p>
      ${groupsMarkup}`;
  }

  function openSearchResult(packageId, itemId) {
    const pkg = getPackageById(packageId);
    if (!pkg) return;
    if (itemId && !pkg.items.some((item) => item.id === itemId)) return;
    detailFilter = 'all';
    pushLayer({ type: 'detail', id: packageId, highlight: itemId || null });
    const scroll = $('#detailScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  /* ---------------- Sheet rendering ---------------- */

  function renderSheet(sheet) {
    const body = $('#sheetBody');
    const title = $('#sheetTitle');
    const subtitle = $('#sheetSubtitle');
    const root = $('#sheetRoot');
    if (!body || !title || !subtitle || !root) return;
    root.hidden = false;
    title.textContent = sheet.title || '';
    subtitle.textContent = sheet.subtitle || '';
    subtitle.hidden = !sheet.subtitle;
    body.scrollTop = 0;
    currentSheetRef = sheet;

    if (sheet.kind === 'item') renderItemSheet(sheet);
    else if (sheet.kind === 'package') renderPackageSheet(sheet);
    else if (sheet.kind === 'todo') renderTodoSheet(sheet);
    else if (sheet.kind === 'todoList') renderTodoListSheet(sheet);
    else if (sheet.kind === 'expenseTripDate') renderExpenseTripDateSheet(sheet);
    else if (sheet.kind === 'expenseAdd') renderExpenseAddSheet(sheet);
    else if (sheet.kind === 'expenseDay') renderExpenseDaySheet(sheet);
    else if (sheet.kind === 'expenseReport') renderExpenseReportSheet(sheet);
    else if (sheet.kind === 'menu') renderMenuSheet(sheet);
    else if (sheet.kind === 'confirm') renderConfirmSheet(sheet);
    else if (sheet.kind === 'newTrip') renderNewTripSheet(sheet);
    else if (sheet.kind === 'help') renderHelpSheet(sheet);
    else if (sheet.kind === 'install') renderInstallSheet(sheet);
    requestAnimationFrame(positionToast);
    window.setTimeout(positionToast, 380);
  }

  /* ----- Item editor ----- */

  function openItemSheet(packageId, itemId = null) {
    let pkg = getPackageById(packageId) || state.packages[0] || null;
    if (!pkg) {
      openPackageSheet();
      return;
    }
    const item = itemId ? pkg.items.find((entry) => entry.id === itemId) : null;
    if (!item) pkg = getPackageById(packageId) || pkg;
    const draft = item ? {
      mode: 'edit',
      id: item.id,
      originalPackageId: pkg.id,
      packageId: pkg.id,
      name: item.name,
      qty: item.qty,
      cat: item.cat,
      catAuto: false,
      note: item.note || '',
      fixed: item.fixed,
      checked: item.checked
    } : {
      mode: 'create',
      id: null,
      originalPackageId: null,
      packageId: pkg.id,
      name: '',
      qty: 1,
      cat: 'other',
      catAuto: true,
      note: '',
      fixed: false,
      checked: false
    };
    openSheet({
      kind: 'item',
      title: item ? '编辑物品' : '添加物品',
      subtitle: item ? `修改后保存到「${pkg.name}」` : `放进「${pkg.name}」，出发前逐件确认`,
      data: draft
    });
  }

  function renderItemSheet(sheet) {
    const body = $('#sheetBody');
    const draft = sheet.data;
    const pkg = getPackageById(draft.packageId) || state.packages[0];
    if (!body || !pkg) return;
    const existingNames = new Set(pkg.items.map((item) => item.name));
    const suggestions = DEFAULT_SUGGESTIONS.filter((name) => !existingNames.has(name)).slice(0, 6);
    const packageOptions = state.packages.map((entry) => `
      <option value="${escapeHTML(entry.id)}" ${entry.id === draft.packageId ? 'selected' : ''}>${escapeHTML(entry.name)}</option>`).join('');
    const categoryMarkup = CATEGORIES.map((category) => `
      <button class="cat-choice ${draft.cat === category.key ? 'is-active' : ''}" type="button" data-cat="${category.key}">
        ${icon(category.icon)}<span>${category.label}</span>
      </button>`).join('');

    body.innerHTML = `
      <form id="itemForm" novalidate>
        <div class="field">
          <label for="itemName">物品名称</label>
          <input class="text-input" id="itemName" name="itemName" type="text" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="例如：身份证、充电器" value="${escapeHTML(draft.name)}">
          ${suggestions.length ? `<div class="suggest-row" aria-label="常用物品">${suggestions.map((name) => `
            <button class="suggest-chip" type="button" data-suggestion="${escapeHTML(name)}">${icon('plus')}${escapeHTML(name)}</button>`).join('')}</div>` : ''}
        </div>
        <div class="field">
          <div class="field-label">放进哪个包裹</div>
          <div class="select-wrap">
            <select id="itemPackage" aria-label="所属包裹">${packageOptions}</select>
            ${icon('chevron-down')}
          </div>
        </div>
        <div class="field">
          <div class="field-label">分类 <span class="optional">用来配图标</span></div>
          <div class="cat-row" id="itemCatRow">${categoryMarkup}</div>
        </div>
        <div class="form-row">
          <div class="form-row-copy"><strong>数量</strong><small>同一个物品带几件</small></div>
          <div class="stepper">
            <button type="button" data-qty-step="-1" aria-label="减少数量" ${draft.qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
            <output id="itemQty" aria-label="数量">${draft.qty}</output>
            <button type="button" data-qty-step="1" aria-label="增加数量" ${draft.qty >= 999 ? 'disabled' : ''}>${icon('plus')}</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-row-copy"><strong>固定在这个包裹</strong><small>置顶显示，开启新行程后仍会保留</small></div>
          <button class="switch" id="itemFixedSwitch" type="button" role="switch" aria-checked="${draft.fixed}" aria-label="固定物品"></button>
        </div>
        <div class="field">
          <label for="itemNote">备注 <span class="optional">选填</span></label>
          <input class="text-input" id="itemNote" type="text" maxlength="80" autocomplete="off" placeholder="例如：放在侧袋 / 回程要带回来" value="${escapeHTML(draft.note)}">
        </div>
        <div class="form-actions">
          <button class="button button-ghost button-cancel" type="button" data-close-sheet>取消</button>
          <button class="button button-primary button-save" type="submit">${draft.mode === 'edit' ? '保存修改' : '添加物品'}</button>
        </div>
        ${draft.mode === 'edit' ? `<button class="danger-link" type="button" data-action="request-delete-item">${icon('trash')}删除这件物品</button>` : ''}
      </form>`;

    const form = $('#itemForm');
    const nameInput = $('#itemName');
    const noteInput = $('#itemNote');
    const qtyOutput = $('#itemQty');
    const fixedSwitch = $('#itemFixedSwitch');
    const packageSelect = $('#itemPackage');
    const subtitle = $('#sheetSubtitle');
    if (!form || !nameInput || !qtyOutput || !fixedSwitch || !packageSelect) return;

    const updateSubtitle = () => {
      const selectedPkg = getPackageById(draft.packageId);
      if (!selectedPkg || !subtitle) return;
      subtitle.textContent = draft.mode === 'edit'
        ? `修改后保存到「${selectedPkg.name}」`
        : `放进「${selectedPkg.name}」，出发前逐件确认`;
    };

    const updateCategorySelection = () => {
      $$('.cat-choice', body).forEach((button) => {
        button.classList.toggle('is-active', button.dataset.cat === draft.cat);
      });
    };

    nameInput.addEventListener('input', () => {
      draft.name = nameInput.value;
      nameInput.removeAttribute('aria-invalid');
      if (draft.catAuto) {
        draft.cat = inferCategory(nameInput.value);
        updateCategorySelection();
      }
    });

    packageSelect.addEventListener('change', () => {
      draft.packageId = packageSelect.value;
      updateSubtitle();
    });

    if (noteInput) {
      noteInput.addEventListener('input', () => { draft.note = noteInput.value; });
    }

    $$('.suggest-chip', body).forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.dataset.suggestion || '';
        nameInput.value = name;
        draft.name = name;
        if (draft.catAuto) {
          draft.cat = inferCategory(name);
          updateCategorySelection();
        }
        nameInput.focus();
      });
    });

    $$('.cat-choice', body).forEach((button) => {
      button.addEventListener('click', () => {
        draft.cat = button.dataset.cat || 'other';
        draft.catAuto = false;
        updateCategorySelection();
      });
    });

    $$('[data-qty-step]', body).forEach((button) => {
      button.addEventListener('click', () => {
        const step = Number(button.dataset.qtyStep) || 0;
        draft.qty = clampInt(draft.qty + step, 1, 999, 1);
        qtyOutput.textContent = String(draft.qty);
        const minus = $('[data-qty-step="-1"]', body);
        const plus = $('[data-qty-step="1"]', body);
        if (minus) minus.disabled = draft.qty <= 1;
        if (plus) plus.disabled = draft.qty >= 999;
      });
    });

    fixedSwitch.addEventListener('click', () => {
      draft.fixed = !draft.fixed;
      fixedSwitch.setAttribute('aria-checked', String(draft.fixed));
      haptic(6);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveItemSheet(sheet);
    });
  }

  function saveItemSheet(sheet) {
    const draft = sheet && sheet.data;
    if (!draft) return;
    const nameInput = $('#itemName');
    const name = normalizeName(draft.name, 40);
    if (!name) {
      if (nameInput) {
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
      }
      showToast('先给这件物品起个名字');
      haptic([8, 40, 8]);
      return;
    }
    const targetPkg = getPackageById(draft.packageId);
    if (!targetPkg) {
      showToast('这个包裹已经不存在了，请重新选择');
      return;
    }
    const category = CATEGORY_MAP.has(draft.cat) ? draft.cat : inferCategory(name);
    const qty = clampInt(draft.qty, 1, 999, 1);
    const note = normalizeName(draft.note, 80);

    let toastMessage = '';
    if (draft.mode === 'edit') {
      const sourcePkg = getPackageById(draft.originalPackageId);
      const item = sourcePkg ? sourcePkg.items.find((entry) => entry.id === draft.id) : null;
      if (!sourcePkg || !item) {
        showToast('这件物品已经不存在了');
        return;
      }
      const updated = Object.assign({}, item, {
        name,
        qty,
        cat: category,
        note,
        fixed: Boolean(draft.fixed)
      });
      if (sourcePkg.id !== targetPkg.id) {
        sourcePkg.items = sourcePkg.items.filter((entry) => entry.id !== item.id);
        targetPkg.items.push(updated);
      } else {
        const index = sourcePkg.items.findIndex((entry) => entry.id === item.id);
        if (index >= 0) sourcePkg.items[index] = updated;
      }
      toastMessage = `已保存「${name}」`;
    } else {
      targetPkg.items.push({
        id: makeId('item'),
        name,
        qty,
        cat: category,
        fixed: Boolean(draft.fixed),
        checked: false,
        note,
        createdAt: Date.now()
      });
      toastMessage = `已添加「${name}」`;
    }

    saveState();
    haptic(draft.mode === 'edit' ? 8 : 12);
    if (draft.mode === 'create') detailFilter = 'all';
    renderHome();
    const pageLayer = getPageLayer();
    if (pageLayer && pageLayer.type === 'detail') renderDetail(pageLayer);
    closeTopLayer();
    showToast(toastMessage);
    announce(`${toastMessage}，共 ${getGlobalStats().total} 件物品`);
  }

  function openDeleteItemConfirm(packageId, itemId) {
    const { pkg, item } = getItem(packageId, itemId);
    if (!pkg || !item) {
      showToast('这件物品已经不存在了');
      return;
    }
    replaceSheet({
      kind: 'confirm',
      title: '删除这件物品？',
      subtitle: '',
      data: {
        visual: 'danger',
        visualIcon: 'trash',
        text: `确定要从「<strong>${escapeHTML(pkg.name)}</strong>」删除「<strong>${escapeHTML(item.name)}</strong>」吗？删除后仍可撤销。`,
        confirmText: '删除',
        cancelText: '再想想',
        onConfirm: () => {
          const index = pkg.items.findIndex((entry) => entry.id === item.id);
          if (index < 0) {
            closeTopLayer();
            return;
          }
          const removed = pkg.items.splice(index, 1)[0];
          saveState();
          haptic(12);
          const activePage = getPageLayer();
          if (activePage && activePage.type === 'detail') renderDetail(activePage);
          renderHome();
          closeTopLayer();
          showToast(`已删除「${removed.name}」`, '撤销', () => {
            const livePkg = getPackageById(pkg.id);
            if (!livePkg) return;
            livePkg.items.splice(Math.min(index, livePkg.items.length), 0, removed);
            saveState();
            renderHome();
            const page = getPageLayer();
            if (page && page.type === 'detail') renderDetail(page);
            announce(`已恢复「${removed.name}」`);
          }, 5000);
        }
      }
    });
  }

  function renderTodoSheet(sheet) {
    const body = $('#sheetBody');
    const draft = sheet.data;
    if (!body) return;
    const suggestions = draft.mode === 'create' ? TODO_SUGGESTIONS : [];
    body.innerHTML = `
      <form id="todoForm" novalidate>
        <div class="field">
          <label for="todoTitle">待办内容</label>
          <input class="text-input" id="todoTitle" type="text" maxlength="60" autocomplete="off" placeholder="例如：回复邮件、购买日用品、预约时间" value="${escapeHTML(draft.title)}">
          ${suggestions.length ? `<div class="suggest-row" aria-label="常用待办">${suggestions.map((title) => `
            <button class="suggest-chip" type="button" data-todo-suggestion="${escapeHTML(title)}">${icon('plus')}${escapeHTML(title)}</button>`).join('')}</div>` : ''}
        </div>
        <div class="field">
          <label for="todoNote">备注 <span class="optional">选填</span></label>
          <input class="text-input" id="todoNote" type="text" maxlength="100" autocomplete="off" placeholder="例如：截止时间、需要携带的东西" value="${escapeHTML(draft.note)}">
        </div>
        <div class="form-row">
          <div class="form-row-copy"><strong>标记为已完成</strong><small>完成后也可以在列表里再取消</small></div>
          <button class="switch" id="todoCheckedSwitch" type="button" role="switch" aria-checked="${draft.checked}" aria-label="标记为已完成"></button>
        </div>
        <div class="form-actions">
          <button class="button button-ghost button-cancel" type="button" data-close-sheet>取消</button>
          <button class="button button-primary button-save" type="submit">${draft.mode === 'edit' ? '保存修改' : '添加待办'}</button>
        </div>
        ${draft.mode === 'edit' ? `<button class="danger-link" type="button" data-action="request-delete-todo">${icon('trash')}删除这条待办</button>` : ''}
      </form>`;

    const form = $('#todoForm');
    const titleInput = $('#todoTitle');
    const noteInput = $('#todoNote');
    const checkedSwitch = $('#todoCheckedSwitch');
    if (!form || !titleInput || !noteInput || !checkedSwitch) return;

    titleInput.addEventListener('input', () => {
      draft.title = titleInput.value;
      titleInput.removeAttribute('aria-invalid');
    });
    noteInput.addEventListener('input', () => { draft.note = noteInput.value; });
    checkedSwitch.addEventListener('click', () => {
      draft.checked = !draft.checked;
      checkedSwitch.setAttribute('aria-checked', String(draft.checked));
      haptic(6);
    });

    $$('[data-todo-suggestion]', body).forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.todoSuggestion || '';
        titleInput.value = value;
        draft.title = value;
        titleInput.focus();
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveTodoSheet(sheet);
    });
  }

  function saveTodoSheet(sheet) {
    const draft = sheet && sheet.data;
    if (!draft) return;
    const titleInput = $('#todoTitle');
    const title = normalizeName(draft.title, 60);
    if (!title) {
      if (titleInput) {
        titleInput.setAttribute('aria-invalid', 'true');
        titleInput.focus();
      }
      showToast('先写下要做的事');
      haptic([8, 40, 8]);
      return;
    }
    const note = normalizeName(draft.note, 120);
    if (draft.mode === 'edit') {
      const entry = findTodoEntry(draft.id);
      if (!entry) {
        showToast('这条待办已经不存在了');
        return;
      }
      entry.todo.title = title;
      entry.todo.note = note;
      entry.todo.checked = Boolean(draft.checked);
      saveState();
      haptic(8);
      refreshTodoViews();
      closeTopLayer();
      showToast(`已保存待办「${title}」`);
    } else {
      const list = getTodoListById(draft.listId);
      if (!list) {
        showToast('这份清单已经不存在了');
        return;
      }
      if (list.items.length >= MAX_TODOS_PER_LIST || getTodoStats().total >= MAX_TOTAL_TODOS) {
        showToast('这份清单的待办太多了');
        return;
      }
      list.items.push({
        id: makeId('todo'),
        title,
        note,
        checked: Boolean(draft.checked),
        createdAt: Date.now()
      });
      saveState();
      haptic(12);
      refreshTodoViews();
      closeTopLayer();
      showToast(`已添加待办「${title}」`);
    }
  }

  function openExpenseTripDateSheet(mode) {
    const active = getExpenseActiveTrip();
    if (mode === 'start' && active) return;
    if (mode === 'end' && !active) return;
    openSheet({
      kind: 'expenseTripDate',
      title: mode === 'start' ? '开始出差' : '结束出差',
      subtitle: mode === 'start' ? '选择出发日期，之后按自然日累计' : '首尾两天都计入补贴',
      data: {
        mode,
        tripId: active ? active.id : null,
        startDate: active ? active.startDate : null,
        date: todayISO()
      }
    });
  }

  function renderExpenseTripDateSheet(sheet) {
    const body = $('#sheetBody');
    const data = sheet.data;
    if (!body) return;
    const startDate = data.startDate || todayISO();
    const endMode = data.mode === 'end';
    const noRate = Object.keys(state.expense.rates).length === 0;
    body.innerHTML = `
      <form id="expenseTripForm" novalidate>
        <div class="trip-visual"><span class="trip-orb">${icon(endMode ? 'check' : 'calculator')}</span></div>
        <p class="confirm-text">${endMode
          ? '结束本次出差并生成最终报销金额。<br><strong>结束之后仍可查看，但不能再修改。</strong>'
          : '开始记录一趟新的出差。<br><strong>补贴会从开始日期起按自然日累计。</strong>'
        }</p>
        ${endMode ? `<div class="expense-day-summary"><strong>${escapeHTML(formatExpenseDate(startDate, true))}</strong><span>开始日期</span></div>` : ''}
        <div class="field">
          <label for="expenseTripDate">${endMode ? '结束日期' : '开始日期'}</label>
          <input class="text-input" id="expenseTripDate" type="date" value="${escapeHTML(data.date)}" max="${todayISO()}" ${endMode ? `min="${escapeHTML(startDate)}"` : ''}>
        </div>
        ${!endMode && noRate ? `<div class="expense-settings-note">${icon('info')}还没有设置汇率，开始后可以先补上；否则国外补贴会暂按 ¥0 计算。</div>` : ''}
        ${endMode ? `<div class="expense-settings-note">${icon('info')}确认后，本次出差会转为已完成，仍可复制提报文本。</div>` : ''}
        <div class="form-actions">
          <button class="button button-ghost button-cancel" type="button" data-close-sheet>取消</button>
          <button class="button button-primary button-save" type="submit">${endMode ? '确认结束' : '开始出差'}</button>
        </div>
      </form>`;
    const form = $('#expenseTripForm');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveExpenseTripDate(sheet);
    });
  }

  function saveExpenseTripDate(sheet) {
    const data = sheet && sheet.data;
    const input = $('#expenseTripDate');
    if (!data || !input) return;
    const date = input.value;
    if (!isValidISODate(date)) {
      showToast('请选择有效日期');
      return;
    }
    if (date > todayISO()) {
      showToast('日期不能晚于今天');
      return;
    }
    if (data.mode === 'start') {
      if (getExpenseActiveTrip()) {
        closeTopLayer();
        return;
      }
      const trip = {
        id: makeId('xtrip'),
        startDate: date,
        endDate: null,
        status: 'active',
        createdAt: Date.now(),
        dayNatures: {},
        dayAllowances: {}
      };
      state.expense.trips.push(trip);
      state.expense.activeTripId = trip.id;
      expenseTab = 'overview';
      expenseMonth = monthOfISO(date);
      saveState();
      haptic(12);
      refreshExpenseViews();
      closeTopLayer();
      const noRate = Object.keys(state.expense.rates).length === 0;
      showToast(noRate ? '出差已开始，记得去设置里填写汇率' : '出差已开始，按天累计补贴');
      announce('出差已开始');
    } else {
      const trip = getExpenseActiveTrip();
      if (!trip || (data.tripId && trip.id !== data.tripId)) {
        showToast('当前没有进行中的出差');
        return;
      }
      if (date < trip.startDate) {
        showToast('结束日期不能早于开始日期');
        return;
      }
      trip.endDate = date;
      trip.status = 'finished';
      state.expense.activeTripId = null;
      expenseTab = 'overview';
      saveState();
      haptic(12);
      refreshExpenseViews();
      closeTopLayer();
      showToast('出差已结束，报销金额已生成');
      announce('出差已结束');
    }
  }

  function expenseRateHint(date, currency) {
    if (currency === 'CNY') return '人民币支出直接计入总额，不参与汇率折算。';
    const rateInfo = resolveExpenseRate(monthOfISO(date || todayISO()));
    if (!rateInfo.hasRate) return '尚未设置汇率，这笔美元支出会暂按 ¥0 折算。';
    return `按 ${formatExpenseMonthLabel(rateInfo.sourceMonth)} 汇率折算：1 美元 ≈ ${formatPlainAmount(rateInfo.rate)} 人民币。`;
  }

  function openExpenseAddSheet() {
    const active = getExpenseActiveTrip();
    if (!active) {
      showToast('请先开始出差，才能添加额外支出');
      return;
    }
    openSheet({
      kind: 'expenseAdd',
      title: '添加额外支出',
      subtitle: '美元会按支出日期所在月份的汇率折算',
      data: {
        amount: '',
        currency: 'USD',
        note: '',
        date: todayISO()
      }
    });
  }

  function renderExpenseAddSheet(sheet) {
    const body = $('#sheetBody');
    const data = sheet.data;
    if (!body) return;
    body.innerHTML = `
      <form id="expenseAddForm" novalidate>
        <div class="field">
          <label for="expenseAmount">金额</label>
          <input class="text-input" id="expenseAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="例如：120.00" value="${escapeHTML(data.amount)}">
        </div>
        <div class="field">
          <div class="field-label">货币单位</div>
          <div class="choice-group" role="group" aria-label="货币单位">
            <button type="button" data-expense-currency="USD" class="${data.currency === 'USD' ? 'is-active' : ''}" aria-pressed="${data.currency === 'USD'}">美元（原币）</button>
            <button type="button" data-expense-currency="CNY" class="${data.currency === 'CNY' ? 'is-active' : ''}" aria-pressed="${data.currency === 'CNY'}">人民币（已折算）</button>
          </div>
        </div>
        <div class="field">
          <label for="expenseDate">支出日期</label>
          <input class="text-input" id="expenseDate" type="date" value="${escapeHTML(data.date)}" max="${todayISO()}">
        </div>
        <div class="field">
          <label for="expenseNote">备注 <span class="optional">选填</span></label>
          <input class="text-input" id="expenseNote" type="text" maxlength="100" autocomplete="off" placeholder="例如：机场晚餐" value="${escapeHTML(data.note)}">
        </div>
        <div class="expense-settings-note" id="expenseAddRateHint">${icon('refresh')}${escapeHTML(expenseRateHint(data.date, data.currency))}</div>
        <div class="form-actions">
          <button class="button button-ghost button-cancel" type="button" data-close-sheet>取消</button>
          <button class="button button-primary button-save" type="submit">添加支出</button>
        </div>
      </form>`;
    const form = $('#expenseAddForm');
    const amountInput = $('#expenseAmount');
    const dateInput = $('#expenseDate');
    const noteInput = $('#expenseNote');
    if (!form || !amountInput || !dateInput) return;
    const updateHint = () => {
      data.date = dateInput.value;
      const hint = $('#expenseAddRateHint');
      if (hint) hint.innerHTML = `${icon('refresh')}${escapeHTML(expenseRateHint(data.date, data.currency))}`;
    };
    $$('[data-expense-currency]', body).forEach((button) => {
      button.addEventListener('click', () => {
        data.currency = button.dataset.expenseCurrency || 'USD';
        $$('[data-expense-currency]', body).forEach((entry) => {
          const active = entry === button;
          entry.classList.toggle('is-active', active);
          entry.setAttribute('aria-pressed', String(active));
        });
        updateHint();
      });
    });
    dateInput.addEventListener('change', updateHint);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveExpenseAddSheet(sheet, amountInput.value, noteInput ? noteInput.value : '');
    });
  }

  function saveExpenseAddSheet(sheet, amountValue, noteValue) {
    const active = getExpenseActiveTrip();
    if (!active) {
      showToast('请先开始出差');
      return;
    }
    const amount = parseAmountInput(amountValue);
    const date = $('#expenseDate') ? $('#expenseDate').value : sheet.data.date;
    if (!(amount > 0)) {
      const input = $('#expenseAmount');
      if (input) input.setAttribute('aria-invalid', 'true');
      showToast('请输入大于 0 的支出金额');
      return;
    }
    if (!isValidISODate(date)) {
      showToast('请选择有效日期');
      return;
    }
    if (date > todayISO()) {
      showToast('支出日期不能晚于今天');
      return;
    }
    const currency = sheet.data.currency === 'CNY' ? 'CNY' : 'USD';
    state.expense.expenses.push({
      id: makeId('xexp'),
      tripId: active.id,
      amount,
      currency,
      note: normalizeName(noteValue, 100),
      date,
      createdAt: Date.now()
    });
    expenseTab = 'expenses';
    saveState();
    haptic(10);
    refreshExpenseViews();
    closeTopLayer();
    const noRate = currency === 'USD' && !resolveExpenseRate(monthOfISO(date)).hasRate;
    showToast(noRate ? '已添加支出，但还没有设置汇率' : '额外支出已添加');
    announce('额外支出已添加');
  }

  function openExpenseDaySheet(date) {
    const active = getExpenseActiveTrip();
    if (!active || !isValidISODate(date)) return;
    const summary = computeExpenseSummary(active);
    const item = summary && summary.daily.find((day) => day.date === date);
    if (!item) return;
    openSheet({
      kind: 'expenseDay',
      title: '修改当天补贴',
      subtitle: formatExpenseDate(date, true),
      data: {
        date,
        nature: item.isForeign ? 'foreign' : 'domestic',
        amount: item.isForeign ? item.originalAmount : state.expense.allowances.foreign,
        hasOverride: item.hasOverride,
        alsoDefault: false
      }
    });
  }

  function renderExpenseDaySheet(sheet) {
    const body = $('#sheetBody');
    const data = sheet.data;
    if (!body) return;
    body.innerHTML = `
      <form id="expenseDayForm" novalidate>
        <div class="expense-day-summary">
          <strong>${escapeHTML(formatExpenseDate(data.date, true))}</strong>
          <span>${escapeHTML(formatExpenseWeekday(data.date))}</span>
        </div>
        <div class="field">
          <div class="field-label">当天补贴性质</div>
          <div class="choice-group" role="group" aria-label="当天补贴性质">
            <button type="button" data-day-nature="foreign" class="${data.nature === 'foreign' ? 'is-active' : ''}" aria-pressed="${data.nature === 'foreign'}">国外补贴</button>
            <button type="button" data-day-nature="domestic" class="${data.nature === 'domestic' ? 'is-active' : ''}" aria-pressed="${data.nature === 'domestic'}">国内补贴</button>
          </div>
        </div>
        <div id="expenseDayAmountWrap">
          <div class="field">
            <label for="expenseDayAmount">当天国外补贴（美元）</label>
            <input class="text-input" id="expenseDayAmount" type="text" inputmode="decimal" autocomplete="off" value="${formatInputNumber(data.amount)}">
            <p class="input-hint">默认国外补贴为 ${formatPlainAmount(state.expense.allowances.foreign)} 美元/天；填写默认值即可取消自定义。</p>
          </div>
          <div class="form-row">
            <div class="form-row-copy"><strong>同时设为后续默认值</strong><small>之后新增的国外补贴日按这个金额计算</small></div>
            <button class="switch" id="expenseDayDefaultSwitch" type="button" role="switch" aria-checked="${data.alsoDefault}" aria-label="同时设为后续默认值"></button>
          </div>
        </div>
        <div class="expense-settings-note">${icon('info')}国内补贴不乘汇率；国外补贴按当天所在月份汇率折算。</div>
        <div class="form-actions">
          <button class="button button-ghost button-cancel" type="button" data-close-sheet>取消</button>
          <button class="button button-primary button-save" type="submit">保存当天设置</button>
        </div>
      </form>`;
    const form = $('#expenseDayForm');
    const amountWrap = $('#expenseDayAmountWrap');
    const amountInput = $('#expenseDayAmount');
    const defaultSwitch = $('#expenseDayDefaultSwitch');
    if (!form || !amountWrap) return;
    const updateNatureUI = () => {
      $$('[data-day-nature]', body).forEach((button) => {
        const active = button.dataset.dayNature === data.nature;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      amountWrap.hidden = data.nature !== 'foreign';
    };
    $$('[data-day-nature]', body).forEach((button) => {
      button.addEventListener('click', () => {
        data.nature = button.dataset.dayNature === 'domestic' ? 'domestic' : 'foreign';
        updateNatureUI();
      });
    });
    if (defaultSwitch) {
      defaultSwitch.addEventListener('click', () => {
        data.alsoDefault = !data.alsoDefault;
        defaultSwitch.setAttribute('aria-checked', String(data.alsoDefault));
        haptic(6);
      });
    }
    updateNatureUI();
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveExpenseDaySheet(sheet, amountInput ? amountInput.value : '');
    });
  }

  function saveExpenseDaySheet(sheet, amountValue) {
    const active = getExpenseActiveTrip();
    if (!active) {
      showToast('当前没有进行中的出差');
      return;
    }
    const data = sheet.data;
    const date = data.date;
    const isForeign = data.nature !== 'domestic';
    let amount = 0;
    if (isForeign) {
      amount = parseAmountInput(amountValue);
      if (!(amount > 0)) {
        showToast('请输入大于 0 的补贴金额');
        return;
      }
    }
    if (isForeign) {
      delete active.dayNatures[date];
      if (data.alsoDefault) {
        state.expense.allowances.foreign = amount;
        delete active.dayAllowances[date];
      } else if (amount !== state.expense.allowances.foreign) {
        active.dayAllowances[date] = amount;
      } else {
        delete active.dayAllowances[date];
      }
    } else {
      active.dayNatures[date] = 'domestic';
    }
    saveState();
    haptic(8);
    refreshExpenseViews();
    closeTopLayer();
    showToast('当天补贴设置已保存');
    announce('当天补贴设置已保存');
  }

  function toggleExpenseDayNature(date) {
    const active = getExpenseActiveTrip();
    if (!active || !isValidISODate(date)) return;
    if (active.dayNatures[date] === 'domestic') delete active.dayNatures[date];
    else active.dayNatures[date] = 'domestic';
    saveState();
    haptic(8);
    refreshExpenseViews();
    const isForeign = active.dayNatures[date] !== 'domestic';
    announce(`${formatExpenseDate(date)} 已切换为${isForeign ? '国外' : '国内'}补贴`);
  }

  function shiftExpenseMonth(delta) {
    expenseMonth = shiftMonthISO(expenseMonth, delta);
    renderExpensePage();
  }

  function saveExpenseRate() {
    const input = $('#expenseRateInput');
    if (!input) return;
    const rate = parseAmountInput(input.value);
    if (!(rate > 0)) {
      showToast('请输入大于 0 的汇率');
      input.focus();
      return;
    }
    state.expense.rates[expenseMonth] = rate;
    saveState();
    haptic(8);
    refreshExpenseViews();
    showToast(`${formatExpenseMonthLabel(expenseMonth)} 汇率已保存`);
    announce('汇率已保存');
  }

  function saveExpenseAllowances() {
    const foreignInput = $('#expenseForeignAllowance');
    const domesticInput = $('#expenseDomesticAllowance');
    if (!foreignInput || !domesticInput) return;
    const foreign = parseAmountInput(foreignInput.value);
    const domestic = parseAmountInput(domesticInput.value);
    if (!(foreign > 0) || !(domestic > 0)) {
      showToast('国外和国内补贴都需要大于 0');
      return;
    }
    state.expense.allowances.foreign = foreign;
    state.expense.allowances.domestic = domestic;
    saveState();
    haptic(8);
    refreshExpenseViews();
    showToast('每日补贴默认值已保存');
    announce('每日补贴默认值已保存');
  }

  function deleteExpenseItem(expenseId) {
    const active = getExpenseActiveTrip();
    if (!active) return;
    const index = state.expense.expenses.findIndex((expense) => expense.id === expenseId && expense.tripId === active.id);
    if (index < 0) return;
    const removed = state.expense.expenses.splice(index, 1)[0];
    saveState();
    haptic(10);
    refreshExpenseViews();
    showToast('这笔支出已删除', '撤销', () => {
      state.expense.expenses.splice(Math.min(index, state.expense.expenses.length), 0, removed);
      saveState();
      refreshExpenseViews();
      announce('已恢复支出记录');
    }, 5000);
  }

  function buildExpenseReportText(summary) {
    if (!summary || !summary.trip) return '当前没有费用记录';
    const trip = summary.trip;
    const endText = trip.endDate ? formatExpenseDate(trip.endDate, true) : '至今';
    return [
      '出差费用提报',
      `日期：${formatExpenseDate(trip.startDate, true)} ~ ${endText}`,
      `总天数：${summary.totalDays}（国外 ${summary.foreignDays} 天 / 国内 ${summary.domesticDays} 天）`,
      `每日补贴合计：${formatMoneyCNY(summary.allowanceCny)}`,
      `额外支出合计：${formatMoneyCNY(summary.expenseCny)}`,
      `应报销总额：${formatMoneyCNY(summary.totalCny)}`
    ].join('\n');
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall back */ }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  async function copyExpenseReport() {
    const trip = getDisplayedExpenseTrip();
    if (!trip) {
      showToast('还没有可复制的出差费用');
      return;
    }
    const summary = computeExpenseSummary(trip);
    const text = buildExpenseReportText(summary);
    const copied = await copyTextToClipboard(text);
    if (copied) {
      showToast('提报文本已复制');
      announce('提报文本已复制');
      return;
    }
    openExpenseReportSheet(text);
  }

  function openExpenseReportSheet(text) {
    openSheet({
      kind: 'expenseReport',
      title: '提报文本',
      subtitle: '自动复制失败，可以长按选择文本',
      data: { text }
    });
  }

  function renderExpenseReportSheet(sheet) {
    const body = $('#sheetBody');
    if (!body) return;
    body.innerHTML = `
      <p class="input-hint" style="margin:0 2px 9px">长按文本框选择，或点「全选」后再复制。</p>
      <textarea class="textarea-input expense-report-text" id="expenseReportText" readonly>${escapeHTML(sheet.data.text)}</textarea>
      <div class="form-actions">
        <button class="button button-ghost button-cancel" type="button" id="expenseReportSelect">全选</button>
        <button class="button button-primary button-save" type="button" data-close-sheet>知道了</button>
      </div>`;
    const textarea = $('#expenseReportText');
    const selectButton = $('#expenseReportSelect');
    if (selectButton && textarea) {
      selectButton.addEventListener('click', () => {
        textarea.focus();
        textarea.select();
      });
    }
  }

  /* ----- Package editor ----- */

  function openPackageSheet(packageId = null) {
    if (packageId && !getPackageById(packageId)) return;
    if (!packageId && state.packages.length >= MAX_PACKAGES) {
      showToast(`最多只能建 ${MAX_PACKAGES} 个包裹`);
      return;
    }
    const pkg = packageId ? getPackageById(packageId) : null;
    const draft = pkg ? {
      mode: 'edit',
      id: pkg.id,
      name: pkg.name,
      icon: pkg.icon,
      color: pkg.color
    } : {
      mode: 'create',
      id: null,
      name: '',
      icon: 'luggage',
      color: PACKAGE_COLORS[state.packages.length % PACKAGE_COLORS.length].key
    };
    openSheet({
      kind: 'package',
      title: pkg ? '编辑包裹' : '新建包裹',
      subtitle: pkg ? `${pkg.items.length} 件物品 · 可以改名换图标` : '给包裹起个名字，再选一个图标',
      data: draft
    });
  }

  function packagePreviewMarkup(draft, pkg) {
    const count = pkg ? pkg.items.length : 0;
    const fixedCount = pkg ? pkg.items.filter((item) => item.fixed).length : 0;
    return `
      <div class="package-preview tone-${escapeHTML(draft.color)}" id="packagePreview">
        <span class="pkg-icon" id="packagePreviewIcon">${icon(draft.icon)}</span>
        <div class="package-preview-copy">
          <strong id="packagePreviewName">${escapeHTML(draft.name || '未命名包裹')}</strong>
          <small id="packagePreviewMeta">${count} 件物品${fixedCount ? ` · 固定 ${fixedCount}` : ''}</small>
        </div>
      </div>`;
  }

  function renderPackageSheet(sheet) {
    const body = $('#sheetBody');
    const draft = sheet.data;
    const pkg = draft.id ? getPackageById(draft.id) : null;
    if (!body) return;
    const iconChoices = PACKAGE_ICONS.map((entry) => `
      <button class="icon-choice ${draft.icon === entry.key ? 'is-active' : ''}" type="button" data-pkg-icon="${entry.key}" aria-label="${entry.label}" aria-pressed="${draft.icon === entry.key}">
        ${icon(entry.key)}
      </button>`).join('');
    const colorChoices = PACKAGE_COLORS.map((color) => `
      <button class="color-choice tone-${color.key} ${draft.color === color.key ? 'is-active' : ''}" type="button" data-pkg-color="${color.key}" aria-label="${color.label}" aria-pressed="${draft.color === color.key}">
        ${icon('check')}
      </button>`).join('');

    body.innerHTML = `
      <form id="packageForm" novalidate>
        ${packagePreviewMarkup(draft, pkg)}
        <div class="field">
          <label for="packageName">包裹名称</label>
          <input class="text-input" id="packageName" type="text" maxlength="20" autocomplete="off" placeholder="例如：行李箱" value="${escapeHTML(draft.name)}">
        </div>
        <div class="field">
          <div class="field-label">图标</div>
          <div class="icon-picker" aria-label="选择图标">${iconChoices}</div>
        </div>
        <div class="field">
          <div class="field-label">颜色</div>
          <div class="color-picker" aria-label="选择颜色">${colorChoices}</div>
        </div>
        <div class="form-actions">
          <button class="button button-ghost button-cancel" type="button" data-close-sheet>取消</button>
          <button class="button button-primary button-save" type="submit">${draft.mode === 'edit' ? '保存修改' : '创建包裹'}</button>
        </div>
        ${draft.mode === 'edit' ? `<button class="danger-link" type="button" data-action="request-delete-package">${icon('trash')}删除这个包裹</button>` : ''}
      </form>`;

    const form = $('#packageForm');
    const nameInput = $('#packageName');
    const preview = $('#packagePreview');
    const previewName = $('#packagePreviewName');
    if (!form || !nameInput) return;

    nameInput.addEventListener('input', () => {
      draft.name = nameInput.value;
      nameInput.removeAttribute('aria-invalid');
      if (previewName) previewName.textContent = draft.name || '未命名包裹';
    });

    $$('[data-pkg-icon]', body).forEach((button) => {
      button.addEventListener('click', () => {
        draft.icon = button.dataset.pkgIcon || 'luggage';
        $$('[data-pkg-icon]', body).forEach((entry) => {
          const active = entry === button;
          entry.classList.toggle('is-active', active);
          entry.setAttribute('aria-pressed', String(active));
        });
        const previewIcon = $('#packagePreviewIcon');
        if (previewIcon) previewIcon.innerHTML = icon(draft.icon);
      });
    });

    $$('[data-pkg-color]', body).forEach((button) => {
      button.addEventListener('click', () => {
        draft.color = button.dataset.pkgColor || 'orange';
        $$('[data-pkg-color]', body).forEach((entry) => {
          const active = entry === button;
          entry.classList.toggle('is-active', active);
          entry.setAttribute('aria-pressed', String(active));
        });
        if (preview) {
          const classes = preview.className.split(/\s+/).filter((name) => !name.startsWith('tone-'));
          preview.className = classes.join(' ');
          preview.classList.add(`tone-${draft.color}`);
        }
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      savePackageSheet(sheet);
    });
  }

  function savePackageSheet(sheet) {
    const draft = sheet && sheet.data;
    if (!draft) return;
    const nameInput = $('#packageName');
    const name = normalizeName(draft.name, 20);
    if (!name) {
      if (nameInput) {
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
      }
      showToast('先给包裹起个名字');
      return;
    }
    if (draft.mode === 'edit') {
      const pkg = getPackageById(draft.id);
      if (!pkg) {
        showToast('这个包裹已经不存在了');
        return;
      }
      pkg.name = name;
      pkg.icon = PACKAGE_ICON_KEYS.has(draft.icon) ? draft.icon : 'luggage';
      pkg.color = PACKAGE_COLOR_KEYS.has(draft.color) ? draft.color : 'orange';
      saveState();
      renderHome();
      const page = getPageLayer();
      if (page && page.type === 'detail') renderDetail(page);
      closeTopLayer();
      showToast(`已保存「${name}」`);
    } else {
      if (state.packages.length >= MAX_PACKAGES) {
        showToast(`最多只能建 ${MAX_PACKAGES} 个包裹`);
        return;
      }
      const pkg = {
        id: makeId('pkg'),
        name,
        icon: PACKAGE_ICON_KEYS.has(draft.icon) ? draft.icon : 'luggage',
        color: PACKAGE_COLOR_KEYS.has(draft.color) ? draft.color : 'orange',
        items: [],
        createdAt: Date.now()
      };
      state.packages.push(pkg);
      saveState();
      haptic(12);
      renderHome();
      closeTopLayer();
      showToast(`「${name}」已建好，可以加物品了`);
      announce(`已新建包裹${name}`);
    }
  }

  function openDeletePackageConfirm(packageId) {
    const pkg = getPackageById(packageId);
    if (!pkg) return;
    const snapshot = {
      pkg: JSON.parse(JSON.stringify(pkg)),
      index: state.packages.findIndex((entry) => entry.id === pkg.id)
    };
    replaceSheet({
      kind: 'confirm',
      title: '删除这个包裹？',
      subtitle: '',
      data: {
        visual: 'danger',
        visualIcon: 'trash',
        text: `「<strong>${escapeHTML(pkg.name)}</strong>」里的 <strong>${pkg.items.length} 件物品</strong>也会一起删除。删除后仍可撤销。`,
        confirmText: '删除包裹',
        cancelText: '再想想',
        onConfirm: () => {
          const index = state.packages.findIndex((entry) => entry.id === packageId);
          if (index < 0) {
            closeTopLayer();
            return;
          }
          state.packages.splice(index, 1);
          saveState();
          haptic(16);
          renderHome();
          closeAllLayers();
          showToast(`已删除「${pkg.name}」`, '撤销', () => {
            state.packages.splice(Math.min(snapshot.index, state.packages.length), 0, snapshot.pkg);
            saveState();
            renderHome();
            announce(`已恢复包裹${pkg.name}`);
          }, 5200);
        }
      }
    });
  }

  /* ----- Item action menu ----- */

  function renderMenuSheet(sheet) {
    const body = $('#sheetBody');
    const data = sheet.data || {};
    const { pkg, item } = getItem(data.packageId, data.itemId);
    if (!body) return;
    if (!pkg || !item) {
      body.innerHTML = `<p class="confirm-text">这件物品已经不存在了。</p><div class="form-actions"><button class="button button-primary button-wide" type="button" data-close-sheet>关闭</button></div>`;
      return;
    }
    const category = catInfo(item.cat);
    body.innerHTML = `
      <div class="menu-preview">
        <span class="item-icon cat-${escapeHTML(category.key)}" aria-hidden="true">${icon(category.icon)}</span>
        <div class="menu-preview-copy">
          <strong>${escapeHTML(item.name)}</strong>
          <small>${escapeHTML(pkg.name)} · ${item.checked ? '已带' : '待带'}${item.fixed ? ' · 固定物品' : ''}${item.qty > 1 ? ` · ×${item.qty}` : ''}</small>
        </div>
      </div>
      <div class="menu-list">
        <button class="menu-action" type="button" data-action="menu-edit">
          <span class="menu-action-icon">${icon('pencil')}</span><span>编辑物品</span>${icon('chevron-right')}
        </button>
        <button class="menu-action" type="button" data-action="menu-toggle-check">
          <span class="menu-action-icon">${icon('check')}</span><span>${item.checked ? '取消已带' : '标记为已带'}</span>
          <span class="menu-hint">${item.checked ? '恢复待带' : '已装好'}</span>
        </button>
        <button class="menu-action" type="button" data-action="menu-toggle-fixed">
          <span class="menu-action-icon">${icon('pin')}</span><span>${item.fixed ? '取消固定' : '固定为每次必带'}</span>
          <span class="menu-hint">${item.fixed ? '移出固定' : '置顶显示'}</span>
        </button>
        <button class="menu-action danger" type="button" data-action="menu-delete">
          <span class="menu-action-icon">${icon('trash')}</span><span>删除物品</span>
        </button>
      </div>`;
  }

  /* ----- Confirm dialog ----- */

  function renderConfirmSheet(sheet) {
    const body = $('#sheetBody');
    if (!body) return;
    const data = sheet.data || {};
    const visualClass = data.visual === 'accent' ? 'is-accent' : data.visual === 'good' ? 'is-good' : '';
    body.innerHTML = `
      <div class="confirm-visual ${visualClass}">${icon(data.visualIcon || 'info')}</div>
      <p class="confirm-text">${data.text || ''}</p>
      <div class="confirm-actions">
        <button class="button button-ghost" type="button" data-close-sheet>${escapeHTML(data.cancelText || '取消')}</button>
        <button class="button ${data.visual === 'danger' ? 'button-danger' : 'button-primary'}" type="button" data-action="confirm-action">${escapeHTML(data.confirmText || '确认')}</button>
      </div>`;
  }

  function openConfirm(config) {
    const sheet = {
      kind: 'confirm',
      title: config.title,
      subtitle: config.subtitle || '',
      data: {
        visual: config.visual || 'danger',
        visualIcon: config.visualIcon || 'info',
        text: config.text || '',
        confirmText: config.confirmText || '确认',
        cancelText: config.cancelText || '取消',
        onConfirm: config.onConfirm
      }
    };
    openSheet(sheet);
  }

  function confirmActiveSheet() {
    const sheet = getSheetLayer() && getSheetLayer().sheet;
    if (!sheet || sheet.kind !== 'confirm' || !sheet.data || typeof sheet.data.onConfirm !== 'function' || sheet.busy) return;
    sheet.busy = true;
    haptic(10);
    try {
      sheet.data.onConfirm();
    } catch (error) {
      console.error(error);
      sheet.busy = false;
      showToast('操作失败，请稍后再试');
    }
  }

  /* ----- New trip ----- */

  function openNewTripSheet() {
    const stats = getGlobalStats();
    if (!stats.total) return;
    openSheet({
      kind: 'newTrip',
      title: '开启新行程',
      subtitle: '只重置物品勾选，待办清单不受影响',
      data: {
        autoFixed: Boolean(state.settings.autoCheckFixedOnNewTrip)
      }
    });
  }

  function renderNewTripSheet(sheet) {
    const body = $('#sheetBody');
    if (!body) return;
    const stats = getGlobalStats();
    const autoFixed = Boolean(sheet.data.autoFixed);
    const checkedText = stats.done ? `当前已勾选 ${stats.done} 件物品` : '当前还没有勾选任何物品';
    body.innerHTML = `
      <div class="trip-visual"><span class="trip-orb">${icon('refresh')}</span></div>
      <p class="confirm-text">要重新开始本次行程吗？<br><strong>所有物品都会保留</strong>，已勾选状态将被清空。<br><strong>待办清单不会被重置。</strong></p>
      <div class="trip-options">
        <div class="form-row">
          <div class="form-row-copy"><strong>固定物品默认已带</strong><small>适合一直放在包里的常驻物品</small></div>
          <button class="switch" id="newTripFixedSwitch" type="button" role="switch" aria-checked="${autoFixed}" aria-label="固定物品默认已带"></button>
        </div>
      </div>
      <p class="trip-warning">${checkedText}。${stats.fixed ? `开启后，固定物品${autoFixed ? '会自动标记为已带' : '仍需要逐件确认'}。` : ''}待办清单和其中的完成状态都不会改变。</p>
      <div class="form-actions">
        <button class="button button-ghost button-cancel" type="button" data-close-sheet>取消</button>
        <button class="button button-primary button-save" type="button" data-action="start-new-trip">开始新行程</button>
      </div>`;
    const fixedSwitch = $('#newTripFixedSwitch');
    if (fixedSwitch) {
      fixedSwitch.addEventListener('click', () => {
        sheet.data.autoFixed = !sheet.data.autoFixed;
        fixedSwitch.setAttribute('aria-checked', String(sheet.data.autoFixed));
        haptic(6);
      });
    }
  }

  function startNewTrip() {
    const sheet = getSheetLayer() && getSheetLayer().sheet;
    if (!sheet || sheet.kind !== 'newTrip') return;
    const previousAuto = state.settings.autoCheckFixedOnNewTrip;
    const snapshot = snapshotChecks();
    const autoFixed = Boolean(sheet.data.autoFixed);
    state.settings.autoCheckFixedOnNewTrip = autoFixed;
    resetChecks({ autoCheckFixed: autoFixed });
    saveState();
    haptic([12, 40, 12]);
    renderHome();
    closeTopLayer();
    const checkedNow = getGlobalStats().done;
    let tripMessage = '新行程已开始，逐件确认吧';
    if (autoFixed && checkedNow) tripMessage = `新行程已开始，已预勾选 ${checkedNow} 件固定物品`;
    showToast(tripMessage, '撤销', () => {
      restoreChecks(snapshot);
      state.settings.autoCheckFixedOnNewTrip = previousAuto;
      saveState();
      renderHome();
      announce('已撤销新行程');
    }, 5200);
    announce('新行程已开始，待办清单保持不变');
  }

  /* ----- Help / install ----- */

  function openHelpSheet() {
    openSheet({ kind: 'help', title: '使用说明', subtitle: '一分钟上手行囊', data: {} });
  }

  function renderHelpSheet() {
    const body = $('#sheetBody');
    if (!body) return;
    body.innerHTML = `
      <div class="help-hero">
        <span class="help-hero-orb">${icon('sparkles')}</span>
        <h3>出差前，把物品、待办和费用理清</h3>
        <p>不需要记性，只需要顺着清单看一眼。</p>
      </div>
      <div class="help-steps">
        <div class="help-step">
          <span class="help-step-num">1</span>
          <div class="help-step-copy"><strong>建包裹，装物品</strong><p>行李箱、随身背包、电脑包分开管理，点击包裹进入清点。</p></div>
        </div>
        <div class="help-step">
          <span class="help-step-num">2</span>
          <div class="help-step-copy"><strong>用图钉固定常驻物品</strong><p>身份证、充电器、工牌这类每次必带的，点右侧图钉固定，会一直在顶部置顶。</p></div>
        </div>
        <div class="help-step">
          <span class="help-step-num">3</span>
          <div class="help-step-copy"><strong>新建多份待办清单</strong><p>点首页顶部的待办图标，可以新建多份清单并分别命名；工作、购物、出行各自管理，点进清单再添加待办。</p></div>
        </div>
        <div class="help-step">
          <span class="help-step-num">4</span>
          <div class="help-step-copy"><strong>记录出差费用</strong><p>点首页顶部的计算器图标，开始出差后可设置按月汇率、每日补贴和额外支出，自动算出报销金额并复制提报文本。</p></div>
        </div>
        <div class="help-step">
          <span class="help-step-num">5</span>
          <div class="help-step-copy"><strong>出发前开启新行程</strong><p>只重置行囊物品的勾选状态，物品和待办内容都不会删除。待办清单和完成状态不受影响，费用模块也有独立的开始/结束出差按钮。</p></div>
        </div>
        <div class="help-step">
          <span class="help-step-num">6</span>
          <div class="help-step-copy"><strong>换手机前导出备份</strong><p>到「设置 → 数据 → 导出备份」，物品、待办清单和费用会一起写入 JSON 文件。</p></div>
        </div>
      </div>
      <div class="help-note"><strong>一个小提示：</strong>待办看右上角数字，费用看出差是否进行中；费用记录结束后仍可查看，但不能修改。</div>
      <div class="help-links">
        <button class="button button-primary button-wide" type="button" data-close-sheet>知道了</button>
      </div>`;
  }

  function openInstallGuide() {
    openSheet({ kind: 'install', title: '放到手机桌面', subtitle: '像 App 一样打开，离线可用', data: {} });
  }

  function renderInstallSheet() {
    const body = $('#sheetBody');
    if (!body) return;
    const canInstall = Boolean(installPrompt) && !isStandalone();
    body.innerHTML = `
      <div class="help-hero">
        <span class="help-hero-orb">${icon('smartphone')}</span>
        <h3>${isStandalone() ? '已经安装好了' : '把行囊放到桌面'}</h3>
        <p>${isStandalone() ? '主屏幕上的图标可以直接打开，断网也能清点。' : '用小米浏览器或 Chrome 打开本页，几步就能添加。'}</p>
      </div>
      <div class="help-steps">
        <div class="help-step">
          <span class="help-step-num">1</span>
          <div class="help-step-copy"><strong>用手机浏览器打开本页</strong><p>推荐 Chrome 或小米浏览器，不要用聊天软件的内置预览。</p></div>
        </div>
        <div class="help-step">
          <span class="help-step-num">2</span>
          <div class="help-step-copy"><strong>点浏览器的菜单</strong><p>通常在右下角或右上角，图标是「⋮」或「≡」。</p></div>
        </div>
        <div class="help-step">
          <span class="help-step-num">3</span>
          <div class="help-step-copy"><strong>选择「安装应用」或「添加到主屏幕」</strong><p>如果只看到「添加到主屏幕」，也可以创建快捷方式。</p></div>
        </div>
        <div class="help-step">
          <span class="help-step-num">4</span>
          <div class="help-step-copy"><strong>从桌面图标打开</strong><p>之后出差前直接点「行囊」，不用再找网页。</p></div>
        </div>
      </div>
      <div class="help-note"><strong>离线说明：</strong>通过 HTTPS 网站安装后，完整界面会缓存到手机；如果直接打开本地 HTML 文件，部分浏览器只支持添加书签，但清单功能仍然可用。<br><br><strong>记得备份：</strong>清理浏览器数据会删除本地清单，定期导出 JSON 备份更安心。</div>
      <div class="help-links">
        ${canInstall ? `<button class="button button-primary" type="button" data-action="install-now">现在安装</button>` : ''}
        <button class="button ${canInstall ? 'button-ghost' : 'button-primary'}" type="button" data-close-sheet>知道了</button>
      </div>`;
  }

  /* ---------------- Data actions ---------------- */

  function refreshDataViews() {
    renderHome();
    const pageLayer = getPageLayer();
    if (pageLayer && pageLayer.type === 'detail') renderDetail(pageLayer);
    else if (pageLayer && pageLayer.type === 'settings') renderSettings();
    else if (pageLayer && pageLayer.type === 'search') renderSearch();
    else if (pageLayer && pageLayer.type === 'todo') renderTodoPage();
    else if (pageLayer && pageLayer.type === 'todoList') renderTodoListPage(pageLayer);
  }

  function announceProgress(item) {
    const stats = getGlobalStats();
    const itemState = item && item.checked ? '已带' : '待带';
    if (stats.remaining === 0 && stats.total > 0) {
      announce(`${item ? `${item.name}${itemState}。` : ''}全部带齐，可以出发了`);
    } else {
      announce(`${item ? `${item.name}${itemState}。` : ''}还差 ${stats.remaining} 件`);
    }
  }

  function toggleItemChecked(packageId, itemId) {
    const { pkg, item } = getItem(packageId, itemId);
    if (!pkg || !item) return null;
    const before = getGlobalStats();
    item.checked = !item.checked;
    saveState();
    haptic(item.checked ? 10 : 7);
    refreshDataViews();
    const after = getGlobalStats();
    const justCompleted = item.checked && before.remaining > 0 && after.remaining === 0;
    if (justCompleted) {
      const todosLeft = getTodoStats().remaining;
      if (todosLeft === 0) {
        celebrate();
        haptic([10, 45, 10, 45, 20]);
        showToast('全部带齐，可以出发了！', '', null, 5000);
        announce('全部带齐，可以出发了');
      } else {
        haptic([10, 25, 10]);
        showToast(`物品全部带齐，还有 ${todosLeft} 项待办`, '', null, 4200);
        announce(`物品全部带齐，还有 ${todosLeft} 项待办`);
      }
    } else if (item.checked && getPackageStats(pkg).remaining === 0) {
      showToast(`「${pkg.name}」已全部带齐`, '', null, 2600);
      announce(`「${pkg.name}」已全部带齐，还差 ${after.remaining} 件`);
    } else {
      announceProgress(item);
    }
    return item;
  }

  function toggleItemFixed(packageId, itemId) {
    const { pkg, item } = getItem(packageId, itemId);
    if (!pkg || !item) return null;
    item.fixed = !item.fixed;
    saveState();
    haptic(8);
    refreshDataViews();
    const message = item.fixed ? `已固定「${item.name}」` : `已取消固定「${item.name}」`;
    showToast(message, '', null, 2300);
    announce(`${message}。固定物品每次开启新行程都会保留`);
    return item;
  }

  function toggleFixedChip(packageId, itemId) {
    return toggleItemChecked(packageId, itemId);
  }

  function checkAllFixedItems() {
    const entries = getFixedEntries().filter((entry) => !entry.item.checked);
    if (!entries.length) return;
    const snapshot = snapshotChecks();
    const before = getGlobalStats();
    for (const entry of entries) entry.item.checked = true;
    saveState();
    haptic([8, 30, 8]);
    renderHome();
    const pageLayer = getPageLayer();
    if (pageLayer && pageLayer.type === 'detail') renderDetail(pageLayer);
    const after = getGlobalStats();
    const completed = before.remaining > 0 && after.remaining === 0;
    const todosLeft = getTodoStats().remaining;
    const message = completed
      ? (todosLeft > 0 ? `物品全部带齐，还有 ${todosLeft} 项待办` : '全部带齐，可以出发了！')
      : `已勾选 ${entries.length} 件固定物品`;
    if (completed && todosLeft === 0) {
      celebrate();
      haptic([10, 45, 10, 45, 20]);
    } else if (completed) {
      haptic([10, 25, 10]);
    }
    showToast(message, '撤销', () => {
      restoreChecks(snapshot);
      saveState();
      renderHome();
      const page = getPageLayer();
      if (page && page.type === 'detail') renderDetail(page);
      updateTodoBadge();
      announce('已撤销勾选');
    }, completed ? 5400 : 4200);
    announce(`${entries.length} 件固定物品已勾选`);
  }

  function openItemMenu(packageId, itemId) {
    const { pkg, item } = getItem(packageId, itemId);
    if (!pkg || !item) return;
    openSheet({
      kind: 'menu',
      title: '物品操作',
      subtitle: pkg.name,
      data: { packageId, itemId }
    });
  }

  function handleAction(element) {
    const action = element.dataset.action;
    const packageId = element.dataset.packageId || '';
    const itemId = element.dataset.itemId || '';
    switch (action) {
      case 'open-package':
        openDetail(packageId);
        break;
      case 'add-package':
        openPackageSheet();
        break;
      case 'toggle-fixed-chip':
        toggleFixedChip(packageId, itemId);
        break;
      case 'scroll-to-packages':
        scrollToPackages();
        break;
      case 'set-filter':
        detailFilter = ['all', 'todo', 'done'].includes(element.dataset.filter) ? element.dataset.filter : 'all';
        if (getPageLayer() && getPageLayer().type === 'detail') renderDetail(getPageLayer());
        break;
      case 'toggle-item':
        toggleItemChecked(packageId, itemId);
        break;
      case 'toggle-pin':
        toggleItemFixed(packageId, itemId);
        break;
      case 'item-menu':
        openItemMenu(packageId, itemId);
        break;
      case 'add-item': {
        const targetId = packageId || (getPageLayer() && getPageLayer().type === 'detail' ? getPageLayer().id : '');
        if (targetId) openItemSheet(targetId);
        break;
      }
      case 'close-all':
        closeAllLayers();
        break;
      case 'open-search-result':
        openSearchResult(packageId, itemId || null);
        break;
      case 'search-open-package':
        openDetail(packageId);
        break;
      case 'toggle-todo':
        toggleTodoChecked(element.dataset.todoId || '');
        break;
      case 'edit-todo':
        openTodoSheet(element.dataset.todoId || null);
        break;
      case 'add-todo':
        openTodoSheet(null, element.dataset.listId || null);
        break;
      case 'request-delete-todo': {
        const sheet = getSheetLayer() && getSheetLayer().sheet;
        if (sheet && sheet.kind === 'todo' && sheet.data.mode === 'edit') openDeleteTodoConfirm(sheet.data.id);
        break;
      }
      case 'add-todo-list':
        openTodoListSheet();
        break;
      case 'open-todo-list':
        openTodoListPage(element.dataset.listId || '');
        break;
      case 'edit-todo-list':
        openTodoListSheet(element.dataset.listId || '', { source: 'overview' });
        break;
      case 'request-delete-todo-list': {
        const sheet = getSheetLayer() && getSheetLayer().sheet;
        if (sheet && sheet.kind === 'todoList' && sheet.data.mode === 'edit') openDeleteTodoListConfirm(sheet.data.id);
        break;
      }
      case 'toggle-expense-nature':
        toggleExpenseDayNature(element.dataset.expenseDate || '');
        break;
      case 'edit-expense-day':
        openExpenseDaySheet(element.dataset.expenseDate || '');
        break;
      case 'copy-expense-report':
        copyExpenseReport();
        break;
      case 'expense-go-settings':
        setExpenseTab('settings');
        break;
      case 'expense-shift-month':
        shiftExpenseMonth(Number(element.dataset.delta) || 0);
        break;
      case 'expense-save-rate':
        saveExpenseRate();
        break;
      case 'expense-save-allowances':
        saveExpenseAllowances();
        break;
      case 'delete-expense':
        deleteExpenseItem(element.dataset.expenseId || '');
        break;
      case 'menu-edit': {
        const sheet = getSheetLayer() && getSheetLayer().sheet;
        if (sheet && sheet.kind === 'menu') openItemSheet(sheet.data.packageId, sheet.data.itemId);
        break;
      }
      case 'menu-toggle-check': {
        const sheet = getSheetLayer() && getSheetLayer().sheet;
        if (sheet && sheet.kind === 'menu') {
          toggleItemChecked(sheet.data.packageId, sheet.data.itemId);
          closeTopLayer();
        }
        break;
      }
      case 'menu-toggle-fixed': {
        const sheet = getSheetLayer() && getSheetLayer().sheet;
        if (sheet && sheet.kind === 'menu') {
          toggleItemFixed(sheet.data.packageId, sheet.data.itemId);
          closeTopLayer();
        }
        break;
      }
      case 'menu-delete': {
        const sheet = getSheetLayer() && getSheetLayer().sheet;
        if (sheet && sheet.kind === 'menu') openDeleteItemConfirm(sheet.data.packageId, sheet.data.itemId);
        break;
      }
      case 'request-delete-item': {
        const sheet = getSheetLayer() && getSheetLayer().sheet;
        if (!sheet) break;
        if (sheet.kind === 'item') {
          openDeleteItemConfirm(sheet.data.originalPackageId, sheet.data.id);
        } else if (sheet.kind === 'menu') {
          openDeleteItemConfirm(sheet.data.packageId, sheet.data.itemId);
        }
        break;
      }
      case 'request-delete-package': {
        const sheet = getSheetLayer() && getSheetLayer().sheet;
        if (sheet && sheet.kind === 'package' && sheet.data.mode === 'edit') openDeletePackageConfirm(sheet.data.id);
        break;
      }
      case 'start-new-trip':
        startNewTrip();
        break;
      case 'confirm-action':
        confirmActiveSheet();
        break;
      case 'install-now':
        if (installPrompt) startInstall({ closeSheet: true });
        else closeTopLayer();
        break;
      default:
        break;
    }
  }

  /* ---------------- Settings actions ---------------- */

  function exportBackup() {
    try {
      const now = new Date().toISOString();
      state.settings.lastBackupAt = now;
      saveState();
      const payload = {
        app: 'xingnang',
        appName: '行囊 · 出差清点',
        version: VERSION,
        exportedAt: now,
        state
      };
      const serialized = JSON.stringify(payload, null, 2);
      const fileName = `行囊备份_${fileDateStamp()}.json`;
      if (window.AndroidBridge && typeof window.AndroidBridge.saveBackup === 'function') {
        let savedPath = '';
        try {
          savedPath = window.AndroidBridge.saveBackup(fileName, serialized);
        } catch (error) {
          console.error(error);
        }
        if (savedPath) {
          renderSettings();
          showToast(`备份已保存到 ${savedPath}`);
          announce('清单备份已保存到下载目录');
        } else {
          showToast('保存备份失败，请检查手机存储空间');
        }
        return;
      }
      const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      renderSettings();
      showToast('备份已导出，记得存到网盘或电脑');
      announce('清单备份已导出');
    } catch (error) {
      console.error(error);
      showToast('导出失败，请换一个浏览器试试');
    }
  }

  function triggerImportFile() {
    const input = $('#importFile');
    if (!input) return;
    input.value = '';
    input.click();
  }

  async function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast('文件太大了，不像是行囊的备份');
      event.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedState = normalizeState(parsed, { forImport: true });
      const importedStats = importedState.packages.reduce((acc, pkg) => {
        acc.packages += 1;
        acc.items += pkg.items.length;
        return acc;
      }, {
        packages: 0,
        items: 0,
        todoLists: importedState.todoLists.length,
        todos: importedState.todoLists.reduce((total, list) => total + list.items.length, 0),
        expenses: importedState.expense.expenses.length
      });
      let exportedAt = '';
      if (parsed && typeof parsed.exportedAt === 'string') {
        exportedAt = formatDate(parsed.exportedAt);
      }
      openConfirm({
        title: '导入这份备份？',
        subtitle: file.name,
        visual: 'accent',
        visualIcon: 'upload',
        confirmText: '导入备份',
        cancelText: '取消',
        text: `这份备份包含 <strong>${importedStats.packages} 个包裹、${importedStats.items} 件物品、${importedStats.todoLists} 份待办清单 / ${importedStats.todos} 条待办、${importedStats.expenses} 笔费用</strong>${exportedAt ? `，导出于 ${escapeHTML(exportedAt)}` : ''}。<br><br>导入后会<strong>覆盖当前清单</strong>，建议先导出一份现有备份。`,
        onConfirm: () => {
          state = importedState;
          state.settings.onboarded = true;
          saveState();
          applyTheme();
          renderHome();
          closeAllLayers();
          showToast(`备份已导入：${importedStats.items} 件物品、${importedStats.todoLists} 份清单 / ${importedStats.todos} 条待办、${importedStats.expenses} 笔费用`);
          announce('备份已导入');
        }
      });
    } catch (error) {
      console.warn(error);
      if (error instanceof SyntaxError) showToast('导入失败：文件不是有效的 JSON 备份');
      else showToast('导入失败：备份内容不完整');
    } finally {
      event.target.value = '';
    }
  }

  function requestRestoreTemplate() {
    openConfirm({
      title: '恢复示例模板？',
      subtitle: '',
      visual: 'accent',
      visualIcon: 'refresh',
      confirmText: '恢复模板',
      cancelText: '取消',
      text: '当前清单会被替换为内置的出差常用物品和待办，主题和备份记录会保留。<br><br>如果现在的清单还要用，请先导出备份。费用记录也会一并清空。',
      onConfirm: () => {
        const theme = state.settings.theme;
        const lastBackupAt = state.settings.lastBackupAt;
        const fresh = createSeedState();
        fresh.settings.onboarded = true;
        fresh.settings.theme = theme;
        fresh.settings.lastBackupAt = lastBackupAt;
        state = fresh;
        saveState();
        applyTheme();
        renderHome();
        closeAllLayers();
        showToast('已恢复示例模板');
        announce('已恢复示例模板');
      }
    });
  }

  function requestClearData() {
    openConfirm({
      title: '清空全部数据？',
      subtitle: '',
      visual: 'danger',
      visualIcon: 'trash',
      confirmText: '全部清空',
      cancelText: '取消',
      text: '这会删除所有包裹、物品、待办、出差费用和本地设置，且<strong>无法撤销</strong>。<br><br>如果清单还要用，请先到「数据」里导出备份。',
      onConfirm: () => {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
        window.location.reload();
      }
    });
  }

  function installStateLabel() {
    if (isStandalone()) return '已安装';
    if (installPrompt) return '去安装';
    return '查看方法';
  }

  function updateInstallState() {
    if (!state) return;
    const target = $('#installState');
    if (target) target.textContent = installStateLabel();
  }

  async function startInstall(options = {}) {
    if (!installPrompt) {
      if (options.closeSheet) closeTopLayer();
      openInstallGuide();
      return;
    }
    const promptEvent = installPrompt;
    installPrompt = null;
    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (options.closeSheet) closeTopLayer();
      if (choice && choice.outcome === 'accepted') {
        showToast('正在安装到桌面，请稍候');
      } else {
        showToast('已取消安装');
      }
    } catch (error) {
      console.warn(error);
      if (options.closeSheet) closeTopLayer();
      showToast('安装没有成功，可以用浏览器菜单添加');
    }
    updateInstallState();
    renderSettings();
  }

  /* ---------------- Welcome / onboarding ---------------- */

  function showWelcomeIfNeeded() {
    welcomeOpen = !state.settings.onboarded;
    const overlay = $('#welcomeOverlay');
    if (!overlay) return;
    overlay.hidden = !welcomeOpen;
    if (welcomeOpen) {
      document.body.classList.add('is-locked');
    }
  }

  function finishWelcome(blank) {
    if (!welcomeOpen) return;
    if (blank) {
      state.packages = [];
      state.todoLists = [];
      state.expense = defaultExpenseState();
    }
    state.settings.onboarded = true;
    saveState();
    welcomeOpen = false;
    const overlay = $('#welcomeOverlay');
    if (overlay) overlay.hidden = true;
    renderHome();
    syncUI({ reason: 'update' });
    document.body.classList.remove('is-locked');
    haptic(10);
    if (blank) showToast('清单已清空，先建一个包裹吧');
    window.setTimeout(() => {
      const target = $('#hubTodoBtn') || $('#hubSettingsBtn') || $('#addFab');
      if (target) target.focus({ preventScroll: true });
    }, 80);
  }

  /* ---------------- Event binding ---------------- */

  function bindStaticEvents() {
    const on = (selector, eventName, handler) => {
      const element = $(selector);
      if (element) element.addEventListener(eventName, handler);
    };

    on('#searchBtn', 'click', openSearch);
    on('#settingsBtn', 'click', openSettings);
    on('#brandHomeBtn', 'click', openHubPage);
    on('#hubSettingsBtn', 'click', openSettings);
    on('#hubTodoBtn', 'click', openTodoPage);
    on('#hubExpenseBtn', 'click', openExpensePage);
    on('#hubPackBtn', 'click', () => {
      closeTopLayer();
      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
      }, 260);
    });
    on('#hubBackupBtn', 'click', () => openSettings({ scrollToData: true }));
    on('#hubSecondBtn', 'click', () => {
      if (window.AndroidBridge && typeof window.AndroidBridge.openSecondQuestion === 'function') {
        try {
          window.AndroidBridge.openSecondQuestion();
        } catch (error) {
          console.warn('第二问启动失败', error);
          showToast('第二问启动失败，请重试');
        }
        return;
      }
      showToast('「第二问」目前只在 Android 行囊内打开');
    });
    on('#todoBtn', 'click', openTodoPage);
    on('#expenseBtn', 'click', openExpensePage);
    on('#footerBackupBtn', 'click', () => openSettings({ scrollToData: true }));
    on('#addFab', 'click', () => {
      if (!state.packages.length) openPackageSheet();
      else openItemSheet(state.packages[0].id);
    });
    on('#continueBtn', 'click', handleContinue);
    on('#newTripBtn', 'click', openNewTripSheet);
    on('#checkAllFixedBtn', 'click', checkAllFixedItems);

    on('#detailBackBtn', 'click', closeTopLayer);
    on('#detailAddItemBtn', 'click', () => {
      const page = getPageLayer();
      if (page && page.type === 'detail') openItemSheet(page.id);
    });
    on('#editPackageBtn', 'click', () => {
      const page = getPageLayer();
      if (page && page.type === 'detail') openPackageSheet(page.id);
    });
    on('#settingsBackBtn', 'click', closeTopLayer);
    on('#searchBackBtn', 'click', closeTopLayer);
    on('#todoBackBtn', 'click', closeTopLayer);
    on('#todoListBackBtn', 'click', closeTopLayer);
    on('#expenseBackBtn', 'click', closeTopLayer);
    on('#todoAddListBtn', 'click', () => openTodoListSheet());
    on('#todoListAddBtn', 'click', () => {
      const page = getPageLayer();
      if (page && page.type === 'todoList') openTodoSheet(null, page.listId);
    });
    on('#todoListEditBtn', 'click', () => {
      const page = getPageLayer();
      if (page && page.type === 'todoList') openTodoListSheet(page.listId, { source: 'detail' });
    });
    on('#expensePrimaryBtn', 'click', handleExpensePrimary);
    on('#sheetCloseBtn', 'click', closeTopLayer);

    on('#installRow', 'click', () => {
      if (isStandalone()) {
        openInstallGuide();
      } else if (installPrompt) {
        startInstall();
      } else {
        openInstallGuide();
      }
    });
    on('#guideRow', 'click', openHelpSheet);
    on('#exportRow', 'click', exportBackup);
    on('#importRow', 'click', triggerImportFile);
    on('#restoreTemplateRow', 'click', requestRestoreTemplate);
    on('#clearDataRow', 'click', requestClearData);
    on('#importFile', 'change', handleImportFile);

    const themeSegment = $('.theme-segment');
    if (themeSegment) {
      themeSegment.addEventListener('click', (event) => {
        const button = event.target.closest('[data-theme-value]');
        if (button) setTheme(button.dataset.themeValue);
      });
    }

    const expenseTabs = $('.expense-tabs');
    if (expenseTabs) {
      expenseTabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-expense-tab]');
        if (button) setExpenseTab(button.dataset.expenseTab);
      });
    }

    on('#welcomeStartBtn', 'click', () => finishWelcome(false));
    on('#welcomeBlankBtn', 'click', () => finishWelcome(true));

    const searchInput = $('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        if (event.isComposing) return;
        searchQuery = searchInput.value.trim();
        renderSearch();
      });
      searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          searchInput.blur();
        }
      });
    }
    on('#searchClearBtn', 'click', () => {
      searchQuery = '';
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      renderSearch();
    });

    on('#toastAction', 'click', () => {
      const handler = toastActionHandler;
      hideToast();
      if (typeof handler === 'function') handler();
    });

    document.addEventListener('click', (event) => {
      const closer = event.target.closest('[data-close-sheet]');
      if (closer) {
        event.preventDefault();
        closeTopLayer();
        return;
      }
      const actionElement = event.target.closest('[data-action]');
      if (actionElement) {
        event.preventDefault();
        handleAction(actionElement);
      }
    });

    window.addEventListener('popstate', (event) => {
      const targetDepth = event.state && Number.isInteger(event.state.xingnangDepth)
        ? event.state.xingnangDepth
        : 0;
      if (targetDepth >= layers.length) {
        historyDepth = layers.length;
        return;
      }
      const removed = layers.slice(targetDepth);
      layers = layers.slice(0, targetDepth);
      historyDepth = targetDepth;
      currentSheetRef = null;
      const focusTarget = removed.length ? removed[removed.length - 1].returnFocus : null;
      syncUI({ reason: 'pop', focusTarget });
    });

    document.addEventListener('keydown', (event) => {
      if (welcomeOpen) return;
      if (event.key === 'Escape') {
        if (getSheetLayer() || getPageLayer()) {
          event.preventDefault();
          closeTopLayer();
        }
        return;
      }
      if (event.key === 'Tab' && getSheetLayer()) {
        const sheet = $('#sheet');
        if (!sheet) return;
        const focusables = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])', sheet)
          .filter((el) => el.offsetParent !== null && !el.hidden);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey) {
          if (active === first || !sheet.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !sheet.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      installPrompt = event;
      updateInstallState();
      renderSettings();
    });

    window.addEventListener('resize', () => {
      requestAnimationFrame(positionToast);
    });

    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      updateInstallState();
      renderSettings();
      showToast('已安装到桌面，下次从图标打开');
    });

    if (darkModeMedia.addEventListener) {
      darkModeMedia.addEventListener('change', () => {
        if (state && state.settings.theme === 'auto') applyTheme();
      });
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('Service Worker 注册失败', error);
      });
    });
  }

  function initHistory() {
    try {
      history.replaceState({ xingnangDepth: 0 }, '');
      historyEnabled = true;
      historyDepth = 0;
    } catch (error) {
      console.warn('历史记录 API 不可用，使用页内返回', error);
      historyEnabled = false;
      historyDepth = 0;
    }
  }

  function showBootNotice() {
    let message = bootNotice;
    if (!storageAvailable && !message) {
      message = '当前浏览器限制了本地存储，清单可能无法保存';
    }
    if (message) {
      window.setTimeout(() => showToast(message, '', null, 5200), 900);
    }
  }

  function init() {
    state = loadState();
    initHistory();
    applyTheme();
    bindStaticEvents();
    renderHome();
    renderSettings();
    syncAndroidWidget();
    showWelcomeIfNeeded();
    openHubPage();
    syncUI({ reason: 'init' });
    document.documentElement.classList.add('app-ready');
    registerServiceWorker();
    showBootNotice();
  }

  try {
    init();
  } catch (error) {
    console.error('行囊初始化失败', error);
    document.documentElement.classList.add('app-ready');
    const app = $('#app');
    if (app) {
      app.innerHTML = `<main style="padding:48px 24px;font-family:system-ui,sans-serif;color:#211C17">
        <h1 style="font-size:24px;margin:0 0 10px">页面没有正常加载</h1>
        <p style="line-height:1.7;color:#71675B">请刷新重试，或换用 Chrome / 小米浏览器打开。</p>
      </main>`;
    }
  }

  /* __APPEND_POINT__ */
})();
