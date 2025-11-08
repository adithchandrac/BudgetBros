(function() {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const tabs = $$('.tab');
  const panels = $$('.panel');

  function show(tabName){
    panels.forEach(p => p.classList.remove('show'));
    tabs.forEach(t => t.classList.remove('active'));
    const panel = document.querySelector(`#panel-${tabName}`);
    if(panel) panel.classList.add('show');
    const tab = tabs.find(t => t.dataset.tab === tabName);
    if(tab) tab.classList.add('active');
  }

  document.querySelector('.tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if(!btn) return;
    show(btn.dataset.tab);
  });

  /* land on the new Home */
  show('spending');

  /* demo notice (kept) */
  const profileBtn = $('#profile-btn');
  const notice = $('#notice');
  const closeNotice = $('#notice-close');
  if (profileBtn) profileBtn.addEventListener('click', () => notice.hidden = false);
  if (closeNotice) closeNotice.addEventListener('click', () => notice.hidden = true);
})();

// ====== Spending: graph placeholder + transactions + filter + add/remove (localStorage) ======
const STORAGE_KEY = 'cmsc434.transactions.v3';
function loadTxns(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  }catch(e){ return null; }
}
function saveTxns(arr){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }catch(e){}
}

// Seed (no emojis)
let transactions = loadTxns() || [
  { id: 1, type: 'expense', category: 'Groceries',      note: 'Trader Joes',      amount: 54.18, date: '2025-10-17' },
  { id: 2, type: 'expense', category: 'Transportation', note: 'Metro card',       amount: 25.00, date: '2025-10-18' },
  { id: 3, type: 'income',  category: 'Paycheck',       note: 'Campus job',       amount: 320.00, date: '2025-10-18' }
];
saveTxns(transactions);

// Elements
const txnList   = document.querySelector('#txn-list');
const addWrap   = document.querySelector('#add-form-wrap');
const seg       = document.querySelector('#txn-filter-seg');
const toolbar   = document.querySelector('.txn-toolbar');
const addRow    = document.querySelector('.txn-add-row');

const form      = document.querySelector('#txn-form');
const openForm  = document.querySelector('#txn-open-form');
const cancelBtn = document.querySelector('#txn-cancel');

const typeEl = document.querySelector('#txn-type');
const amtEl  = document.querySelector('#txn-amount');
const dateEl = document.querySelector('#txn-date');
const noteEl = document.querySelector('#txn-note');

// UI state
let currentMode   = 'list';       // 'list' | 'add'
let currentFilter = 'all';        // 'all' | 'expense' | 'income'

// Helpers
function formatCurrency(num){
  return (num < 0 ? '-$' : '$') + Math.abs(num).toFixed(2);
}

function setMode(mode){
  currentMode = mode;
  const inAdd = (mode === 'add');

  // Show ONLY the add form in add mode
  if (toolbar) toolbar.hidden = inAdd;
  if (addRow)  addRow.hidden  = inAdd;
  if (txnList) txnList.hidden = inAdd;
  if (addWrap) addWrap.hidden = !inAdd;

  if (inAdd) {
    if (amtEl) amtEl.focus();
    // ensure date defaults to today each time
    if (dateEl){
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth()+1).padStart(2,'0');
      const dd = String(today.getDate()).padStart(2,'0');
      dateEl.value = `${yyyy}-${mm}-${dd}`;
    }
  } else {
    renderTransactions(currentFilter);
  }
}

function setFilter(filter, btn){
  currentFilter = filter;
  // update filter buttons UI
  if (seg){
    const btns = Array.from(seg.querySelectorAll('.seg-btn[data-filter]'));
    btns.forEach(b => {
      const on = (b === btn);
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  // always switch to list view when choosing a filter
  setMode('list');
}

function renderTransactions(view = 'all'){
  if(!txnList) return;
  txnList.innerHTML = '';

  const filtered = transactions.filter(t => view === 'all' ? true : t.type === view);

  // recent first
  filtered.sort((a, b) => (b.date.localeCompare(a.date)) || (b.id - a.id));

  for(const t of filtered){
    const item = document.createElement('div');
    item.className = 'txn';
    item.setAttribute('role','listitem');

    const sign = t.type === 'expense' ? -1 : +1;
    const displayAmount = sign * Math.abs(t.amount);

    item.innerHTML = `
      <div class="txn-left">
        <div class="txn-cat">${t.category}</div>
        <div class="txn-note">${t.note || ''}</div>
      </div>
      <div class="txn-right ${t.type}">
        <div class="txn-amt">${formatCurrency(displayAmount)}</div>
        <div class="txn-date">${t.date}</div>
      </div>
      <button class="txn-del" title="Delete" aria-label="Delete transaction" data-id="${t.id}">&times;</button>
    `;
    txnList.appendChild(item);
  }

  if(filtered.length === 0){
    const empty = document.createElement('p');
    empty.className = 'txn-empty';
    empty.textContent = 'No transactions to show.';
    txnList.appendChild(empty);
  }

  // Hook delete buttons
  Array.from(txnList.querySelectorAll('.txn-del')).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      transactions = transactions.filter(t => t.id !== id);
      saveTxns(transactions);
      renderTransactions(currentFilter);
    });
  });
}

