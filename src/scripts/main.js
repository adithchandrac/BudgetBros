(function() {
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

    const tabs = $$('.tab');
    const panels = $$('.panel');

    function show(tabName) {
        panels.forEach(p => p.classList.remove('show'));
        tabs.forEach(t => t.classList.remove('active'));
        const panel = document.querySelector(`#panel-${tabName}`);
        if (panel) panel.classList.add('show');
        const tab = tabs.find(t => t.dataset.tab === tabName);
        if (tab) tab.classList.add('active');
    }

    document.querySelector('.tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab');
        if (!btn) return;
        show(btn.dataset.tab);
    });

    show('text');

    const profileBtn = $('#profile-btn');
    const notice = $('#notice');
    const closeNotice = $('#notice-close');
    if (profileBtn) profileBtn.addEventListener('click', () => notice.hidden = false);
    if (closeNotice) closeNotice.addEventListener('click', () => notice.hidden = true);

    const choicesBtn = document.getElementById('choices-btn');
    const out = document.getElementById('choices-out');
    choicesBtn.addEventListener('click', () => {
        const cycle = (document.querySelector('input[name="cycle"]:checked') || {}).value;
        const cat = document.getElementById('category').value;
        out.innerHTML = `<p>Selected: ${cat}, ${cycle} <p>`;
    });

    const todoInput = $('#todo-input');
    const todoAdd = $('#todo-add');
    const todoList = $('#todo-list');

    function addItem(text) {
        if (!text) return;
        const li = document.createElement('li');
        li.className = 'item';
        li.innerHTML = `
      <span class="t"></span>
      <button class="btn del" type="button">×</button>
    `;
        li.querySelector('.t').textContent = text;
        todoList.appendChild(li);
    }
    if (todoAdd) todoAdd.addEventListener('click', () => {
        addItem(todoInput.value.trim());
        todoInput.value = '';
    });
    if (todoInput) todoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addItem(todoInput.value.trim());
            todoInput.value = '';
        }
    });
    if (todoList) {
        todoList.addEventListener('click', (e) => {
            const item = e.target.closest('.item');
            if (!item) return;
            
            if (e.target.closest('.del')) {
            item.classList.toggle('done');
            return;
            }
            item.classList.toggle('done');
        });
    }
})();