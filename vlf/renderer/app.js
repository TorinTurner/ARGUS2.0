// VLF Message Compressor App

let currentMode = 'compress';
let compressInputMode = 'file';
let decompressInputMode = 'file';
let compressInputData = null;
let decompressInputData = null;
let lastCompressedResult = null;
let lastDecompressedResult = null;

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Mode toggle
  document.getElementById('compress-btn').addEventListener('click', () => switchMode('compress'));
  document.getElementById('decompress-btn').addEventListener('click', () => switchMode('decompress'));

  // Help modal
  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const modalClose = document.querySelector('.modal-close');

  helpBtn.addEventListener('click', () => helpModal.classList.add('active'));
  modalClose.addEventListener('click', () => helpModal.classList.remove('active'));
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.remove('active');
  });

  // Initialize compress mode
  initializeCompressMode();

  // Initialize decompress mode
  initializeDecompressMode();
}

function switchMode(mode) {
  currentMode = mode;

  // Update mode buttons
  document.getElementById('compress-btn').classList.toggle('active', mode === 'compress');
  document.getElementById('decompress-btn').classList.toggle('active', mode === 'decompress');

  // Update mode content
  document.getElementById('compress-mode').classList.toggle('active', mode === 'compress');
  document.getElementById('decompress-mode').classList.toggle('active', mode === 'decompress');
}

// ===== COMPRESS MODE =====