// Wire filters (All / Expenses / Income)
if (seg){
  const btns = Array.from(seg.querySelectorAll('.seg-btn[data-filter]'));
  btns.forEach(b => {
    b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      setFilter(b.dataset.filter, b);
    });
  });
}

// Open Add (form-only screen)
if (openForm){
  openForm.addEventListener('click', () => {
    setMode('add');
  });
}

// Cancel Add -> back to current list
if (cancelBtn){
  cancelBtn.addEventListener('click', () => {
    setMode('list');
  });
}

// Add transaction handler
if(form){
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = (typeEl.value === 'income') ? 'income' : 'expense';
    const amount = parseFloat(amtEl.value);
    const category = document.getElementById('category').value;
    const date = dateEl.value;
    const note = (noteEl.value || '').trim();
    if(!amount || amount <= 0 || !category || !date) return;

    const id = (transactions.reduce((m,t)=>Math.max(m,t.id), 0) || 0) + 1;
    transactions.push({ id, type, category, note, amount, date });
    saveTxns(transactions);

    // reset quick fields
    amtEl.value = '';
    noteEl.value = '';
    document.getElementById('category').value = '';

    // go back to list and re-render using the currently selected filter
    setMode('list');
  });
}

// Initial render: default to ALL in list mode
setMode('list');
renderTransactions('all');



const spans = document.querySelectorAll('span[id^="budget-"]');
const overview = document.getElementById('budget-overview');

/*Category list*/ 
const categories = [ "Spending Limit", "Bills", "Insurance", "Transportation", "Education", "Business",
   "Savings", "Investment","Debt Repayment", "Groceries", "Dining", "Shopping"
   ,"Personal Care","Entertainment","Travel","Other Necessities","Miscellaneous"
  ];

  const budgets = {
    Daily: new Array(categories.length).fill(0),
    Weekly:  new Array(categories.length).fill(0),
    Monthly: new Array(categories.length).fill(0),
    Yearly:  new Array(categories.length).fill(0)
  };

  function renderBudget(period) {
    const data = budgets[period];
    let ret = ''
    if(data[0] == 0){
      ret = `
        <div>
          <p>No ${period} budget set yet.</p>
          <button id="new-budget-btn" class='btn' >Create ${period} budget</button>
        </div>
      `;
      document.getElementById("budget-overview").innerHTML = ret;
      const newBdgt = document.getElementById("new-budget-btn");
      newBdgt.addEventListener('click', () => budgetform(period));
      return;
    }
    else{
      let ret = `<table class='budgets'>
                  <tr><th>Category</th><th>Cap($)</th></tr>`;
      for (let x = 0; x < categories.length; x++) {
        ret += `<tr><td>${categories[x]}</td><td>${data[x]}</td></tr>`;
      }
      ret += `</table>             <button id="edit-button" class="btn">Edit Budget</button>`;
            document.getElementById("budget-overview").innerHTML = ret;
      }
  } 

  // Handle clicks and class toggling
  spans.forEach(span => {
    span.addEventListener('click', () => {
      spans.forEach(s => s.classList.remove('is-active'));
      span.classList.add('is-active');
      const period = span.textContent.trim();
      renderBudget(period);
    });
  });

  const defaultBudgetSpan = document.getElementById('budget-daily');
  if (defaultBudgetSpan) {
    defaultBudgetSpan.classList.add('is-active');
    renderBudget('Daily');
  }

  function budgetform(period){
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

  overview.innerHTML = ret + `
    <button id="cancel-budget" class="btn">Cancel</button>
    <button id="automate-budget" class="btn">Sample Budget</button>
    <button id="save-budget" class="btn">Save Budget</button>
  `;

  document.getElementById("cancel-budget")
    .addEventListener("click", () => { renderBudget(period); });

  document.getElementById("automate-budget").addEventListener("click", () => {
      const limit = parseFloat(document.getElementById("spending-amnt").value);
      if (!Number.isFinite(limit) || limit <= 1) {
        alert("Please assign a spending limit (> 1) so we can generate a sample budget");
        return;
      }

      // percentages aligned to your categories order
      // index 0 is Spending Limit (1.0 is just placeholder; we won't use it)
      const pct = [
        1.00,   // Spending Limit (ignored below)
        0.23,   // Bills
        0.05,   // Insurance
        0.08,   // Transportation
        0.03,   // Education
        0.01,   // Business
        0.10,   // Savings
        0.10,   // investment
        0.10,   // debt repayment
        0.12,   // Groceries
        0.03,   // Dining
        0.03,   // Shopping
        0.03,   // Personal care
        0.03,   // Entertainment
        0.03,   // Travel
        0.02,   // Other necessities
        0.00    // Miscellaneous (we’ll fill remainder here)
      ];

      // set each input from limit * pct[i]
      let allocated = 0;
      for (let i = 1; i < categories.length - 1; i++) { // exclude Misc row here
        const v = +(limit * pct[i]).toFixed(2);
        allocated += v;
        const el = document.getElementById(`${categories[i]}-amount`);
        if (el) el.value = v.toFixed(2);
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
        const el = document.getElementById(`${categories[i]}-amount`);
        const v = parseFloat(el?.value);
        vals[i] = Number.isFinite(v) ? v : 0;
        sum += vals[i];
      }

      const eps = 0.01;
      if (Math.abs(sum - limit) > eps) {
        alert(`All categories must add up to the Spending Limit. Current total: $${sum.toFixed(2)} vs $${limit.toFixed(2)}.`);
        return;
      }

      // Save to budgets and re-render
      budgets[period] = vals;
      renderBudget(period);
    });
}

