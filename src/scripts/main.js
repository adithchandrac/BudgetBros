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
const RECUR_KEY = "cmsc434.transactions.recurring.v1";

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
const txnList = document.querySelector("#txn-list");
const addWrap = document.querySelector("#add-form-wrap");
const seg = document.querySelector("#txn-filter-seg");
const addRow = document.querySelector(".txn-add-row");
const form = document.querySelector("#txn-form");
const openForm = document.querySelector("#txn-open-form");
const cancelBtn = document.querySelector("#txn-cancel");
const modalClose = document.querySelector("#txn-modal-close");

const typeEl = document.querySelector("#txn-type");
const amtEl = document.querySelector("#txn-amount");
const dateEl = document.querySelector("#txn-date");
const noteEl = document.querySelector("#txn-note");
const catEl = document.querySelector("#category");

const categoryFilterEl = document.querySelector("#txn-filter-category");
const sortEl = document.querySelector("#txn-sort");
const dateFilterEl = document.querySelector("#txn-filter-date");

const recurringCheckbox = document.querySelector("#txn-recurring");
const freqEl = document.querySelector("#txn-frequency");

// UI state
let currentMode = "list"; // 'list' | 'add'
let currentFilter = "all"; // 'all' | 'expense' | 'income'
let currentCategoryFilter = "all";
let currentSort = "date-desc";
let currentDateFilter = "all";

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
      <button class="txn-del" title="Delete" aria-label="Delete transaction" data-id="${
        t.id
      }">&times;</button>
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
    if (
      e.target === addWrap ||
      e.target.classList.contains("txn-modal-backdrop")
    ) {
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
    transactions.push({
      id,
      type,
      category,
      note,
      amount,
      date,
      recurringId: recId,
    });
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
/* Fixed category options (no custom categories for now) */
const categoryOptions = [
  "Bills & Utilities",
  "Transportation",
  "Groceries",
  "Dining & Entertainment",
  "Shopping & Personal Care",
  "Education & Business",
  "Savings & Investments",
  "Miscellaneous",
];

let monthlyBudget = null;

let savingsGoal = null;

function getDaysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function renderSavings() {
  const container = document.getElementById("savings-overview");
  if (!container) return;

  if (!savingsGoal) {
    container.innerHTML = `
      <p>No savings goal set yet.</p>
      <button id="add-goal-btn" class="bdgt-btn">Add Savings Goal</button>
    `;
    document
      .getElementById("add-goal-btn")
      .addEventListener("click", showSavingsForm);
    return;
  }

  const saved = savingsGoal.saved || 0;

  container.innerHTML = `
    <table class="budgets">
      <thead>
        <tr>
          <th>Goal Name</th>
          <th>Target Amount ($)</th>
          <th>Money Saved ($)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${savingsGoal.name}</td>
          <td>${savingsGoal.amount.toFixed(2)}</td>
          <td>${saved.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="center-row">
  <button id="edit-goal-btn" class="btn">Edit Goal</button>
</div>

  `;

  document
    .getElementById("edit-goal-btn")
    .addEventListener("click", showSavingsForm);
}

function showSavingsForm() {
  const container = document.getElementById("savings-overview");
  if (!container) return;

  const existing = savingsGoal || {
    name: "",
    amount: 0,
    saved: 0,
    autoFromLeftover: false,
  };

  container.innerHTML = `
    <table class="budgets">
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Goal Name</td>
          <td>
            <input 
              type="text" 
              id="goal-name" 
              class="category-amount"
              value="${existing.name}">
          </td>
        </tr>
        <tr>
          <td>Target Amount ($)</td>
          <td>
            <input 
              type="number" 
              id="goal-amount" 
              class="category-amount"
              min="0"
              step="0.01"
              value="${existing.amount || 0}">
          </td>
        </tr>
        <tr>
          <td>Money Saved ($)</td>
          <td>
            <input 
              type="number" 
              id="goal-saved" 
              class="category-amount"
              min="0"
              step="0.01"
              value="${existing.saved || 0}">
          </td>
        </tr>
      </tbody>
    </table>

    <label style="display:block; margin-top: 8px;">
      <input 
        type="checkbox" 
        id="goal-auto-leftover" 
        ${existing.autoFromLeftover ? "checked" : ""}>
      Automatically add leftover budget to savings goal at the end of the month?
    </label>

    <div class="budget-actions" style="margin-top: 12px;">
      <button id="cancel-goal" class="bdgt-btn">Cancel</button>
      <button id="save-goal" class="bdgt-btn">Save Goal</button>
    </div>
  `;

  document
    .getElementById("cancel-goal")
    .addEventListener("click", renderSavings);

  document.getElementById("save-goal").addEventListener("click", () => {
    const name = document.getElementById("goal-name").value.trim();
    const amountVal = parseFloat(document.getElementById("goal-amount").value);
    const savedVal = parseFloat(document.getElementById("goal-saved").value);
    const auto = document.getElementById("goal-auto-leftover").checked;

    if (!name) {
      alert("Please enter a goal name.");
      return;
    }
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      alert("Please enter a valid target amount.");
      return;
    }

    const saved = Number.isFinite(savedVal) && savedVal >= 0 ? savedVal : 0;

    savingsGoal = {
      name,
      amount: amountVal,
      saved,
      autoFromLeftover: auto,
    };

    // Cap saved so it never exceeds target
    if (savingsGoal.saved > savingsGoal.amount) {
      savingsGoal.saved = savingsGoal.amount;
    }

    renderSavings();
  });
}