function initializeCompressMode() {
  // Input method toggle
  document.getElementById('comp-file-mode-btn').addEventListener('click', () => setCompressInputMode('file'));
  document.getElementById('comp-text-mode-btn').addEventListener('click', () => setCompressInputMode('text'));

  // File input
  const dropZone = document.getElementById('comp-drop-zone');
  const browseBtn = document.getElementById('comp-browse-btn');
  const removeBtn = document.getElementById('comp-remove-btn');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) await loadCompressFile(file.path);
  });

  browseBtn.addEventListener('click', async () => {
    const filePath = await window.electron.invoke('select-file', {
      title: 'Select Text File',
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (filePath) await loadCompressFile(filePath);
  });

  removeBtn.addEventListener('click', () => {
    compressInputData = null;
    document.getElementById('comp-file-preview').style.display = 'none';
    document.querySelector('#comp-drop-zone .drop-zone-content').style.display = 'block';
    updateCompressButton();
  });

  // Text input
  const textArea = document.getElementById('comp-message-text');
  const charCount = document.getElementById('comp-char-count');

  textArea.addEventListener('input', () => {
    const text = textArea.value;
    charCount.textContent = text.length;
    compressInputData = text;
    updateCompressButton();
  });

  // Process button
  document.getElementById('comp-process-btn').addEventListener('click', processCompress);

  // Result buttons
  document.getElementById('comp-save-btn').addEventListener('click', saveCompressedToFile);
  document.getElementById('comp-copy-btn').addEventListener('click', copyCompressedToClipboard);
  document.getElementById('comp-open-folder-btn').addEventListener('click', () => {
    window.electron.invoke('show-item-in-folder');
  });
}

function setCompressInputMode(mode) {
  compressInputMode = mode;
  document.getElementById('comp-file-mode-btn').classList.toggle('active', mode === 'file');
  document.getElementById('comp-text-mode-btn').classList.toggle('active', mode === 'text');
  document.getElementById('comp-file-input').classList.toggle('active', mode === 'file');
  document.getElementById('comp-text-input').classList.toggle('active', mode === 'text');

  // Reset input data when switching modes
  compressInputData = null;
  updateCompressButton();
}

async function loadCompressFile(filePath) {
  try {
    const text = await window.electron.invoke('read-file', filePath);
    compressInputData = { filePath, text };

    // Show preview
    document.querySelector('#comp-drop-zone .drop-zone-content').style.display = 'none';
    document.getElementById('comp-file-preview').style.display = 'block';
    document.getElementById('comp-file-name').textContent = filePath.split(/[\\/]/).pop();
    document.getElementById('comp-file-size').textContent = `${text.length} characters`;

    updateCompressButton();
  } catch (error) {
    alert('Error loading file: ' + error.message);
  }
}

function updateCompressButton() {
  const hasInput = compressInputData !== null &&
    (typeof compressInputData === 'string' ? compressInputData.length > 0 : true);
  document.getElementById('comp-process-btn').disabled = !hasInput;
}

async function processCompress() {
  const text = typeof compressInputData === 'string' ? compressInputData : compressInputData.text;

  if (!text || text.length === 0) {
    alert('Please enter or load a message to compress');
    return;
  }

  // Show progress
  document.getElementById('comp-result').style.display = 'none';
  document.getElementById('comp-progress').style.display = 'block';

  try {
    const result = await window.electron.invoke('vlf-compress', { text });

    if (!result.success) {
      throw new Error(result.error || 'Compression failed');
    }

    lastCompressedResult = result.data;

    // Display results
    document.getElementById('comp-original-size').textContent = `${result.data.originalSize} chars`;
    document.getElementById('comp-compressed-size').textContent = `${result.data.compressedSize} chars`;

    const ratio = (result.data.originalSize / result.data.compressedSize).toFixed(2);
    document.getElementById('comp-ratio').textContent = `${ratio}:1`;

    document.getElementById('comp-result-text').value = result.data.encoded;

    // Hide progress, show result
    document.getElementById('comp-progress').style.display = 'none';
    document.getElementById('comp-result').style.display = 'block';

  } catch (error) {
    document.getElementById('comp-progress').style.display = 'none';
    alert('Compression Error: ' + error.message);
  }
}

async function saveCompressedToFile() {
  if (!lastCompressedResult) return;

  try {
    const result = await window.electron.invoke('save-vlf-file', {
      data: lastCompressedResult.encoded,
      type: 'compressed'
    });

    if (result.success) {
      alert(`File saved successfully to:\n${result.path}`);
    }
  } catch (error) {
    alert('Error saving file: ' + error.message);
  }
}

async function copyCompressedToClipboard() {
  if (!lastCompressedResult) return;

  try {
    await window.electron.invoke('copy-to-clipboard', lastCompressedResult.encoded);

    // Visual feedback
    const btn = document.getElementById('comp-copy-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (error) {
    alert('Error copying to clipboard: ' + error.message);
  }
}

// ===== DECOMPRESS MODE =====

function initializeDecompressMode() {
  // Input method toggle
  document.getElementById('decomp-file-mode-btn').addEventListener('click', () => setDecompressInputMode('file'));
  document.getElementById('decomp-text-mode-btn').addEventListener('click', () => setDecompressInputMode('text'));

  // File input
  const dropZone = document.getElementById('decomp-drop-zone');
  const browseBtn = document.getElementById('decomp-browse-btn');
  const removeBtn = document.getElementById('decomp-remove-btn');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) await loadDecompressFile(file.path);
  });

  browseBtn.addEventListener('click', async () => {
    const filePath = await window.electron.invoke('select-file', {
      title: 'Select Encoded Message File',
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (filePath) await loadDecompressFile(filePath);
  });

  removeBtn.addEventListener('click', () => {
    decompressInputData = null;
    document.getElementById('decomp-file-preview').style.display = 'none';
    document.querySelector('#decomp-drop-zone .drop-zone-content').style.display = 'block';
    updateDecompressButton();
  });

  // Text input
  const textArea = document.getElementById('decomp-message-text');
  const charCount = document.getElementById('decomp-char-count');

  textArea.addEventListener('input', () => {
    const text = textArea.value;
    charCount.textContent = text.length;
    decompressInputData = text;
    updateDecompressButton();
  });

  // Process button
  document.getElementById('decomp-process-btn').addEventListener('click', processDecompress);

  // Result buttons
  document.getElementById('decomp-save-btn').addEventListener('click', saveDecompressedToFile);
  document.getElementById('decomp-copy-btn').addEventListener('click', copyDecompressedToClipboard);
  document.getElementById('decomp-open-folder-btn').addEventListener('click', () => {
    window.electron.invoke('show-item-in-folder');
  });
}

function setDecompressInputMode(mode) {
  decompressInputMode = mode;
  document.getElementById('decomp-file-mode-btn').classList.toggle('active', mode === 'file');
  document.getElementById('decomp-text-mode-btn').classList.toggle('active', mode === 'text');
  document.getElementById('decomp-file-input').classList.toggle('active', mode === 'file');
  document.getElementById('decomp-text-input').classList.toggle('active', mode === 'text');

  // Reset input data when switching modes
  decompressInputData = null;
  updateDecompressButton();
}

async function loadDecompressFile(filePath) {
  try {
    const text = await window.electron.invoke('read-file', filePath);
    decompressInputData = { filePath, text };

    // Show preview
    document.querySelector('#decomp-drop-zone .drop-zone-content').style.display = 'none';
    document.getElementById('decomp-file-preview').style.display = 'block';
    document.getElementById('decomp-file-name').textContent = filePath.split(/[\\/]/).pop();
    document.getElementById('decomp-file-size').textContent = `${text.length} characters`;

    updateDecompressButton();
  } catch (error) {
    alert('Error loading file: ' + error.message);
  }
}

function updateDecompressButton() {
  const hasInput = decompressInputData !== null &&
    (typeof decompressInputData === 'string' ? decompressInputData.length > 0 : true);
  document.getElementById('decomp-process-btn').disabled = !hasInput;
}

async function processDecompress() {
  const text = typeof decompressInputData === 'string' ? decompressInputData : decompressInputData.text;

  if (!text || text.length === 0) {
    alert('Please enter or load an encoded message to decompress');
    return;
  }

  // Hide error and result panels
  document.getElementById('decomp-error').style.display = 'none';
  document.getElementById('decomp-result').style.display = 'none';
  document.getElementById('decomp-progress').style.display = 'block';

  try {
    const result = await window.electron.invoke('vlf-decompress', { encodedText: text });

    if (!result.success) {
      throw new Error(result.error || 'Decompression failed');
    }

    lastDecompressedResult = result.data;

    // Display result
    document.getElementById('decomp-result-text').value = result.data.decodedText;

    // Hide progress, show result
    document.getElementById('decomp-progress').style.display = 'none';
    document.getElementById('decomp-result').style.display = 'block';

  } catch (error) {
    document.getElementById('decomp-progress').style.display = 'none';
    document.getElementById('decomp-error').style.display = 'block';
    document.getElementById('decomp-error-message').textContent = error.message;
  }
}

async function saveDecompressedToFile() {
  if (!lastDecompressedResult) return;

  try {
    const result = await window.electron.invoke('save-vlf-file', {
      data: lastDecompressedResult.decodedText,
      type: 'decompressed'
    });

    if (result.success) {
      alert(`File saved successfully to:\n${result.path}`);
    }
  } catch (error) {
    alert('Error saving file: ' + error.message);
  }
}

async function copyDecompressedToClipboard() {
  if (!lastDecompressedResult) return;

  try {
    await window.electron.invoke('copy-to-clipboard', lastDecompressedResult.decodedText);

    // Visual feedback
    const btn = document.getElementById('decomp-copy-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (error) {
    alert('Error copying to clipboard: ' + error.message);
  }
}
