/* Sidebar overlay interactions */
function openSidebar() {
  document.querySelector('.sidebar').classList.add('mob-open');
  document.getElementById('mob-overlay').classList.add('mob-open');
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('mob-open');
  document.getElementById('mob-overlay').classList.remove('mob-open');
}