function hasBudget() {
  return (
    monthlyBudget &&
    Number.isFinite(monthlyBudget.income) &&
    monthlyBudget.income > 0 &&
    Array.isArray(monthlyBudget.categories) &&
    monthlyBudget.categories.length > 0
  );
}

function computeMonthlyTotals() {
  if (!hasBudget()) return { income: 0, spending: 0, leftover: 0 };

  const income = monthlyBudget.income;
  const spending = monthlyBudget.categories.reduce(
    (sum, item) => sum + (item.amount || 0),
    0
  );
  return {
    income,
    spending,
    leftover: income - spending,
  };
}

function renderBudget(period) {
  const overview = document.getElementById("budget-overview");
  if (!overview) return;

  const days = getDaysInCurrentMonth();
  const totals = computeMonthlyTotals();

  // If no budget yet, show one unified "Make a Budget" button for all periods
  if (!hasBudget()) {
    overview.innerHTML = `
      <div>
        <p>No budget has been created yet.</p>
        <button id="make-budget-btn" class="btn">Make a Budget</button>
      </div>
    `;
    document
      .getElementById("make-budget-btn")
      .addEventListener("click", showBudgetForm);
    renderSavings();
    return;
  }

  // We have a monthly budget; scale for different views
  let factor = 1;
  let periodLabel = "";
  if (period === "Daily") {
    factor = 1 / days;
    periodLabel = "Daily";
  } else if (period === "Yearly") {
    factor = 12;
    periodLabel = "Yearly";
  } else {
    // Monthly (default)
    factor = 1;
    periodLabel = "Monthly";
  }

  const incomeScaled = totals.income * factor;
  const spendingScaled = totals.spending * factor;
  const leftoverScaled = totals.leftover * factor;

  // ONE line: Income | Planned | Leftover (no period words in labels)
  let summaryHtml = `
    <div class="budget-summary">
      <p>
        <strong>Income:</strong> $${incomeScaled.toFixed(2)}
        &nbsp; | &nbsp;
        <strong>Planned Spending:</strong> $${spendingScaled.toFixed(2)}
        &nbsp; | &nbsp;
        <strong>Leftover:</strong> $${leftoverScaled.toFixed(2)}
      </p>
  `;

  // Keep explanatory note for scaling
  if (period === "Daily") {
    summaryHtml += `<p>(Scaled from your Monthly budget over ${days} days.)</p>`;
  } else if (period === "Yearly") {
    summaryHtml += `<p>(Scaled from your Monthly budget × 12.)</p>`;
  }

  summaryHtml += `</div>`;

  // Table now: Category | Budgeted ($) | Spent ($)
  let tableHtml = `
    <table class="budgets">
      <tr>
        <th>Category</th>
        <th>Budgeted ($)</th>
        <th>Spent ($)</th>
      </tr>
  `;

  monthlyBudget.categories.forEach((item) => {
    const budgetAmountScaled = (item.amount || 0) * factor;
    const spent = getSpentForCategory(item.category, period);

    tableHtml += `
      <tr>
        <td>${item.category}</td>
        <td>${budgetAmountScaled.toFixed(2)}</td>
        <td>${spent.toFixed(2)}</td>
      </tr>
    `;
  });

  tableHtml += `</table>`;

  const editButtonHtml = `
   <div class="center-row">
  <button id="edit-budget-btn" class="btn">Edit Budget</button>
  </div>`;

  overview.innerHTML = summaryHtml + tableHtml + editButtonHtml;

  document
    .getElementById("edit-budget-btn")
    .addEventListener("click", showBudgetForm);

  renderSavings();
}

