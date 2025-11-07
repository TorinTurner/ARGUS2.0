// ARGUS Modern - Fixed Workflow
// Matches original ARGUS behavior with modern UI

const state = {
  currentMode: 'shore',
  shoreFile: null,
  shoreFilePath: null,
  shoreSelectedTemplate: null,
  submarineFile: null,
  submarineFilePath: null,
  templates: [],
  pythonAvailable: false
};

async function checkPythonSetup() {
  try {
    const result = await window.argus.checkPythonDependencies();

    if (result.success) {
      state.pythonAvailable = true;
      console.log('Python dependencies OK:', result.data.version);
    } else {
      state.pythonAvailable = false;
      showPythonSetupDialog(result.error);
    }
  } catch (error) {
    state.pythonAvailable = false;
    showPythonSetupDialog({
      missing: 'unknown',
      message: 'Unable to check Python dependencies.\n\nPlease ensure Python 3.8+ is installed and required packages are available.'
    });
  }
}

function showPythonSetupDialog(errorInfo) {
  const dialogHtml = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8);
                display: flex; align-items: center; justify-content: center; z-index: 10000;">
      <div style="background: #1a1a1a; border: 2px solid #dc3545; border-radius: 8px; padding: 30px;
                  max-width: 600px; color: #fff;">
        <h2 style="color: #dc3545; margin-top: 0;">⚠️ Python Setup Required</h2>
        <p style="white-space: pre-line; line-height: 1.6;">${errorInfo.message}</p>
        <div style="margin-top: 20px; padding: 15px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid #ffc107;">
          <strong>Quick Fix:</strong><br><br>
          1. Install Python 3.8+ from <a href="#" onclick="alert('Visit https://python.org/')" style="color: #4a9eff;">https://python.org/</a><br>
          2. Run in terminal: <code style="background: #000; padding: 2px 6px; border-radius: 3px;">python -m pip install opencv-python numpy Pillow imageio pyyaml</code><br>
          3. Restart ARGUS
        </div>
        <button onclick="this.closest('div').parentElement.remove()"
                style="margin-top: 20px; padding: 10px 20px; background: #dc3545; color: white;
                       border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
          Continue (Limited Functionality)
        </button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', dialogHtml);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check Python dependencies first
  await checkPythonSetup();

  await loadTemplates();
  setupModeToggle();
  setupShoreMode();
  setupSubmarineMode();
  setupHelpModal();
  console.log('ARGUS ready');
});

async function loadTemplates() {
  try {
    const result = await window.argus.listTemplates();
    if (result.success) {
      state.templates = result.data;
      updateTemplateDropdowns();

      if (result.data.length === 0) {
        console.warn('No templates found - user may need to add templates');
        // Don't show alert on startup if no templates, just log warning
        // User will see "No templates found" in the dropdown
      }
    } else {
      // Show error to user
      console.error('Failed to load templates:', result.error);
      state.templates = [];
      updateTemplateDropdowns();

      // Show error alert
      alert('Failed to load templates:\n\n' + result.error);
    }
  } catch (error) {
    console.error('Error loading templates:', error);
    state.templates = [];
    updateTemplateDropdowns();

    // Show error alert
    alert('Failed to load templates:\n\n' + error.message);
  }
}

function updateTemplateDropdowns() {
  const shoreSelect = document.getElementById('shore-template');
  const subSelect = document.getElementById('sub-template');
  
  [shoreSelect, subSelect].forEach(select => {
    select.innerHTML = state.templates.length === 0
      ? '<option value="">No templates found</option>'
      : '<option value="">Select template...</option>' + 
        state.templates.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
  });
}

function setupModeToggle() {
  document.getElementById('shore-btn').addEventListener('click', () => {
    state.currentMode = 'shore';
    document.getElementById('shore-btn').classList.add('active');
    document.getElementById('submarine-btn').classList.remove('active');
    document.getElementById('shore-mode').classList.add('active');
    document.getElementById('submarine-mode').classList.remove('active');
  });
  
  document.getElementById('submarine-btn').addEventListener('click', () => {
    state.currentMode = 'submarine';
    document.getElementById('submarine-btn').classList.add('active');
    document.getElementById('shore-btn').classList.remove('active');
    document.getElementById('submarine-mode').classList.add('active');
    document.getElementById('shore-mode').classList.remove('active');
  });
}

