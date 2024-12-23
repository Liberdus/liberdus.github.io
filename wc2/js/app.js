const state = new State();

// Initialize navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    state.navigate(item.getAttribute('data-page'));
  });
});

// Initial render
state.render();