/* ----- Helpers for "Spent" per category / period ----- */

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isSameMonthYear(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  );
}

function isSameYear(d1, d2) {
  return d1.getFullYear() === d2.getFullYear();
}

/**
 * Get amount spent (expenses only) for a given category
 * in the current period: "Daily" | "Monthly" | "Yearly"
 */
function getSpentForCategory(category, period) {
  if (!Array.isArray(transactions)) return 0;

  const today = new Date();
  let total = 0;

  for (const t of transactions) {
    if (!t) continue;
    if (t.type !== "expense") continue; // only count expenses
    if (t.category !== category) continue;
    if (!t.date) continue;

    const d = parseISO(t.date);

    if (period === "Daily" && !isSameDay(d, today)) continue;
    if (period === "Monthly" && !isSameMonthYear(d, today)) continue;
    if (period === "Yearly" && !isSameYear(d, today)) continue;

    if (Number.isFinite(t.amount)) {
      total += t.amount;
    }
  }

  return total;
}

function showBudgetForm() {
  const overview = document.getElementById("budget-overview");
  if (!overview) return;

  const existing = monthlyBudget || {
    income: 0,
    categories: [],
  };

  let rowsHtml = "";
  existing.categories.forEach((item, idx) => {
    rowsHtml += createCategoryRowHtml(idx, item.category, item.amount);
  });

  overview.innerHTML = `
    <div class="budget-form">
      <label>
        Monthly Income ($):
        <input 
          type="number" 
          id="budget-income" 
          min="0" 
          step="0.01"
          value="${existing.income || 0}">
      </label>

      <table class="budgets">
        <thead>
          <tr>
            <th>Category</th>
            <th>Monthly Amount ($)</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="budget-categories">
          ${rowsHtml}
        </tbody>
      </table>

      <button id="add-category-btn" class="bdgt-btn">Add Category</button>

      <p id="budget-total-display"></p>

      <div class="budget-actions">
        <button id="cancel-budget" class="bdgt-btn">Cancel</button>
        <button id="save-budget" class="bdgt-btn">Save Budget</button>
      </div>
    </div>
  `;

  const categoriesBody = document.getElementById("budget-categories");

  function getNextRowIndex() {
    const rows = categoriesBody.querySelectorAll(".budget-category-row");
    return rows.length;
  }

  function addCategoryRow(category = "", amount = 0) {
    const idx = getNextRowIndex();
    categoriesBody.insertAdjacentHTML(
      "beforeend",
      createCategoryRowHtml(idx, category, amount)
    );
    attachRowHandlers();
    updateTotal();
  }

  function attachRowHandlers() {
    // Remove buttons
    const removeButtons = categoriesBody.querySelectorAll(
      ".remove-category-btn"
    );
    removeButtons.forEach((btn) => {
      btn.onclick = () => {
        const row = btn.closest(".budget-category-row");
        if (row) {
          row.remove();
          updateTotal();
        }
      };
    });

    // Amount inputs → update total
    const amountInputs = categoriesBody.querySelectorAll(".category-amount");
    amountInputs.forEach((inp) => {
      inp.oninput = updateTotal;
    });
  }

  function updateTotal() {
    const rows = categoriesBody.querySelectorAll(".budget-category-row");
    let sum = 0;

    rows.forEach((row) => {
      const amountInput = row.querySelector(".category-amount");
      const v = parseFloat(amountInput.value);
      if (Number.isFinite(v) && v > 0) sum += v;
    });

    const totalDisplay = document.getElementById("budget-total-display");
    const incomeVal = parseFloat(
      document.getElementById("budget-income").value
    );

    if (!totalDisplay) return;

    if (!Number.isFinite(incomeVal) || incomeVal <= 0) {
      totalDisplay.innerHTML = `
        <strong>Total Planned Spending:</strong> $${sum.toFixed(
          2
        )} (Enter a valid income to compare)
      `;
      return;
    }

    const remaining = incomeVal - sum;
    const status =
      remaining < 0
        ? `<span style="color:red;">Over by $${Math.abs(remaining).toFixed(
            2
          )}</span>`
        : `<span>Remaining: $${remaining.toFixed(2)}</span>`;

    totalDisplay.innerHTML = `
      <strong>Total Planned Spending:</strong> $${sum.toFixed(2)}<br>
      ${status}
    `;
  }

  // If no categories yet, start with one empty row
  if (!existing.categories.length) {
    addCategoryRow();
  } else {
    attachRowHandlers();
    updateTotal();
  }

  document
    .getElementById("add-category-btn")
    .addEventListener("click", () => addCategoryRow());

  document
    .getElementById("cancel-budget")
    .addEventListener("click", () => renderBudget("Monthly"));

  document.getElementById("save-budget").addEventListener("click", () => {
    const incomeVal = parseFloat(
      document.getElementById("budget-income").value
    );
    if (!Number.isFinite(incomeVal) || incomeVal <= 0) {
      alert("Please enter a valid monthly income greater than 0.");
      return;
    }

    const rows = categoriesBody.querySelectorAll(".budget-category-row");
    const newCategories = [];
    let sumSpending = 0;

    rows.forEach((row) => {
      const select = row.querySelector(".category-select");
      const amountInput = row.querySelector(".category-amount");

      const cat = select.value;
      const amt = parseFloat(amountInput.value);

      if (!cat) return;
      if (!Number.isFinite(amt) || amt < 0) return;

      newCategories.push({
        category: cat,
        amount: amt,
      });
      sumSpending += amt;
    });

    if (!newCategories.length) {
      alert("Please add at least one category with a positive amount.");
      return;
    }

    if (sumSpending > incomeVal + 1e-6) {
      alert(
        `Your planned spending ($${sumSpending.toFixed(
          2
        )}) exceeds your monthly income ($${incomeVal.toFixed(2)}).`
      );
      return;
    }

    monthlyBudget = {
      income: incomeVal,
      categories: newCategories,
    };

    if (savingsGoal && savingsGoal.autoFromLeftover) {
      const today = new Date();
      const daysInMonth = getDaysInCurrentMonth();
      if (today.getDate() === daysInMonth) {
        const totalsAfter = computeMonthlyTotals();
        const leftover = totalsAfter.leftover;

        if (leftover > 0) {
          const prevSaved = savingsGoal.saved || 0;
          savingsGoal.saved = prevSaved + leftover;

          // Cap saved so it never exceeds the target amount
          if (savingsGoal.saved > savingsGoal.amount) {
            savingsGoal.saved = savingsGoal.amount;
          }
        }
      }
    }

    renderBudget("Monthly");
  });
}

