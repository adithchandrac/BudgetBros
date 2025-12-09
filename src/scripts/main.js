(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const tabs = $$(".tab");
  const panels = $$(".panel");

  function show(tabName) {
    panels.forEach((p) => p.classList.remove("show"));
    tabs.forEach((t) => t.classList.remove("active"));
    const panel = document.querySelector(`#panel-${tabName}`);
    if (panel) panel.classList.add("show");
    const tab = tabs.find((t) => t.dataset.tab === tabName);
    if (tab) tab.classList.add("active");
  }

  window.show = show;

  document.querySelector(".tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    show(btn.dataset.tab);
  });

  /* land on the new Home */
  show("spending");

  /* demo notice (kept) */
  const profileBtn = $("#profile-btn");
  const notice = $("#notice");
  const closeNotice = $("#notice-close");
  if (profileBtn)
    profileBtn.addEventListener("click", () => (notice.hidden = false));
  if (closeNotice)
    closeNotice.addEventListener("click", () => (notice.hidden = true));
})();

// ====== Spending: transactions + filter/sort + recurring + delete-confirm (localStorage) ======
const STORAGE_KEY = "cmsc434.transactions.v3";
const RECUR_KEY   = "cmsc434.transactions.recurring.v1";

function loadTxns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch (e) {
    return null;
  }
}
function saveTxns(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {}
}