//Spending Graph
(function() {
  const canvas = document.getElementById('spending-graph');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const data = {
    week: [100, 80, 90, 70, 50, 60, 40],
    month: [200, 300, 250, 400, 350],
    year: [300, 328, 524, 400, 430, 517, 600, 650, 750, 600, 750, 500] 
  };

  const buttons = document.querySelectorAll('.spending-range span');

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
    const color = trend >= 0 ? 'red' : 'green';

    // Determine time unit
    let timeUnit = '';
    if (label === 'week') timeUnit = 'days';
    else if (label === 'month') timeUnit = 'weeks'
    else if (label === 'year') timeUnit = 'months';
    else timeUnit = 'hours';

    // Axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(xStart, marginTop);
    ctx.lineTo(xStart, yZero);
    ctx.lineTo(xEnd, yZero);
    ctx.stroke();

    // Y-axis Labels
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const val = max - (max / ySteps) * i;
      const y = marginTop + ((yZero - marginTop) * i) / ySteps;
      ctx.fillText(val.toFixed(0), xStart - 5, y + 4);

      // gridline
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.strokeStyle = '#e0e0e0';
      ctx.stroke();
    }

    // X-axis Labels 
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < values.length; i++) {
      const x = xStart + i * stepX;
      ctx.fillText(i + 1, x + 2, yZero + 18);
    }

    // Axis Titles
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#111';
    ctx.fillText(`Time (${timeUnit})`, (w / 2), h - 15);

    // Center Y-axis title within graph area
    const yCenter = marginTop + (yZero - marginTop) / 2;
    ctx.save();
    ctx.translate(25, yCenter);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Spending ($)', 0, 0);
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

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const range = btn.dataset.range;
      draw(data[range], range);
    });
  });

  // Initial draw
  draw(data.week, 'week');
})();

//Pie Chart
(function() {
  const canvas = document.getElementById('category-pie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const legend = document.getElementById('category-legend');

  // Example data
  const data = {
    Groceries: 30,
    Dining: 20,
    Books: 10,
    Coffee: 15,
    Health: 25
  };

  const colors = ['#4caf50', '#ff9800', '#2196f3', '#e91e63', '#9c27b0'];
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  const centerX = 130;
  const centerY = 130;
  const radius  = 100;

  let startAngle = 0;

  entries.forEach(([label, value], i) => {
    const sliceAngle = (value / total) * Math.PI * 2;

    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();

    // Draw percentage label
    const midAngle = startAngle + sliceAngle / 2;
    const labelX = centerX + (radius / 1.5) * Math.cos(midAngle);
    const labelY = centerY + (radius / 1.5) * Math.sin(midAngle);

    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const percent = ((value / total) * 100).toFixed(0) + '%';
    ctx.fillText(percent, labelX, labelY);

    startAngle += sliceAngle;
  });

  // Simple legend
  legend.innerHTML = entries.map(
    ([label, _], i) => `<li><span style="background:${colors[i]}"></span>${label}</li>`
  ).join('');
})();