/* Helper to generate the HTML for a single category row */
function createCategoryRowHtml(index, selectedCategory = "", amount = 0) {
  let optionsHtml = `<option value="">Select</option>`;
  categoryOptions.forEach((cat) => {
    const selectedAttr = cat === selectedCategory ? "selected" : "";
    optionsHtml += `<option value="${cat}" ${selectedAttr}>${cat}</option>`;
  });

  return `
    <tr class="budget-category-row" data-row-index="${index}">
      <td>
        <select class="category-select">
          ${optionsHtml}
        </select>
      </td>
      <td>
        <input 
          type="number" 
          class="category-amount"
          min="0"
          step="0.01"
          value="${amount || 0}">
      </td>
      <td>
        <button type="button" class="remove-category-btn bdgt-btn">Remove</button>
      </td>
    </tr>
  `;
}

/* ---------- Time period toggle setup ---------- */

const spans = document.querySelectorAll(".home-range span");
spans.forEach((span) => {
  span.addEventListener("click", () => {
    spans.forEach((s) => s.classList.remove("is-active"));
    span.classList.add("is-active");
    const period = span.textContent.trim();
    renderBudget(period);
  });
});

/* Default view: Monthly */
const defaultBudgetSpan = document.getElementById("budget-monthly");
if (defaultBudgetSpan) {
  defaultBudgetSpan.classList.add("is-active");
  renderBudget("Monthly");
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
    name: document.getElementById("pf-name"),
    income: document.getElementById("pf-income"),
    email: document.getElementById("pf-email"),
    phone: document.getElementById("pf-phone"),
    city: document.getElementById("pf-city"),
    currency: document.getElementById("pf-currency"),
  };

  const btnSave = document.getElementById("pf-save");
  const btnEdit = document.getElementById("pf-edit");

  if (!btnSave || !btnEdit || Object.values(fields).some((el) => !el)) return;

  const loadProfile = () => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveProfile = (data) => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
    } catch {}
  };

  const setDisabled = (isDisabled) => {
    Object.values(fields).forEach((el) => (el.disabled = isDisabled));
  };

  const setMode = (mode) => {
    // mode: 'view' or 'edit'
    const view = mode === "view";
    setDisabled(view);
    btnEdit.hidden = !view; // show Edit only in view
    btnSave.hidden = view; // show Save only in edit
  };

  const apply = (data) => {
    fields.name.value = data?.name ?? "";
    fields.income.value = data?.income ?? "";
    fields.email.value = data?.email ?? "";
    fields.phone.value = data?.phone ?? "";
    fields.city.value = data?.city ?? "";
    fields.currency.value = data?.currency ?? "USD";
  };

  // init
  const existing = loadProfile();
  apply(existing);

  // if we have nothing saved yet -> start in EDIT with Save visible
  const nothingSaved =
    !existing ||
    Object.values(existing).every(
      (v) => v === "" || v === null || typeof v === "undefined"
    );

  setMode(nothingSaved ? "edit" : "view");

  // wire buttons
  btnEdit.addEventListener("click", () => setMode("edit"));

  btnSave.addEventListener("click", () => {
    const data = {
      name: fields.name.value.trim(),
      income: fields.income.value ? Number(fields.income.value) : "",
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      city: fields.city.value.trim(),
      currency: fields.currency.value || "USD",
    };
    saveProfile(data);
    setMode("view");
  });
})();