function loadRecurring() {
  try {
    const raw = localStorage.getItem(RECUR_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch (e) {
    return null;
  }
}
function saveRecurring(arr) {
  try {
    localStorage.setItem(RECUR_KEY, JSON.stringify(arr));
  } catch (e) {}
}

// date helpers for recurring + filters
function parseISO(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addInterval(date, freq) {
  const d = new Date(date.getTime());
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "biweekly") d.setDate(d.getDate() + 14);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return d;
}

// Seed transactions if none saved
let transactions = loadTxns();
if (!transactions) {
  transactions = [
    {
      id: 1,
      type: "expense",
      category: "Groceries",
      note: "Trader Joes",
      amount: 54.18,
      date: "2025-10-17",
    },
    {
      id: 2,
      type: "expense",
      category: "Transportation",
      note: "Metro card",
      amount: 25.0,
      date: "2025-10-18",
    },
    {
      id: 3,
      type: "income",
      category: "Paycheck",
      note: "Campus job",
      amount: 320.0,
      date: "2025-10-18",
    },
  ];
  saveTxns(transactions);
}

function applyRecurring() {
  const recs = loadRecurring();
  if (!recs || !recs.length) return;

  const today = new Date();
  let changed = false;

  for (const rec of recs) {
    if (!rec.frequency || !rec.lastDate || !rec.template) continue;

    let last = parseISO(rec.lastDate);
    while (true) {
      const next = addInterval(last, rec.frequency);
      if (!next || next > today) break;

      const dateStr = formatDate(next);
      const exists = transactions.some(
        (t) =>
          t.recurringId === rec.id &&
          t.date === dateStr &&
          t.amount === rec.template.amount &&
          t.category === rec.template.category
      );
      if (!exists) {
        const id =
          (transactions.reduce((m, t) => Math.max(m, t.id), 0) || 0) + 1;
        transactions.push({
          id,
          type: rec.template.type,
          category: rec.template.category,
          note: rec.template.note,
          amount: rec.template.amount,
          date: dateStr,
          recurringId: rec.id,
        });
        changed = true;
      }
      rec.lastDate = dateStr;
      last = next;
    }
  }

  if (changed) {
    saveTxns(transactions);
    saveRecurring(recs);
  }
}

// run recurring expansion once on load
applyRecurring();


// Elements
const txnList   = document.querySelector("#txn-list");
const addWrap   = document.querySelector("#add-form-wrap");
const seg       = document.querySelector("#txn-filter-seg");
const addRow    = document.querySelector(".txn-add-row");
const form      = document.querySelector("#txn-form");
const openForm  = document.querySelector("#txn-open-form");
const cancelBtn = document.querySelector("#txn-cancel");
const modalClose = document.querySelector("#txn-modal-close");

const typeEl   = document.querySelector("#txn-type");
const amtEl    = document.querySelector("#txn-amount");
const dateEl   = document.querySelector("#txn-date");
const noteEl   = document.querySelector("#txn-note");
const catEl    = document.querySelector("#category");

const categoryFilterEl = document.querySelector("#txn-filter-category");
const sortEl           = document.querySelector("#txn-sort");
const dateFilterEl     = document.querySelector("#txn-filter-date");

const recurringCheckbox = document.querySelector("#txn-recurring");
const freqEl            = document.querySelector("#txn-frequency");

// UI state
let currentMode          = "list";   // 'list' | 'add'
let currentFilter        = "all";    // 'all' | 'expense' | 'income'
let currentCategoryFilter = "all";
let currentSort          = "date-desc";
let currentDateFilter    = "all";


function formatCurrency(num) {
  return (num < 0 ? "-$" : "$") + Math.abs(num).toFixed(2);
}

function setMode(mode) {
  currentMode = mode;
  const inAdd = mode === "add";

  if (addWrap) {
    addWrap.hidden = !inAdd;
  }

  if (inAdd) {
    if (amtEl) amtEl.focus();
    if (dateEl) {
      const today = new Date();
      dateEl.value = formatDate(today);
    }
  } else {
    renderTransactions(currentFilter);
  }
}

function setFilter(filter, btn) {
  currentFilter = filter;
  if (seg) {
    const btns = Array.from(seg.querySelectorAll(".seg-btn[data-filter]"));
    btns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  setMode("list");
}

function renderTransactions(view = "all") {
  if (!txnList) return;
  txnList.innerHTML = "";

  const now = new Date();

  let filtered = transactions.filter((t) => {
    if (view !== "all" && t.type !== view) return false;

    if (currentCategoryFilter !== "all" && t.category !== currentCategoryFilter)
      return false;

    if (currentDateFilter !== "all") {
      const d = parseISO(t.date);
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      if (currentDateFilter === "last7" && diffDays > 7) return false;
      if (currentDateFilter === "last30" && diffDays > 30) return false;
    }

    return true;
  });

  // sort
  filtered.sort((a, b) => {
    switch (currentSort) {
      case "date-asc":
        return a.date.localeCompare(b.date) || a.id - b.id;
      case "amount-desc":
        return b.amount - a.amount;
      case "amount-asc":
        return a.amount - b.amount;
      case "date-desc":
      default:
        return b.date.localeCompare(a.date) || b.id - a.id;
    }
  });

  for (const t of filtered) {
    const item = document.createElement("div");
    item.className = "txn";
    item.setAttribute("role", "listitem");

    const sign = t.type === "expense" ? -1 : +1;
    const displayAmount = sign * Math.abs(t.amount);

    item.innerHTML = `
      <div class="txn-left">
        <div class="txn-cat">${t.category}</div>
        <div class="txn-note">${t.note || ""}</div>
      </div>
      <div class="txn-right ${t.type}">
        <div class="txn-amt">${formatCurrency(displayAmount)}</div>
        <div class="txn-date">${t.date}</div>
      </div>
      <button class="txn-del" title="Delete" aria-label="Delete transaction" data-id="${t.id}">&times;</button>
    `;
    txnList.appendChild(item);
  }

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "txn-empty";
    empty.textContent = "No transactions to show.";
    txnList.appendChild(empty);
  }

  // delete with confirmation
  Array.from(txnList.querySelectorAll(".txn-del")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const match = transactions.find((t) => t.id === id);
      const label = match
        ? `${match.category} ${formatCurrency(
            match.type === "expense" ? -match.amount : match.amount
          )} on ${match.date}`
        : "this transaction";

      if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) {
        return;
      }

      transactions = transactions.filter((t) => t.id !== id);
      saveTxns(transactions);
      renderTransactions(currentFilter);
      renderLatestTransaction();
    });
  });
}

// Wire filters (All / Expenses / Income)
if (seg) {
  const btns = Array.from(seg.querySelectorAll(".seg-btn[data-filter]"));
  btns.forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFilter(b.dataset.filter, b);
    });
  });
}