// SHORE MODE
function setupShoreMode() {
  const dropZone = document.getElementById('shore-drop-zone');
  
  ['dragover', 'dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, (e) => e.preventDefault());
  });
  
  dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', async (e) => {
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) await handleShoreFile(e.dataTransfer.files[0].path);
  });
  
  document.getElementById('shore-browse-btn').addEventListener('click', async () => {
    const file = await window.argus.selectFile({
      title: 'Select Weather Image',
      filters: [{ name: 'Images', extensions: ['gif', 'jpg', 'jpeg'] }]
    });
    if (file) await handleShoreFile(file);
  });
  
  document.getElementById('shore-remove-btn').addEventListener('click', clearShoreFile);
  
  document.getElementById('shore-template').addEventListener('change', (e) => {
    if (e.target.value) {
      state.shoreSelectedTemplate = e.target.value;
      document.getElementById('shore-config-section').style.display = 'block';
      if (!document.getElementById('shore-dtg').value) {
        document.getElementById('shore-dtg').value = generateDTG();
      }
    }
  });
  
  document.getElementById('auto-dtg-btn').addEventListener('click', () => {
    document.getElementById('shore-dtg').value = generateDTG();
  });
  
  document.getElementById('shore-generate-btn').addEventListener('click', generateVLFMessage);
  document.getElementById('shore-new-template-btn').addEventListener('click', () => {
    openTemplateBuilder();
  });
}

async function handleShoreFile(filePath) {
  state.shoreFilePath = filePath;
  state.shoreFile = filePath.split(/[\\/]/).pop();
  
  document.querySelector('#shore-drop-zone .drop-zone-content').style.display = 'none';
  document.getElementById('shore-file-preview').style.display = 'flex';
  document.getElementById('shore-file-name').textContent = state.shoreFile;
  document.getElementById('shore-preview-img').src = filePath;
  document.getElementById('shore-template-section').style.display = 'block';
  
  const detected = ['EUCOM', 'LANT', 'EPAC', 'WPAC'].find(t => 
    state.shoreFile.toUpperCase().includes(t)
  );
  
  if (detected) {
    document.getElementById('shore-template').value = detected;
    state.shoreSelectedTemplate = detected;
    document.getElementById('shore-config-section').style.display = 'block';
    document.getElementById('shore-dtg').value = generateDTG();
  }
}

function clearShoreFile() {
  state.shoreFile = null;
  state.shoreFilePath = null;
  state.shoreSelectedTemplate = null;
  document.querySelector('#shore-drop-zone .drop-zone-content').style.display = 'flex';
  document.getElementById('shore-file-preview').style.display = 'none';
  document.getElementById('shore-template-section').style.display = 'none';
  document.getElementById('shore-config-section').style.display = 'none';
}

