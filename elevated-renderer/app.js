// ELEVATED Launcher App

document.addEventListener('DOMContentLoaded', () => {
  // Get elements
  const launchArgusBtn = document.getElementById('launch-argus');
  const launchVlfBtn = document.getElementById('launch-vlf');
  const aboutBtn = document.getElementById('about-btn');
  const aboutModal = document.getElementById('about-modal');
  const modalClose = document.querySelector('.modal-close');

  // Launch ARGUS
  launchArgusBtn.addEventListener('click', () => {
    window.electron.send('launch-app', 'argus');
  });

  // Launch VLF Compressor
  launchVlfBtn.addEventListener('click', () => {
    window.electron.send('launch-app', 'vlf');
  });

  // Show about modal
  aboutBtn.addEventListener('click', () => {
    aboutModal.classList.add('active');
  });

  // Close modal
  modalClose.addEventListener('click', () => {
    aboutModal.classList.remove('active');
  });

  // Close modal on outside click
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
      aboutModal.classList.remove('active');
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape') {
      aboutModal.classList.remove('active');
    }
  });
});