// Build category filter options from the category select
if (categoryFilterEl && catEl) {
  const values = Array.from(catEl.options)
    .map((o) => o.value)
    .filter((v) => v && v.trim().length > 0);

  categoryFilterEl.innerHTML =
    `<option value="all">All categories</option>` +
    values
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .map((v) => `<option value="${v}">${v}</option>`)
      .join("");

  categoryFilterEl.addEventListener("change", () => {
    currentCategoryFilter = categoryFilterEl.value;
    renderTransactions(currentFilter);
  });
}

if (sortEl) {
  sortEl.addEventListener("change", () => {
    currentSort = sortEl.value;
    renderTransactions(currentFilter);
  });
}

if (dateFilterEl) {
  dateFilterEl.addEventListener("change", () => {
    currentDateFilter = dateFilterEl.value;
    renderTransactions(currentFilter);
  });
}

// recurring toggle: enable/disable frequency select
if (recurringCheckbox && freqEl) {
  recurringCheckbox.addEventListener("change", () => {
    const on = recurringCheckbox.checked;
    freqEl.disabled = !on;
    if (!on) {
      freqEl.value = "weekly";
    }
  });
}

// Wire filters (All / Expenses / Income)
if (seg) {
  const btns = Array.from(seg.querySelectorAll(".seg-btn[data-filter]"));
  btns.forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFilter(b.dataset.filter, b);
    });
  });
}

// Open Add (modal)
if (openForm) {
  openForm.addEventListener("click", () => {
    setMode("add");
  });
}

// Cancel Add -> close modal, back to list
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    setMode("list");
  });
}

if (modalClose) {
  modalClose.addEventListener("click", () => {
    setMode("list");
  });
}

// close modal if user taps backdrop
if (addWrap) {
  addWrap.addEventListener("click", (e) => {
    if (e.target === addWrap || e.target.classList.contains("txn-modal-backdrop")) {
      setMode("list");
    }
  });
}

// Add transaction handler
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = typeEl.value === "income" ? "income" : "expense";
    const amount = parseFloat(amtEl.value);
    const category = catEl.value;
    const date = dateEl.value;
    const note = (noteEl.value || "").trim();
    if (!amount || amount <= 0 || !category || !date) return;

    const isRecurring = recurringCheckbox && recurringCheckbox.checked;
    const frequency = freqEl && !freqEl.disabled ? freqEl.value : null;

    // handle recurring definition
    let recId = null;
    if (isRecurring && frequency) {
      let recs = loadRecurring() || [];
      recId = (recs.reduce((m, r) => Math.max(m, r.id || 0), 0) || 0) + 1;
      recs.push({
        id: recId,
        template: { type, category, note, amount },
        frequency,
        lastDate: date,
      });
      saveRecurring(recs);
    }

    const id = (transactions.reduce((m, t) => Math.max(m, t.id), 0) || 0) + 1;
    transactions.push({ id, type, category, note, amount, date, recurringId: recId });
    saveTxns(transactions);
    renderLatestTransaction();

    // reset quick fields
    amtEl.value = "";
    noteEl.value = "";
    catEl.value = "";
    if (recurringCheckbox) recurringCheckbox.checked = false;
    if (freqEl) {
      freqEl.disabled = true;
      freqEl.value = "weekly";
    }

    setMode("list");
  });
}


function renderLatestTransaction() {
  const latestEl = document.getElementById("home-latest-txn");
  if (!latestEl) return;
  const summary = latestEl.querySelector(".txn-summary");

  if (!transactions || transactions.length === 0) {
    summary.innerHTML = `<span>No recent transactions</span>`;
    return;
  }

  // Find the most recent transaction by date (and id fallback)
  const latest = [...transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id
  )[0];

  const sign = latest.type === "expense" ? "-" : "+";
  const colorClass = latest.type === "expense" ? "expense" : "income";
  const amtText = `${sign}$${latest.amount.toFixed(2)}`;

  summary.innerHTML = `
    <span class="txn-cat">${latest.category}</span>
    <span class="txn-amt ${colorClass}">${amtText}</span>
    <span class="txn-date">${latest.date}</span>
  `;
}

// Make the "latest transaction" button open the Spending tab
const latestTxnBtn = document.getElementById("home-latest-txn");
if (latestTxnBtn) {
  latestTxnBtn.addEventListener("click", () => {
    show("spending");
  });
}