async function generateVLFMessage() {
  // Check Python availability
  if (!state.pythonAvailable) {
    alert('Python dependencies are not available.\n\nPlease install Python 3.8+ and required packages:\npython -m pip install opencv-python numpy Pillow imageio pyyaml\n\nThen restart ARGUS.');
    return;
  }

  const dtg = document.getElementById('shore-dtg').value.trim();
  if (!dtg) return alert('Please enter a DTG');

  const prog = document.getElementById('shore-progress');
  const fill = document.getElementById('shore-progress-fill');
  const text = document.getElementById('shore-progress-text');
  
  prog.style.display = 'block';
  document.getElementById('shore-result').style.display = 'none';
  
  try {
    fill.style.width = '30%';
    text.textContent = 'Compressing...';
    await sleep(200);
    
    const result = await window.argus.compressImage({
      imagePath: state.shoreFilePath,
      templateName: state.shoreSelectedTemplate,
      dtg: dtg
    });
    
    fill.style.width = '100%';
    text.textContent = 'Complete!';
    await sleep(300);
    
    if (result.success) {
      prog.style.display = 'none';
      document.getElementById('shore-result').style.display = 'block';
      document.getElementById('shore-result-path').textContent = `Saved: ${result.data.message_path}`;
      alert('VLF message generated!');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    prog.style.display = 'none';
    alert(`Error: ${error.message}`);
  }
}

// SUBMARINE MODE
function setupSubmarineMode() {
  const fileBtn = document.getElementById('sub-file-mode-btn');
  const textBtn = document.getElementById('sub-text-mode-btn');
  const fileInput = document.getElementById('sub-file-input');
  const textInput = document.getElementById('sub-text-input');
  
  fileBtn.addEventListener('click', () => {
    fileBtn.classList.add('active');
    textBtn.classList.remove('active');
    fileInput.classList.add('active');
    textInput.classList.remove('active');
    updateSubDecodeButton();
  });
  
  textBtn.addEventListener('click', () => {
    textBtn.classList.add('active');
    fileBtn.classList.remove('active');
    textInput.classList.add('active');
    fileInput.classList.remove('active');
    updateSubDecodeButton();
  });
  
  const dropZone = document.getElementById('sub-drop-zone');
  ['dragover', 'dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, (e) => e.preventDefault());
  });
  
  dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', async (e) => {
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) await handleSubmarineFile(e.dataTransfer.files[0].path);
  });
  
  document.getElementById('sub-browse-btn').addEventListener('click', async () => {
    const file = await window.argus.selectFile({
      title: 'Select VLF Message',
      filters: [{ name: 'Text', extensions: ['txt', 'msg'] }]
    });
    if (file) await handleSubmarineFile(file);
  });
  
  document.getElementById('sub-remove-btn').addEventListener('click', clearSubmarineFile);
  document.getElementById('sub-message-text').addEventListener('input', updateSubDecodeButton);
  document.getElementById('sub-template').addEventListener('change', updateSubDecodeButton);
  document.getElementById('sub-decode-btn').addEventListener('click', decodeVLFMessage);
}

async function handleSubmarineFile(filePath) {
  state.submarineFilePath = filePath;
  state.submarineFile = filePath.split(/[\\/]/).pop();
  
  document.querySelector('#sub-drop-zone .drop-zone-content').style.display = 'none';
  document.getElementById('sub-file-preview').style.display = 'flex';
  document.getElementById('sub-file-name').textContent = state.submarineFile;
  
  updateSubDecodeButton();
}

function clearSubmarineFile() {
  state.submarineFile = null;
  state.submarineFilePath = null;
  document.querySelector('#sub-drop-zone .drop-zone-content').style.display = 'flex';
  document.getElementById('sub-file-preview').style.display = 'none';
  updateSubDecodeButton();
}

function updateSubDecodeButton() {
  const template = document.getElementById('sub-template').value;
  const fileMode = document.getElementById('sub-file-mode-btn').classList.contains('active');
  const hasFile = state.submarineFilePath !== null;
  const hasText = document.getElementById('sub-message-text').value.trim().length > 0;
  
  const canDecode = template && (fileMode ? hasFile : hasText);
  document.getElementById('sub-decode-btn').disabled = !canDecode;
}

