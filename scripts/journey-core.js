/* Journey runtime — steps[] injected at build time from journey.json */
const MOBILE_BP = 768;
function isMobile() { return window.innerWidth <= MOBILE_BP; }

const sa = document.querySelector('.screens-area');
const stepSections = Array.from(document.querySelectorAll('.step-section'));

const allSlides = [];
const slideToStep = [];
const stepFirstSlide = {};

stepSections.forEach((section, idx) => {
  const stepNum = idx + 1;
  stepFirstSlide[stepNum] = allSlides.length;
  Array.from(section.children).forEach(child => {
    if (child.classList.contains('screen-wrap')) {
      allSlides.push(child);
      slideToStep.push(stepNum);
    } else if (child.classList.contains('step2-phones')) {
      Array.from(child.children).forEach(c => {
        if (c.classList.contains('screen-wrap')) {
          allSlides.push(c);
          slideToStep.push(stepNum);
        }
      });
    }
  });
});
const totalSlides = allSlides.length;

function getSlideInfo(slideIdx) {
  const stepNum = slideToStep[slideIdx];
  const firstIdx = stepFirstSlide[stepNum];
  const nextFirst = stepFirstSlide[stepNum + 1] ?? totalSlides;
  const countInStep = nextFirst - firstIdx;
  const slideInStep = slideIdx - firstIdx + 1;
  return { stepNum, slideInStep, countInStep };
}

const dotsContainer = document.getElementById('mob-dots');
steps.forEach((_, i) => {
  const d = document.createElement('div');
  d.className = 'mob-dot' + (i === 0 ? ' active' : '');
  dotsContainer.appendChild(d);
});

let curSlide = 0;
let curStep = 1;
let descTimer = null;
let desktopStep = 1;

function scrollS2Chat() {
  var chat = document.getElementById('s4s2-chat');
  if (!chat) return;
  chat.scrollTop = chat.scrollHeight;
  setTimeout(function () { chat.scrollTop = chat.scrollHeight; }, 100);
}

function scaleStep9Desktop() {
  if (isMobile()) return;
  const sidebar = 260, padding = 32;
  const available = window.innerWidth - sidebar - padding;
  const natural = 305 + 20 + 305 + 20 + 305;
  const scale = Math.min(1, available / natural);
  const el = document.getElementById('step-9');
  if (el) el.style.zoom = scale < 1 ? scale : '';
}

function scaleStep7Desktop() {
  if (isMobile()) return;
  const sidebar = 260, padding = 32;
  const available = window.innerWidth - sidebar - padding;
  const natural = 305 + 20 + 305 + 20 + 305;
  const scale = Math.min(1, available / natural);
  const el = document.getElementById('step-7');
  if (el) el.style.zoom = scale < 1 ? scale : '';
}

function scaleStep10Desktop() {
  if (isMobile()) return;
  const sidebar = 260, padding = 32;
  const available = window.innerWidth - sidebar - padding;
  const natural = 305 + 20 + 305 + 20 + 305;
  const scale = Math.min(1, available / natural);
  const el = document.getElementById('step-10');
  if (el) el.style.zoom = scale < 1 ? scale : '';
}

function scaleStep2Desktop() {
  if (isMobile()) return;
  const sidebar = 260, padding = 32;
  const available = window.innerWidth - sidebar - padding;
  const natural = 305 + 305 + 24 + 24 + 340;
  const scale = Math.min(1, available / natural);
  const el = document.getElementById('step-2');
  if (el) el.style.zoom = scale < 1 ? scale : '';
}