// Initial render: default to ALL in list mode
setMode("list");
renderTransactions("all");
renderLatestTransaction();

const spans = document.querySelectorAll('span[id^="budget-"]');
const overview = document.getElementById("budget-overview");

/*Category list*/
const categories = [
  "Spending Limit",
  "Bills & Utilities",
  "Transportation",
  "Groceries",
  "Dining & Entertainment",
  "Shopping & Personal Care",
  "Education & Business",
  "Savings & Investments",
  "Miscellaneous",
];

const budgets = {
  Daily: new Array(categories.length).fill(0),
  Weekly: new Array(categories.length).fill(0),
  Monthly: new Array(categories.length).fill(0),
  Yearly: new Array(categories.length).fill(0),
};

function renderBudget(period) {
  const data = budgets[period];
  let ret = "";
  if (data[0] == 0) {
    ret = `
        <div>
          <p>No ${period} budget set yet.</p>
          <button id="new-budget-btn" class='btn' >Create ${period} budget</button>
        </div>
      `;
    document.getElementById("budget-overview").innerHTML = ret;
    const newBdgt = document.getElementById("new-budget-btn");
    newBdgt.addEventListener("click", () => budgetform(period));
    return;
  } else {
    let ret = `<table class='budgets'>
                  <tr><th>Category</th><th>Cap($)</th></tr>`;
    for (let x = 0; x < categories.length; x++) {
      ret += `<tr><td>${categories[x]}</td><td>${data[x]}</td></tr>`;
    }
    ret += `</table>             <button id="edit-button" class="btn">Edit Budget</button>`;
    document.getElementById("budget-overview").innerHTML = ret;
    const editbtn = document.getElementById("edit-button");
    editbtn.addEventListener("click", () => budgetform(period));
  }
}

// Handle clicks and class toggling
spans.forEach((span) => {
  span.addEventListener("click", () => {
    spans.forEach((s) => s.classList.remove("is-active"));
    span.classList.add("is-active");
    const period = span.textContent.trim();
    renderBudget(period);
  });
});

const defaultBudgetSpan = document.getElementById("budget-daily");
if (defaultBudgetSpan) {
  defaultBudgetSpan.classList.add("is-active");
  renderBudget("Daily");
}

function budgetform(period) {
  let overview = document.getElementById("budget-overview");
  let data = budgets[period];
  overview.innerHTML = "";

  let ret = `
    <table class="budgets">
      <tr><th>Category</th><th>$</th></tr>
      <tr>
        <td>${categories[0]}</td>
        <td>
          <input 
            type="number"
            required
            id="spending-amnt"       
            class="budget-input"
            min="0"
            step="10"
            value="${data[0] ?? 0}">
        </td>
      </tr>
  `;

  for (let x = 1; x < categories.length; x++) {
    ret += `
      <tr>
        <td>${categories[x]}</td>
        <td>
          <input 
            type="number" 
            required
            id="${categories[x]}-amount"
            class="budget-input"
            min="0"
            step="0.01"
            value="${data[x] ?? 0}">
        </td>
      </tr>`;
  }
  ret += `</table>`;

  overview.innerHTML =
    ret +
    `
    <button id="cancel-budget" class="bdgt-btn">Cancel</button>
    <button id="automate-budget" class="bdgt-btn">Sample Budget</button>
    <button id="save-budget" class="bdgt-btn">Save Budget</button>
  `;

  document.getElementById("cancel-budget").addEventListener("click", () => {
    renderBudget(period);
  });

  document.getElementById("automate-budget").addEventListener("click", () => {
    const limit = parseFloat(document.getElementById("spending-amnt").value);
    if (!Number.isFinite(limit) || limit <= 1) {
      alert(
        "Please assign a spending limit (> 1) so we can generate a sample budget"
      );
      return;
    }

    // percentages aligned to categories
    const pct = [
      1.0, // Spending Limit
      0.3,
      0.1,
      0.1,
      0.05,
      0.05,
      0.05,
      0.25,
      0.0,
    ];

    let allocated = 0;
    for (let i = 1; i < categories.length - 1; i++) {
      const v = +(limit * pct[i]).toFixed(2);
      allocated += v;
      const temp = document.getElementById(`${categories[i]}-amount`);
      if (temp) temp.value = v.toFixed(2);
    }

    const remainder = +(limit - allocated).toFixed(2);
    const miscEl = document.getElementById("Miscellaneous-amount");
    if (miscEl) miscEl.value = remainder.toFixed(2);
  });

  document.getElementById("save-budget").addEventListener("click", () => {
    const limit = parseFloat(document.getElementById("spending-amnt").value);
    if (!Number.isFinite(limit) || limit <= 1) {
      alert("Spending Limit must be greater than 1.");
      return;
    }
    let vals = new Array(categories.length).fill(0);
    vals[0] = limit;

    let sum = 0;
    for (let i = 1; i < categories.length; i++) {
      const temp = document.getElementById(`${categories[i]}-amount`);
      const v = parseFloat(temp.value);
      vals[i] = v;
      sum += vals[i];
    }

    if (Math.abs(sum - limit).toFixed(2) != 0) {
      alert(
        `All categories must add up to the Spending Limit. Current total: $${sum.toFixed(
          2
        )} vs $${limit.toFixed(2)}.`
      );
      return;
    }

    // Save to budgets and re-render
    budgets[period] = vals;
    renderBudget(period);
  });
}