//  ON-SCREEN KEYBOARD
(function () {
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
  document.body.insertAdjacentHTML("beforeend", keyboardHTML);
  const keyboard = document.getElementById("on-screen-keyboard");

  function showKeyboard(input) {
    activeInput = input;
    keyboardVisible = true;

    keyboard.hidden = false;

    // scroll in put into view
    setTimeout(() => {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
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

    if (inputType === "number") {
      // Only allow numbers and one decimal point
      if (key === "." && currentValue.includes(".")) return;
      if (!/[0-9.]/.test(key)) return;
    }

    const newValue =
      currentValue.slice(0, selectionStart) +
      key +
      currentValue.slice(selectionStart);
    activeInput.value = newValue;

    // Trigger input event for any listeners
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));

    // Move cursor forward
    const newPos = selectionStart + 1;
    activeInput.setSelectionRange(newPos, newPos);
  }

  function handleBackspace() {
    if (!activeInput) return;

    const currentValue = activeInput.value;
    const selectionStart = activeInput.selectionStart || currentValue.length;

    if (selectionStart === 0) return;

    const newValue =
      currentValue.slice(0, selectionStart - 1) +
      currentValue.slice(selectionStart);
    activeInput.value = newValue;

    activeInput.dispatchEvent(new Event("input", { bubbles: true }));

    const newPos = selectionStart - 1;
    activeInput.setSelectionRange(newPos, newPos);
  }

  keyboard.addEventListener("click", (e) => {
    const btn = e.target.closest(".key");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const key = btn.dataset.key;
    const action = btn.dataset.action;

    if (action === "backspace") {
      handleBackspace();
    } else if (action === "done") {
      hideKeyboard();
      if (activeInput) activeInput.blur();
    } else if (key) {
      handleKey(key);
    }
  });

  // Attach to all relevant inputs
  function attachKeyboard() {
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="number"], input[type="email"], input[type="tel"]'
    );

    inputs.forEach((input) => {
      // Skip if already attached
      if (input.dataset.keyboardAttached === "true") return;
      input.dataset.keyboardAttached = "true";

      // Show keyboard on focus/click
      const showHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showKeyboard(input);
      };

      input.addEventListener("focus", showHandler);
      input.addEventListener("click", showHandler);
      input.addEventListener("touchstart", showHandler, { passive: false });
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
  document.addEventListener("click", (e) => {
    if (!keyboardVisible) return;
    if (keyboard.contains(e.target)) return;
    if (
      e.target.matches(
        'input[type="text"], input[type="number"], input[type="email"], input[type="tel"]'
      )
    )
      return;

    hideKeyboard();
  });

  // Prevent the keyboard from closing when clicking on it
  keyboard.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  keyboard.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  // Make functions available globally if needed
  window.onScreenKeyboard = {
    show: showKeyboard,
    hide: hideKeyboard,
  };
})();
