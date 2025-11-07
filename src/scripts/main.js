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
const STORAGE_KEY = 'cmsc434.transactions.v1';
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
  { id: 3, type: 'income',  category: 'Paycheck',       note: 'Campus job',       amount: 320.00, date: '2025-10-18' },
  { id: 4, type: 'expense', category: 'Dining',         note: 'Lunch with team',  amount: 12.75, date: '2025-10-19' },
  { id: 5, type: 'expense', category: 'Books',          note: 'Used textbook',    amount: 40.00, date: '2025-10-20' },
  { id: 6, type: 'income',  category: 'Scholarship',    note: 'Stipend',          amount: 150.00, date: '2025-10-21' },
  { id: 7, type: 'expense', category: 'Health',         note: 'Yoga class',       amount: 18.00, date: '2025-10-21' },
  { id: 8, type: 'expense', category: 'Coffee',         note: 'Study break',      amount: 4.75,  date: '2025-10-22' }
];
saveTxns(transactions);

const txnList  = document.querySelector('#txn-list');
const filterBtns = Array.from(document.querySelectorAll('.seg-btn'));
const form     = document.querySelector('#txn-form');
const typeEl   = document.querySelector('#txn-type');
const amtEl    = document.querySelector('#txn-amount');
const dateEl   = document.querySelector('#txn-date');
const noteEl   = document.querySelector('#txn-note');

function formatCurrency(num){
  return (num < 0 ? '-$' : '$') + Math.abs(num).toFixed(2);
}

function renderTransactions(view = 'all'){
  if(!txnList) return;
  txnList.innerHTML = '';

  const filtered = transactions.filter(t =>
    view === 'all' ? true : t.type === view
  );

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
      // preserve current view
      const active = document.querySelector('.seg-btn.is-selected')?.dataset.filter || 'all';
      renderTransactions(active);
    });
  });
}

// Toggle segmented control
if(filterBtns.length){
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.toggle('is-selected', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderTransactions(btn.dataset.filter);
    });
  });
}

// Initialize date field to today
if (dateEl){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  dateEl.value = `${yyyy}-${mm}-${dd}`;
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

    // Reset quick fields
    amtEl.value = '';
    noteEl.value = '';
    document.getElementById('category').value = '';

    const active = document.querySelector('.seg-btn.is-selected')?.dataset.filter || 'all';
    renderTransactions(active);
  });
}

// First render (All)
renderTransactions('all');


const spans = document.querySelectorAll('span[id^="budget-"]');
const overview = document.getElementById('budget-overview');

  const BUDGETS = {
    Today: {
      Utilities: 5, Transportation: 10, "Groceries & Food": 25, Bills: 0,
      Education: 0, Entertainment: 10, Insurance: 0, Medical: 0
    },
    Week: {
      Utilities: 30, Transportation: 60, "Groceries & Food": 150, Bills: 50,
      Education: 40, Entertainment: 60, Insurance: 25, Medical: 20
    },
    Month: {
      Utilities: 120, Transportation: 250, "Groceries & Food": 600, Bills: 200,
      Education: 150, Entertainment: 250, Insurance: 120, Medical: 100
    },
    Year: {
      Utilities: 1440, Transportation: 3000, "Groceries & Food": 7200, Bills: 2400,
      Education: 1800, Entertainment: 3000, Insurance: 1440, Medical: 1200
    }
  };

  function renderBudget(period) {
    const data = BUDGETS[period];
    let ret = `<table class='budgets' ">
                 <tr><th>Category</th><th>Cap($)</th></tr>`;
    for (const category in data) {
      const amount = data[category];
      ret += `<tr><td>${category}</td><td>${amount.toFixed(2)}</td></tr>`;
    }
    ret += `</table>             <button id="edit-button" class="btn">Edit Budget</button>`;
    overview.innerHTML = ret;
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

// === SPENDING GRAPH WITH PERFECT AXIS ALIGNMENT ===
(function() {
  const canvas = document.getElementById('spending-graph');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const data = {
    week: [40, 60, 50, 70, 90, 80, 100],
    month: [200, 300, 250, 400, 350, 450, 500],
    year: [600, 550, 500, 450, 400, 350, 300] // downward trend
  };

  const buttons = document.querySelectorAll('.spending-range span');
  const insights = document.getElementById('spending-insight-list');

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
    const color = trend >= 0 ? 'green' : 'red';

    // Determine time unit
    let timeUnit = '';
    if (label === 'week' || label === 'month') timeUnit = 'days';
    else if (label === 'year') timeUnit = 'months';
    else timeUnit = 'hours';

    // === Axes ===
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(xStart, marginTop);
    ctx.lineTo(xStart, yZero);
    ctx.lineTo(xEnd, yZero);
    ctx.stroke();

    // === Y-axis Labels ===
    ctx.fillStyle = '#222';
    ctx.font = '13px Arial';
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

    // === X-axis Labels ===
    ctx.fillStyle = '#222';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < values.length; i++) {
      const x = xStart + i * stepX;
      ctx.fillText(i + 1, x + 2, yZero + 18); // shifted slightly right (+2)
    }

    // === Axis Titles ===
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#111';
    ctx.fillText(`Time (${timeUnit})`, (w / 2), h - 15); // centered X title

    // Center Y-axis title within graph area
    const yCenter = marginTop + (yZero - marginTop) / 2;
    ctx.save();
    ctx.translate(25, yCenter);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Spending ($)', 0, 0);
    ctx.restore();

    // === Draw Line ===
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

  function showInsights(values, label) {
    const trend = values[values.length - 1] - values[0];
    const direction = trend >= 0 ? 'upward' : 'downward';
    insights.innerHTML = `
      <li>${label} trend: <strong style="color:${trend >= 0 ? 'green' : 'red'}">${direction}</strong></li>
    `;
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const range = btn.dataset.range;
      draw(data[range], range);
      showInsights(data[range], range);
    });
  });

  // Initial draw
  draw(data.week, 'week');
  showInsights(data.week, 'week');
})();

// === PIE CHART ===
(function() {
  const canvas = document.getElementById('category-pie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const legend = document.getElementById('category-legend');

  //example data
  const data = {
    Groceries: 30,
    Dining: 20,
    Books: 10,
    Coffee: 15,
    Health: 25
  };

  const colors = ['#4caf50', '#ff9800', '#2196f3', '#e91e63', '#9c27b0'];

  const entries = Object.entries(data);
  const total = entries.reduce((a, [, v]) => a + v, 0);

  let start = 0;
  entries.forEach(([label, value], i) => {
    const angle = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(130, 130);
    ctx.arc(130, 130, 100, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    start += angle;
  });

  // Simple legend
  legend.innerHTML = entries.map(
    ([label, _], i) => `<li><span style="background:${colors[i]}"></span>${label}</li>`
  ).join('');
})();
