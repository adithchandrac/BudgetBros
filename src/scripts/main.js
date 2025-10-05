(function(){
  const $ = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

  const tabs = $$('.tab');
  const panels = $$('.panel');

  function show(tabName){
    // Hide all panels
    panels.forEach(p => p.classList.remove('show'));
    // Deactivate all tabs
    tabs.forEach(t => t.classList.remove('active'));
    // Show the one panel we need
    const panel = document.querySelector(`#panel-${tabName}`);
    if(panel) panel.classList.add('show');
    // Highlight the clicked tab
    const tab = tabs.find(t => t.dataset.tab === tabName);
    if(tab) tab.classList.add('active');
  }

  // When a bottom tab is clicked
  document.querySelector('.tabs').addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab');
    if(!btn) return;
    show(btn.dataset.tab);
  });

  // Default to first tab
  show('text');

  // Profile notice
  const profileBtn = $('#profile-btn');
  const notice = $('#notice');
  const closeNotice = $('#notice-close');
  if (profileBtn) profileBtn.addEventListener('click', ()=> notice.hidden = false);
  if (closeNotice) closeNotice.addEventListener('click', ()=> notice.hidden = true);

  // Choices summary
  const choicesBtn = document.getElementById('choices-btn');
  const out = document.getElementById('choices-out');
    choicesBtn.addEventListener('click', ()=>{
      const cycle = (document.querySelector('input[name="cycle"]:checked')||{}).value;
      const cat = document.getElementById('category').value;
      out.innerHTML = `<p>Selected: ${cat}, ${cycle} <p>`;
    });

  // ToDo basics
  const todoInput = $('#todo-input');
  const todoAdd = $('#todo-add');
  const todoList = $('#todo-list');
  function addItem(text){
    if(!text) return;
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <input type="checkbox" />
      <span class="t"></span>
      <button class="btn del" type="button">×</button>
    `;
    li.querySelector('.t').textContent = text;
    todoList.appendChild(li);
  }
  if (todoAdd) todoAdd.addEventListener('click', ()=>{ addItem(todoInput.value.trim()); todoInput.value=''; });
  if (todoInput) todoInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addItem(todoInput.value.trim()); todoInput.value=''; }});
  if (todoList) todoList.addEventListener('click', (e)=>{
    const li = e.target.closest('.item');
    if(!li) return;
    if(e.target.matches('input[type="checkbox"]')) li.classList.toggle('done', e.target.checked);
    if(e.target.matches('.del')) li.remove();
  });
})();
