/* Visual debug overlay — active when ?debug=true */
(function () {
  if (!/[?&]debug=true(&|$)/.test(window.location.search)) return;

  const style = document.createElement('style');
  style.textContent = `
    .demo-debug-panel {
      position: fixed; bottom: 12px; right: 12px; z-index: 99999;
      background: rgba(0,0,0,.88); color: #0f0; font: 11px/1.4 monospace;
      padding: 10px 12px; border-radius: 8px; max-width: 320px;
      max-height: 40vh; overflow: auto; pointer-events: none;
    }
    .demo-debug-panel b { color: #fff; }
    .demo-debug-highlight { outline: 2px dashed rgba(255,0,128,.6) !important; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'demo-debug-panel';
  panel.id = 'demo-debug-panel';
  document.body.appendChild(panel);

  function updatePanel() {
    const slide = document.querySelectorAll('.screen-wrap')[window.curSlide ?? 0];
    const lbl = slide?.querySelector('.screen-lbl')?.textContent?.trim() || '—';
    const stepSec = document.querySelector('.step-section.active');
    const stepId = stepSec?.id || '—';
    const imgs = slide ? [...slide.querySelectorAll('img[src]')].slice(0, 3).map(i => i.getAttribute('src')) : [];

    panel.innerHTML = [
      '<b>DEBUG MODE</b>',
      `step: ${stepId}`,
      `slide: ${lbl}`,
      `curSlide: ${window.curSlide ?? '—'}`,
      `curStep: ${window.curStep ?? '—'}`,
      imgs.length ? `assets:<br>${imgs.map(s => `· ${s}`).join('<br>')}` : '',
    ].join('<br>');
  }

  document.querySelectorAll('.screen-wrap').forEach((el, i) => {
    el.dataset.debugScreenIndex = String(i);
    el.addEventListener('mouseenter', () => {
      document.querySelectorAll('.demo-debug-highlight').forEach(n => n.classList.remove('demo-debug-highlight'));
      el.classList.add('demo-debug-highlight');
      updatePanel();
    });
  });

  document.querySelectorAll('.step-item').forEach(el => {
    el.addEventListener('mouseenter', updatePanel);
  });

  setInterval(updatePanel, 1500);
  updatePanel();
})();
