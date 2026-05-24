/* Desktop and mobile screen navigation */
function updateMobileHeader(slideIdx) {
  const { stepNum } = getSlideInfo(slideIdx);
  const slide = allSlides[slideIdx];
  const lblEl = slide ? slide.querySelector('.screen-lbl') : null;
  const screenName = lblEl ? lblEl.textContent.replace(/^Screen\s*\d+\s*[·•·]\s*/i, '').trim() : '';
  const baseTitle = steps[stepNum - 1].title;
  document.getElementById('step-title').innerHTML = screenName
    ? `${baseTitle}<span style="color:#aaa;font-weight:400"> › </span>${screenName}`
    : baseTitle;
  document.querySelectorAll('.step-item').forEach((el, i) => el.classList.toggle('active', i === stepNum - 1));
  document.querySelectorAll('.mob-dot').forEach((d, i) => d.classList.toggle('active', i === stepNum - 1));
  document.getElementById('mob-prev').disabled = slideIdx === 0;
  const isLastSlide = slideIdx === totalSlides - 1;
  const mobNext = document.getElementById('mob-next');
  if (mobNext) { mobNext.disabled = isLastSlide; mobNext.style.display = isLastSlide ? 'none' : ''; }
  const mobJourneyBtn = document.getElementById('mob-journey-btn');
  if (mobJourneyBtn) mobJourneyBtn.style.display = isLastSlide ? '' : 'none';
  curSlide = slideIdx;
  curStep = stepNum;
  clearTimeout(descTimer);
  document.querySelectorAll('.screen-desc').forEach(el => el.classList.remove('desc-visible'));
  const currentDesc = slide ? slide.querySelector('.screen-desc') : null;
  if (currentDesc) { descTimer = setTimeout(() => currentDesc.classList.add('desc-visible'), 1500); }
}

function scrollToSlide(idx) {
  idx = Math.max(0, Math.min(idx, totalSlides - 1));
  sa.scrollTo({ left: idx * sa.clientWidth, behavior: 'smooth' });
  updateMobileHeader(idx);
  if (idx === 8) setTimeout(scrollS2Chat, 300);
}

function mobNavigate(d) { scrollToSlide(curSlide + d); }

let scrollDebounce;
sa.addEventListener('scroll', () => {
  clearTimeout(scrollDebounce);
  scrollDebounce = setTimeout(() => {
    const w = sa.clientWidth;
    if (!w) return;
    const idx = Math.min(Math.round(sa.scrollLeft / w), totalSlides - 1);
    if (idx !== curSlide) updateMobileHeader(idx);
  }, 80);
}, { passive: true });

function showDesktopStep(n) {
  const totalSteps = steps.length;
  n = Math.max(1, Math.min(totalSteps, n));
  stepSections.forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('step-' + n);
  if (sec) sec.classList.add('active');
  desktopStep = n;
  document.getElementById('step-title').innerHTML = steps[n - 1].title;
  document.getElementById('step-counter').textContent = `Step ${n} of ${totalSteps}`;
  document.getElementById('step-desc-bar').innerHTML = steps[n - 1].desc;
  document.querySelectorAll('.step-item').forEach((el, i) => el.classList.toggle('active', i === n - 1));
  if (n === 5) setTimeout(scrollS2Chat, 50);
  if (n === 3) setTimeout(function () { var c = document.getElementById('s7s2-chat'); if (c) c.scrollTop = c.scrollHeight; }, 80);
  if (n === 10) { setTimeout(scaleStep10Desktop, 10); setTimeout(function () { var c = document.getElementById('s10s2-chat'); if (c) c.scrollTop = c.scrollHeight; }, 80); }
  if (n === 9) { setTimeout(scaleStep9Desktop, 10); setTimeout(function () { var c = document.getElementById('s8s3-chat'); if (c) c.scrollTop = c.scrollHeight; }, 80); }
  if (n === 2) setTimeout(scaleStep2Desktop, 10);
  const dp = document.getElementById('desk-prev');
  const dn = document.getElementById('desk-next');
  const dc = document.getElementById('desk-counter');
  if (dp) dp.disabled = n === 1;
  const atEnd = n === totalSteps;
  if (dn) { dn.disabled = false; dn.style.display = atEnd ? 'none' : ''; }
  if (dc) dc.textContent = `Step ${n} of ${totalSteps}`;
  const deskJourneyBtn = document.getElementById('desk-journey-btn');
  if (deskJourneyBtn) deskJourneyBtn.style.display = atEnd ? '' : 'none';
}

function desktopNavigate(d) { showDesktopStep(desktopStep + d); }

function scrollToStep(stepNum) {
  closeSidebar();
  if (isMobile()) {
    scrollToSlide(stepFirstSlide[stepNum] ?? 0);
  } else {
    showDesktopStep(stepNum);
  }
}

document.addEventListener('keydown', e => {
  if (isMobile()) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') mobNavigate(1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') mobNavigate(-1);
  } else {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') desktopNavigate(1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') desktopNavigate(-1);
  }
});

function updatePhoneZoom() {
  const vw = window.innerWidth;
  if (isMobile()) {
    const z = Math.min(1, (vw - 24) / 305);
    document.querySelectorAll('.phone-frame,.phone-frame-web')
      .forEach(el => el.style.zoom = z);
  } else {
    document.querySelectorAll('.phone-frame,.phone-frame-web')
      .forEach(el => el.style.zoom = '');
  }
  scaleStep2Desktop();
}

updatePhoneZoom();
window.addEventListener('resize', updatePhoneZoom);

if (isMobile()) {
  updateMobileHeader(0);
} else {
  showDesktopStep(1);
}