//Spending Graph
(function () {
  const canvas = document.getElementById("spending-graph");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const data = {
    week: [100, 80, 90, 70, 50, 60, 40],
    month: [200, 300, 250, 400],
    year: [300, 328, 524, 400, 430, 517, 600, 650, 750, 600, 750, 500],
  };

  const buttons = document.querySelectorAll(".spending-range span");

  function draw(values, label) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const marginLeft = 80;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 60;

    const max = Math.max(...values);
    const yZero = h - marginBottom;
    const xStart = marginLeft;
    const xEnd = w - marginRight;
    const stepX = (xEnd - xStart) / (values.length - 1);
    const trend = values[values.length - 1] - values[0];
    const color = trend >= 0 ? "red" : "green";

    // Determine time unit
    let timeUnit = "";
    if (label === "week") timeUnit = "days";
    else if (label === "month") timeUnit = "weeks";
    else if (label === "year") timeUnit = "months";
    else timeUnit = "hours";

    // Axes
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(xStart, marginTop);
    ctx.lineTo(xStart, yZero);
    ctx.lineTo(xEnd, yZero);
    ctx.stroke();

    // Y-axis Labels
    ctx.fillStyle = "#000";
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const val = max - (max / ySteps) * i;
      const y = marginTop + ((yZero - marginTop) * i) / ySteps;
      ctx.fillText(val.toFixed(0), xStart - 5, y + 4);

      // gridline
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.strokeStyle = "#e0e0e0";
      ctx.stroke();
    }

    // X-axis Labels
    ctx.fillStyle = "#000";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    for (let i = 0; i < values.length; i++) {
      const x = xStart + i * stepX;
      ctx.fillText(i + 1, x + 2, yZero + 18);
    }

    // Axis Titles
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#111";
    ctx.fillText(`Time (${timeUnit})`, w / 2, h - 15);

    // Center Y-axis title within graph area
    const yCenter = marginTop + (yZero - marginTop) / 2;
    ctx.save();
    ctx.translate(25, yCenter);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Spending ($)", 0, 0);
    ctx.restore();

    // Draw Line
    ctx.beginPath();
    ctx.moveTo(xStart, yZero - (values[0] / max) * (yZero - marginTop));
    for (let i = 1; i < values.length; i++) {
      const x = xStart + i * stepX;
      const y = yZero - (values[i] / max) * (yZero - marginTop);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const range = btn.dataset.range;
      draw(data[range], range);
    });
  });

  // Initial draw
  draw(data.week, "week");
})();