async function decodeVLFMessage() {
  // Check Python availability
  if (!state.pythonAvailable) {
    alert('Python dependencies are not available.\n\nPlease install Python 3.8+ and required packages:\npython -m pip install opencv-python numpy Pillow imageio pyyaml\n\nThen restart ARGUS.');
    return;
  }

  const template = document.getElementById('sub-template').value;
  const fileMode = document.getElementById('sub-file-mode-btn').classList.contains('active');

  let messagePath;
  if (fileMode) {
    messagePath = state.submarineFilePath;
  } else {
    // For text mode, save to temp file
    const userDataPath = await window.argus.getUserDataPath();
    const text = document.getElementById('sub-message-text').value;
    messagePath = await window.argus.saveTempMessage(text);
  }
  
  const prog = document.getElementById('sub-progress');
  const fill = document.getElementById('sub-progress-fill');
  const text = document.getElementById('sub-progress-text');
  
  prog.style.display = 'block';
  document.getElementById('sub-result').style.display = 'none';
  
  try {
    fill.style.width = '50%';
    text.textContent = 'Decoding...';
    await sleep(200);
    
    const result = await window.argus.decompressMessage({
      messagePath: messagePath,
      templateName: template
    });
    
    fill.style.width = '100%';
    text.textContent = 'Complete!';
    await sleep(300);
    
    if (result.success) {
      prog.style.display = 'none';
      document.getElementById('sub-result').style.display = 'block';
      document.getElementById('sub-result-path').textContent = `Saved: ${result.data.image_path}`;
      document.getElementById('sub-preview-img').src = result.data.image_path + '?t=' + Date.now();
      alert('Image decoded!');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    prog.style.display = 'none';
    alert(`Error: ${error.message}`);
  }
}

// UTILITIES
function generateDTG() {
  const now = new Date();
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${day}${hour}${minute}Z${months[now.getUTCMonth()]}${now.getUTCFullYear()}`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function setupHelpModal() {
  const modal = document.getElementById('help-modal');
  document.getElementById('help-btn').addEventListener('click', () => modal.classList.add('active'));
  document.querySelector('#help-modal .modal-close').addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
  
  const builderModal = document.getElementById('template-builder-modal');
  document.querySelector('#template-builder-modal .modal-close').addEventListener('click', closeTemplateBuilder);
  builderModal.addEventListener('click', (e) => { if (e.target === builderModal) closeTemplateBuilder(); });
  
  // Setup credits modal
  const creditsBtn = document.getElementById('credits-btn');
  if (creditsBtn) {
    const creditsModal = document.getElementById('credits-modal');
    creditsBtn.addEventListener('click', () => {
      if (creditsModal) creditsModal.classList.add('active');
    });
    
    const creditsClose = document.querySelector('#credits-modal .modal-close');
    if (creditsClose) {
      creditsClose.addEventListener('click', () => creditsModal.classList.remove('active'));
    }
    
    if (creditsModal) {
      creditsModal.addEventListener('click', (e) => { 
        if (e.target === creditsModal) creditsModal.classList.remove('active'); 
      });
    }
  }
}

// Setup template builder button listeners
document.addEventListener('DOMContentLoaded', () => {
  // Step 1
  document.getElementById('builder-cancel-btn')?.addEventListener('click', closeTemplateBuilder);
  document.getElementById('builder-next-1')?.addEventListener('click', nextBuilderStep);
  
  // Step 2
  document.getElementById('builder-back-2')?.addEventListener('click', prevBuilderStep);
  document.getElementById('next-scale-btn')?.addEventListener('click', nextBuilderStep);
  
  // Step 3
  document.getElementById('builder-back-3')?.addEventListener('click', prevBuilderStep);
  document.getElementById('next-bounds-btn')?.addEventListener('click', createTemplate);
});

// Open folder buttons
document.addEventListener('DOMContentLoaded', () => {
  ['shore', 'sub'].forEach(mode => {
    document.getElementById(`${mode}-open-folder-btn`)?.addEventListener('click', async () => {
      // Pass null to open the output folder
      window.argus.showItemInFolder(null);
    });
  });
});

// TEMPLATE BUILDER - SIMPLIFIED
const templateBuilder = {
  currentStep: 1,
  imagePath: null,
  image: null,
  canvas: null,
  ctx: null,
  templateName: '',
  colorBarCrop: null, // {x, y, width, height}
  mapCrop: null, // {x, y, width, height}
  isDragging: false,
  startX: 0,
  startY: 0
};

function openTemplateBuilder() {
  if (!state.shoreFilePath) {
    alert('Please select an image first');
    return;
  }
  
  templateBuilder.imagePath = state.shoreFilePath;
  templateBuilder.currentStep = 1;
  templateBuilder.colorBarCrop = null;
  templateBuilder.mapCrop = null;
  
  document.getElementById('template-builder-modal').classList.add('active');
  document.getElementById('template-name').value = '';
  document.getElementById('template-name').focus();
}

function closeTemplateBuilder() {
  document.getElementById('template-builder-modal').classList.remove('active');
}

function nextBuilderStep() {
  if (templateBuilder.currentStep === 1) {
    const name = document.getElementById('template-name').value.trim();
    if (!name) {
      alert('Please enter a template name');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      alert('Template name can only contain letters, numbers, hyphens, and underscores');
      return;
    }
    templateBuilder.templateName = name;
    
    document.getElementById('builder-step-1').classList.remove('active');
    document.getElementById('step-1').classList.remove('active');
    templateBuilder.currentStep = 2;
    document.getElementById('builder-step-2').classList.add('active');
    document.getElementById('step-2').classList.add('active');
    
    initializeBuilderCanvas();
  } else if (templateBuilder.currentStep === 2) {
    if (!templateBuilder.colorBarCrop) {
      alert('Please select the color bar area');
      return;
    }
    
    document.getElementById('builder-step-2').classList.remove('active');
    document.getElementById('step-2').classList.remove('active');
    templateBuilder.currentStep = 3;
    document.getElementById('builder-step-3').classList.add('active');
    document.getElementById('step-3').classList.add('active');
    
    initializeMapCanvas();
  } else if (templateBuilder.currentStep === 3) {
    if (!templateBuilder.mapCrop) {
      alert('Please select the map area');
      return;
    }
    createTemplate();
  }
}

function prevBuilderStep() {
  if (templateBuilder.currentStep <= 1) return;
  
  document.getElementById(`builder-step-${templateBuilder.currentStep}`).classList.remove('active');
  document.getElementById(`step-${templateBuilder.currentStep}`).classList.remove('active');
  
  templateBuilder.currentStep--;
  
  document.getElementById(`builder-step-${templateBuilder.currentStep}`).classList.add('active');
  document.getElementById(`step-${templateBuilder.currentStep}`).classList.add('active');
}

async function initializeBuilderCanvas() {
  const canvas = document.getElementById('template-canvas');
  const ctx = canvas.getContext('2d');
  
  const img = new Image();
  img.src = templateBuilder.imagePath;
  
  await new Promise((resolve) => { img.onload = resolve; });
  
  // Make canvas fit smaller screens better - reduced sizes
  const maxWidth = Math.min(500, window.innerWidth - 150);
  const maxHeight = Math.min(350, window.innerHeight - 350);
  
  const scaleX = maxWidth / img.width;
  const scaleY = maxHeight / img.height;
  const scale = Math.min(1, Math.min(scaleX, scaleY));
  
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  
  templateBuilder.image = img;
  templateBuilder.canvas = canvas;
  templateBuilder.ctx = ctx;
  templateBuilder.scale = scale;
  
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  canvas.onmousedown = startCropSelection;
  canvas.onmousemove = updateCropSelection;
  canvas.onmouseup = endCropSelection;
}

async function initializeMapCanvas() {
  const canvas = document.getElementById('template-canvas-3');
  const ctx = canvas.getContext('2d');
  
  canvas.width = templateBuilder.canvas.width;
  canvas.height = templateBuilder.canvas.height;
  
  ctx.drawImage(templateBuilder.image, 0, 0, canvas.width, canvas.height);
  
  templateBuilder.canvas3 = canvas;
  templateBuilder.ctx3 = ctx;
  
  canvas.onmousedown = startMapSelection;
  canvas.onmousemove = updateMapSelection;
  canvas.onmouseup = endMapSelection;
}

function startCropSelection(e) {
  const rect = templateBuilder.canvas.getBoundingClientRect();
  templateBuilder.isDragging = true;
  templateBuilder.startX = e.clientX - rect.left;
  templateBuilder.startY = e.clientY - rect.top;
}

function updateCropSelection(e) {
  if (!templateBuilder.isDragging) return;
  
  const rect = templateBuilder.canvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  const ctx = templateBuilder.ctx;
  ctx.drawImage(templateBuilder.image, 0, 0, templateBuilder.canvas.width, templateBuilder.canvas.height);
  
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    templateBuilder.startX,
    templateBuilder.startY,
    currentX - templateBuilder.startX,
    currentY - templateBuilder.startY
  );
}

function endCropSelection(e) {
  if (!templateBuilder.isDragging) return;
  templateBuilder.isDragging = false;
  
  const rect = templateBuilder.canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  
  const x = Math.min(templateBuilder.startX, endX) / templateBuilder.scale;
  const y = Math.min(templateBuilder.startY, endY) / templateBuilder.scale;
  const width = Math.abs(endX - templateBuilder.startX) / templateBuilder.scale;
  const height = Math.abs(endY - templateBuilder.startY) / templateBuilder.scale;
  
  templateBuilder.colorBarCrop = { x: Math.floor(x), y: Math.floor(y), width: Math.floor(width), height: Math.floor(height) };
  
  document.getElementById('next-scale-btn').disabled = false;
}

function startMapSelection(e) {
  const rect = templateBuilder.canvas3.getBoundingClientRect();
  templateBuilder.isDragging = true;
  templateBuilder.startX = e.clientX - rect.left;
  templateBuilder.startY = e.clientY - rect.top;
}

function updateMapSelection(e) {
  if (!templateBuilder.isDragging) return;
  
  const rect = templateBuilder.canvas3.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  const ctx = templateBuilder.ctx3;
  ctx.drawImage(templateBuilder.image, 0, 0, templateBuilder.canvas3.width, templateBuilder.canvas3.height);
  
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 3;
  ctx.strokeRect(
    templateBuilder.startX,
    templateBuilder.startY,
    currentX - templateBuilder.startX,
    currentY - templateBuilder.startY
  );
}

function endMapSelection(e) {
  if (!templateBuilder.isDragging) return;
  templateBuilder.isDragging = false;
  
  const rect = templateBuilder.canvas3.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  
  const x = Math.min(templateBuilder.startX, endX) / templateBuilder.scale;
  const y = Math.min(templateBuilder.startY, endY) / templateBuilder.scale;
  const width = Math.abs(endX - templateBuilder.startX) / templateBuilder.scale;
  const height = Math.abs(endY - templateBuilder.startY) / templateBuilder.scale;
  
  templateBuilder.mapCrop = { x: Math.floor(x), y: Math.floor(y), width: Math.floor(width), height: Math.floor(height) };
  
  document.getElementById('next-bounds-btn').disabled = false;
}

async function createTemplate() {
  const prog = document.getElementById('builder-progress');
  const fill = document.getElementById('builder-progress-fill');
  const text = document.getElementById('builder-progress-text');
  
  document.getElementById('builder-step-3').style.display = 'none';
  prog.style.display = 'block';
  
  try {
    fill.style.width = '30%';
    text.textContent = 'Creating template...';
    await sleep(200);
    
    const colorBar = templateBuilder.colorBarCrop;
    const map = templateBuilder.mapCrop;
    
    const result = await window.argus.createTemplate({
      imagePath: templateBuilder.imagePath,
      templateName: templateBuilder.templateName,
      scaleCoords: {
        start_x: colorBar.x,
        start_y: colorBar.y,
        end_x: colorBar.x + colorBar.width,
        end_y: colorBar.y + colorBar.height
      },
      cropCoords: {
        top: map.y,
        bottom: map.y + map.height,
        left: map.x,
        right: map.x + map.width
      }
    });
    
    fill.style.width = '100%';
    text.textContent = 'Complete!';
    await sleep(500);
    
    if (result.success) {
      prog.style.display = 'none';
      closeTemplateBuilder();
      
      await loadTemplates();
      
      document.getElementById('shore-template').value = templateBuilder.templateName;
      state.shoreSelectedTemplate = templateBuilder.templateName;
      document.getElementById('shore-config-section').style.display = 'block';
      if (!document.getElementById('shore-dtg').value) {
        document.getElementById('shore-dtg').value = generateDTG();
      }
      
      alert(`Template "${templateBuilder.templateName}" created successfully!`);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    prog.style.display = 'none';
    document.getElementById('builder-step-3').style.display = 'block';
    alert(`Error creating template: ${error.message}`);
  }
}

