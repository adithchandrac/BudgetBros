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