//Pie Chart
(function () {
  const canvas = document.getElementById("category-pie");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const legend = document.getElementById("category-legend");

  //Example data
  const data = {
    Groceries: 30,
    Dining: 20,
    Entertainment: 10,
    Transportation: 15,
    Bills: 25,
  };

  const colors = ["#4caf50", "#ff9800", "#2196f3", "#e91e63", "#9c27b0"];
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  const centerX = 130;
  const centerY = 130;
  const radius = 100;

  let exploded = null; 
  let hovered = null;  

  //Store slice angle info for hit detection
  const sliceInfo = [];
  let startAngle = 0;
  entries.forEach(([label, value]) => {
    const sliceAngle = (value / total) * Math.PI * 2;
    sliceInfo.push({ label, startAngle, endAngle: startAngle + sliceAngle });
    startAngle += sliceAngle;
  });

  function drawPie() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let startAngle = 0;

    entries.forEach(([label, value], i) => {
      const sliceAngle = (value / total) * Math.PI * 2;
      const midAngle = startAngle + sliceAngle / 2;

      //Offset logic
      let offset = 0;
      if (exploded === label) offset = 15;
      else if (hovered === label) offset = 8;

      const offsetX = Math.cos(midAngle) * offset;
      const offsetY = Math.sin(midAngle) * offset;

      //Fade non-selected slices
      ctx.globalAlpha = exploded && exploded !== label ? 0.25 : 1;

      //Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX + offsetX, centerY + offsetY);
      ctx.arc(
        centerX + offsetX,
        centerY + offsetY,
        radius,
        startAngle,
        startAngle + sliceAngle
      );
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();

      //Draw percentage label
      if (!exploded || exploded === label) {
        const labelX = centerX + offsetX + (radius / 1.5) * Math.cos(midAngle);
        const labelY = centerY + offsetY + (radius / 1.5) * Math.sin(midAngle);
        ctx.fillStyle = "#000";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const percent = ((value / total) * 100).toFixed(0) + "%";
        ctx.fillText(percent, labelX, labelY);
      }

      startAngle += sliceAngle;
    });

    ctx.globalAlpha = 1;

    //Show selected slice info in center
    if (exploded) {
      const value = data[exploded];
      ctx.fillStyle = "#000";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${exploded}: $${value}`, centerX, centerY);
    }
  }

  function getSliceAtMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;
    const dist = Math.sqrt(x * x + y * y);
    if (dist > radius) return null;

    const angle = Math.atan2(y, x);
    const normAngle = angle >= 0 ? angle : angle + 2 * Math.PI;
    return sliceInfo.find(
      (s) => normAngle >= s.startAngle && normAngle < s.endAngle
    )?.label;
  }

  //Click to explode (trigger pie chart to pop out and show category)
  canvas.addEventListener("click", (e) => {
    const slice = getSliceAtMouse(e);
    exploded = exploded === slice ? null : slice;
    drawPie();
  });

  //Hover lift effect
  canvas.addEventListener("mousemove", (e) => {
    const slice = getSliceAtMouse(e);
    if (slice !== hovered) {
      hovered = slice;
      drawPie();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    hovered = null;
    drawPie();
  });

  //Legend
  legend.innerHTML = entries
    .map(
      ([label, _], i) =>
        `<li><span style="background:${colors[i]}"></span>${label}</li>`
    )
    .join("");

  drawPie();
})();

  //Profile avatar selector
  (() => {
    const AVATAR_KEY = "cmsc434.profile.avatar1";
    const ALLOWED = new Set([
      "pfp.png",
      "crab.png",
      "jellyfish.png",
      "fox.png",
      "koala.png",
    ]);

    const avatarImg = document.getElementById("profile-avatar");
    const editBtn = document.getElementById("pfp-edit");
    const popover = document.getElementById("avatar-popover");

    if (!avatarImg || !editBtn || !popover) return;

    const normalize = (f) => (f && ALLOWED.has(f) ? f : "pfp.png");

    const getSaved = () => {
      try {
        return normalize(localStorage.getItem(AVATAR_KEY));
      } catch {
        return "pfp.png";
      }
    };
    const setSaved = (f) => {
      try {
        localStorage.setItem(AVATAR_KEY, normalize(f));
      } catch {}
    };
    const apply = (f) => {
      avatarImg.src = `./assets/icons/${normalize(f)}`;
    };

    const open = () => {
      popover.hidden = false;
    };
    const close = () => {
      popover.hidden = true;
    };
    const toggle = () => {
      popover.hidden = !popover.hidden;
    };

    close();
    apply(getSaved());

    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });

    popover.addEventListener("click", (e) => {
      const btn = e.target.closest(".avatar-opt");
      if (!btn) return;
      const file = btn.dataset.avatar;
      apply(file);
      setSaved(file);
      close();
    });

    document.addEventListener("click", (e) => {
      if (popover.hidden) return;
      if (!e.target.closest(".pfp-wrap")) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  })();
  (() => {
  const PROFILE_KEY = "cmsc434.profile.v1";

  // inputs
  const fields = {
    name:     document.getElementById("pf-name"),
    income:   document.getElementById("pf-income"),
    email:    document.getElementById("pf-email"),
    phone:    document.getElementById("pf-phone"),
    city:     document.getElementById("pf-city"),
    currency: document.getElementById("pf-currency"),
  };

  const btnSave = document.getElementById("pf-save");
  const btnEdit = document.getElementById("pf-edit");

  if (!btnSave || !btnEdit || Object.values(fields).some(el => !el)) return;

  const loadProfile = () => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const saveProfile = (data) => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); } catch {}
  };

  const setDisabled = (isDisabled) => {
    Object.values(fields).forEach(el => el.disabled = isDisabled);
  };

  const setMode = (mode) => {
    // mode: 'view' or 'edit'
    const view = mode === "view";
    setDisabled(view);
    btnEdit.hidden = !view;   // show Edit only in view
    btnSave.hidden = view;    // show Save only in edit
  };

  const apply = (data) => {
    fields.name.value     = data?.name ?? "";
    fields.income.value   = data?.income ?? "";
    fields.email.value    = data?.email ?? "";
    fields.phone.value    = data?.phone ?? "";
    fields.city.value     = data?.city ?? "";
    fields.currency.value = data?.currency ?? "USD";
  };

  // init
  const existing = loadProfile();
  apply(existing);

  // if we have nothing saved yet -> start in EDIT with Save visible
  const nothingSaved =
    !existing ||
    Object.values(existing).every(v => v === "" || v === null || typeof v === "undefined");

  setMode(nothingSaved ? "edit" : "view");

  // wire buttons
  btnEdit.addEventListener("click", () => setMode("edit"));

  btnSave.addEventListener("click", () => {
    const data = {
      name:     fields.name.value.trim(),
      income:   fields.income.value ? Number(fields.income.value) : "",
      email:    fields.email.value.trim(),
      phone:    fields.phone.value.trim(),
      city:     fields.city.value.trim(),
      currency: fields.currency.value || "USD",
    };
    saveProfile(data);
    setMode("view");
  });
})();



//  ON-SCREEN KEYBOARD 
(function() {
  let activeInput = null;
  let keyboardVisible = false;

  // keyboard HTML
  const keyboardHTML = `
    <div id="on-screen-keyboard" class="keyboard" hidden>
      <div class="keyboard-content">
        <!-- Single unified keyboard -->
        <div class="keyboard-layout keyboard-unified">
          <div class="keyboard-row">
            <button class="key" data-key="1">1</button>
            <button class="key" data-key="2">2</button>
            <button class="key" data-key="3">3</button>
            <button class="key" data-key="4">4</button>
            <button class="key" data-key="5">5</button>
            <button class="key" data-key="6">6</button>
            <button class="key" data-key="7">7</button>
            <button class="key" data-key="8">8</button>
            <button class="key" data-key="9">9</button>
            <button class="key" data-key="0">0</button>
          </div>
          <div class="keyboard-row">
            <button class="key" data-key="q">Q</button>
            <button class="key" data-key="w">W</button>
            <button class="key" data-key="e">E</button>
            <button class="key" data-key="r">R</button>
            <button class="key" data-key="t">T</button>
            <button class="key" data-key="y">Y</button>
            <button class="key" data-key="u">U</button>
            <button class="key" data-key="i">I</button>
            <button class="key" data-key="o">O</button>
            <button class="key" data-key="p">P</button>
          </div>
          <div class="keyboard-row">
            <button class="key" data-key="a">A</button>
            <button class="key" data-key="s">S</button>
            <button class="key" data-key="d">D</button>
            <button class="key" data-key="f">F</button>
            <button class="key" data-key="g">G</button>
            <button class="key" data-key="h">H</button>
            <button class="key" data-key="j">J</button>
            <button class="key" data-key="k">K</button>
            <button class="key" data-key="l">L</button>
          </div>
          <div class="keyboard-row">
            <button class="key" data-key="z">Z</button>
            <button class="key" data-key="x">X</button>
            <button class="key" data-key="c">C</button>
            <button class="key" data-key="v">V</button>
            <button class="key" data-key="b">B</button>
            <button class="key" data-key="n">N</button>
            <button class="key" data-key="m">M</button>
            <button class="key key-backspace" data-action="backspace">⌫</button>
          </div>
          <div class="keyboard-row">
            <button class="key key-space" data-key=" ">Space</button>
            <button class="key" data-key=".">.</button>
            <button class="key" data-key="@">@</button>
            <button class="key key-done" data-action="done">Done</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Insert keyboard into DOM
  document.body.insertAdjacentHTML('beforeend', keyboardHTML);
  const keyboard = document.getElementById('on-screen-keyboard');

  function showKeyboard(input) {
    activeInput = input;
    keyboardVisible = true;
    
    keyboard.hidden = false;
    
    // scroll in put into view
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function hideKeyboard() {
    keyboard.hidden = true;
    keyboardVisible = false;
    activeInput = null;
  }

  // Handle key press
  function handleKey(key) {
    if (!activeInput) return;

    const inputType = activeInput.type;
    const currentValue = activeInput.value;
    const selectionStart = activeInput.selectionStart || currentValue.length;
    
    if (inputType === 'number') {
      // Only allow numbers and one decimal point
      if (key === '.' && currentValue.includes('.')) return;
      if (!/[0-9.]/.test(key)) return;
    }

    const newValue = currentValue.slice(0, selectionStart) + key + currentValue.slice(selectionStart);
    activeInput.value = newValue;
    
    // Trigger input event for any listeners
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Move cursor forward
    const newPos = selectionStart + 1;
    activeInput.setSelectionRange(newPos, newPos);
  }

  function handleBackspace() {
    if (!activeInput) return;
    
    const currentValue = activeInput.value;
    const selectionStart = activeInput.selectionStart || currentValue.length;
    
    if (selectionStart === 0) return;
    
    const newValue = currentValue.slice(0, selectionStart - 1) + currentValue.slice(selectionStart);
    activeInput.value = newValue;
    
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    const newPos = selectionStart - 1;
    activeInput.setSelectionRange(newPos, newPos);
  }

  keyboard.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const key = btn.dataset.key;
    const action = btn.dataset.action;

    if (action === 'backspace') {
      handleBackspace();
    } else if (action === 'done') {
      hideKeyboard();
      if (activeInput) activeInput.blur();
    } else if (key) {
      handleKey(key);
    }
  });

  // Attach to all relevant inputs
  function attachKeyboard() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="tel"]');
    
    inputs.forEach(input => {
      // Skip if already attached
      if (input.dataset.keyboardAttached === 'true') return;
      input.dataset.keyboardAttached = 'true';
      
      // Show keyboard on focus/click
      const showHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showKeyboard(input);
      };
      
      input.addEventListener('focus', showHandler);
      input.addEventListener('click', showHandler);
      input.addEventListener('touchstart', showHandler, { passive: false });
    });
  }

  // Initial attach
  setTimeout(() => {
    attachKeyboard();
  }, 500);

  // Reattach when new inputs are added
  const observer = new MutationObserver(() => {
    attachKeyboard();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Hide keyboard when clicked outside
  document.addEventListener('click', (e) => {
    if (!keyboardVisible) return;
    if (keyboard.contains(e.target)) return;
    if (e.target.matches('input[type="text"], input[type="number"], input[type="email"], input[type="tel"]')) return;
    
    hideKeyboard();
  });

  // Prevent the keyboard from closing when clicking on it
  keyboard.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  keyboard.addEventListener('touchstart', (e) => {
    e.preventDefault();
  }, { passive: false });

  // Make functions available globally if needed
  window.onScreenKeyboard = {
    show: showKeyboard,
    hide: hideKeyboard
  };
})();