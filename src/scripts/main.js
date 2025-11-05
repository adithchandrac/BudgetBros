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
  show('home');

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
const catEl    = document.querySelector('#txn-category');
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
    const category = catEl.value.trim();
    const date = dateEl.value;
    const note = (noteEl.value || '').trim();
    if(!amount || amount <= 0 || !category || !date) return;

    const id = (transactions.reduce((m,t)=>Math.max(m,t.id), 0) || 0) + 1;
    transactions.push({ id, type, category, note, amount, date });
    saveTxns(transactions);

    // Reset quick fields
    amtEl.value = '';
    noteEl.value = '';

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

