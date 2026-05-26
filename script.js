/* ================================================================
   AnkiPixel — script.js
   Author: Ankit | Browser-based image compression engine
   ================================================================ */

'use strict';

/* ────────────── LOGO BASE64 INJECTION ────────────── */
// Logo is injected at runtime from the LOGO_DATA_URI global
// (set by the inline script in index.html after build-step embeds it)
function injectLogos() {
  const uri = window.__LOGO_URI__ || '';
  ['headerLogo','aboutLogo','footerLogo'].forEach(id => {
    const el = document.getElementById(id);
    if (el && uri) el.src = uri;
  });
}

/* ────────────── THEME ────────────── */
const html = document.documentElement;
const themeBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

function setTheme(theme) {
  html.setAttribute('data-theme', theme);
  localStorage.setItem('ap-theme', theme);
  themeIcon.className = theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

themeBtn.addEventListener('click', () => {
  setTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

(function initTheme() {
  const saved = localStorage.getItem('ap-theme');
  setTheme(saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
})();

/* ────────────── PARTICLE CANVAS ────────────── */
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];
  const COUNT = 55;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function rnd(min, max) { return Math.random() * (max - min) + min; }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = rnd(0, W);
      this.y = rnd(0, H);
      this.r = rnd(0.6, 2.4);
      this.vx = rnd(-0.25, 0.25);
      this.vy = rnd(-0.35, -0.08);
      this.alpha = rnd(0.2, 0.7);
      this.color = ['#4f9eff','#7b5ea7','#1de9b6'][Math.floor(Math.random()*3)];
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= 0.0018;
      if (this.y < -5 || this.alpha <= 0) this.reset();
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < COUNT; i++) particles.push(new Particle());

  let rafId;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    rafId = requestAnimationFrame(loop);
  }
  loop();

  // Pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else loop();
  });
})();

/* ────────────── TOAST ────────────── */
const toastContainer = document.getElementById('toastContainer');

function showToast(msg, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i><span>${msg}</span>`;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ────────────── STATE ────────────── */
const state = {
  files: [],      // { id, file, originalUrl, compressedBlob, compressedUrl }
  counter: 0
};

/* ────────────── DOM REFS ────────────── */
const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const toolPanel      = document.getElementById('toolPanel');
const imageList      = document.getElementById('imageList');
const qualitySlider  = document.getElementById('qualitySlider');
const qualityVal     = document.getElementById('qualityVal');
const compressAllBtn = document.getElementById('compressAllBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resetBtn       = document.getElementById('resetBtn');
const tpl            = document.getElementById('imageCardTpl');

/* ────────────── SLIDER ────────────── */
qualitySlider.addEventListener('input', () => {
  qualityVal.textContent = qualitySlider.value;
  qualitySlider.setAttribute('aria-valuenow', qualitySlider.value);
});

/* ────────────── DROP ZONE ────────────── */
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));

/* ────────────── FILE HANDLING ────────────── */
function handleFiles(files) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  const valid = files.filter(f => allowed.includes(f.type));
  const invalid = files.length - valid.length;

  if (invalid > 0) showToast(`${invalid} file(s) skipped — only JPG, PNG, WEBP allowed.`, 'error');
  if (!valid.length) return;

  valid.forEach(addFile);
  toolPanel.classList.remove('hidden');
  toolPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`${valid.length} image(s) added!`, 'success');
  fileInput.value = '';
}

function addFile(file) {
  const id = ++state.counter;
  const originalUrl = URL.createObjectURL(file);
  const entry = { id, file, originalUrl, compressedBlob: null, compressedUrl: null };
  state.files.push(entry);
  renderCard(entry);
}

/* ────────────── CARD RENDERING ────────────── */
function renderCard(entry) {
  const node = tpl.content.cloneNode(true);
  const card = node.querySelector('.image-card');
  card.dataset.id = entry.id;

  card.querySelector('.ic-name').textContent = entry.file.name;
  card.querySelector('.ic-original').src = entry.originalUrl;
  card.querySelector('.ic-orig-size').textContent = formatBytes(entry.file.size);

  card.querySelector('.btn-remove').addEventListener('click', () => removeCard(entry.id, card));

  imageList.appendChild(node);
}

function getCard(id) {
  return imageList.querySelector(`.image-card[data-id="${id}"]`);
}

function removeCard(id, card) {
  const idx = state.files.findIndex(f => f.id === id);
  if (idx !== -1) {
    const e = state.files[idx];
    URL.revokeObjectURL(e.originalUrl);
    if (e.compressedUrl) URL.revokeObjectURL(e.compressedUrl);
    state.files.splice(idx, 1);
  }
  card.style.animation = 'none';
  card.style.transition = 'opacity 0.25s, transform 0.25s';
  card.style.opacity = '0';
  card.style.transform = 'scale(0.95)';
  setTimeout(() => card.remove(), 280);

  if (!state.files.length) {
    toolPanel.classList.add('hidden');
    downloadAllBtn.classList.add('hidden');
  }
}

/* ────────────── COMPRESSION ────────────── */
async function compressEntry(entry) {
  const card = getCard(entry.id);
  if (!card) return;

  const spinner      = card.querySelector('.ic-spinner');
  const progressWrap = card.querySelector('.ic-progress');
  const progressFill = card.querySelector('.ic-progress-fill');
  const compImg      = card.querySelector('.ic-compressed');
  const compSizeEl   = card.querySelector('.ic-comp-size');
  const savedWrap    = card.querySelector('.ic-saved-wrap');
  const savedEl      = card.querySelector('.ic-saved');
  const dlBtn        = card.querySelector('.btn-download-single');

  spinner.classList.remove('hidden');
  progressWrap.classList.remove('hidden');
  progressFill.style.width = '0%';
  dlBtn.classList.add('hidden');

  const quality = parseInt(qualitySlider.value, 10) / 100;

  const opts = {
    maxSizeMB: 20,
    maxWidthOrHeight: 8000,
    useWebWorker: true,
    initialQuality: quality,
    onProgress: pct => { progressFill.style.width = pct + '%'; }
  };

  try {
    const compressed = await imageCompression(entry.file, opts);
    entry.compressedBlob = compressed;
    if (entry.compressedUrl) URL.revokeObjectURL(entry.compressedUrl);
    entry.compressedUrl = URL.createObjectURL(compressed);

    compImg.src = entry.compressedUrl;
    compSizeEl.textContent = formatBytes(compressed.size);
    progressFill.style.width = '100%';

    const saved = Math.max(0, ((entry.file.size - compressed.size) / entry.file.size) * 100);
    savedEl.textContent = saved.toFixed(1) + '% saved';
    savedWrap.classList.remove('hidden');

    dlBtn.classList.remove('hidden');
    dlBtn.onclick = () => downloadSingle(entry);

    showToast(`"${truncate(entry.file.name, 22)}" compressed — ${saved.toFixed(1)}% smaller!`, 'success');
  } catch (err) {
    console.error(err);
    showToast(`Error compressing "${truncate(entry.file.name, 22)}"`, 'error');
  } finally {
    spinner.classList.add('hidden');
    setTimeout(() => progressWrap.classList.add('hidden'), 800);
  }
}

/* ────────────── COMPRESS ALL ────────────── */
compressAllBtn.addEventListener('click', async () => {
  if (!state.files.length) return showToast('No images uploaded yet.', 'info');

  compressAllBtn.disabled = true;
  compressAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Compressing…';

  // Compress up to 4 at a time
  const chunkSize = 4;
  for (let i = 0; i < state.files.length; i += chunkSize) {
    const chunk = state.files.slice(i, i + chunkSize);
    await Promise.all(chunk.map(compressEntry));
  }

  compressAllBtn.disabled = false;
  compressAllBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Compress All';

  const anyCompressed = state.files.some(f => f.compressedBlob);
  if (anyCompressed) downloadAllBtn.classList.remove('hidden');
});

/* ────────────── DOWNLOAD SINGLE ────────────── */
function downloadSingle(entry) {
  if (!entry.compressedUrl) return showToast('Compress the image first.', 'info');
  const a = document.createElement('a');
  a.href = entry.compressedUrl;
  a.download = 'ankipixel_' + entry.file.name;
  a.click();
}

/* ────────────── DOWNLOAD ALL ────────────── */
downloadAllBtn.addEventListener('click', async () => {
  const ready = state.files.filter(f => f.compressedBlob);
  if (!ready.length) return showToast('No compressed images ready.', 'info');

  downloadAllBtn.disabled = true;
  downloadAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Zipping…';

  try {
    const zip = new JSZip();
    ready.forEach(e => {
      zip.file('ankipixel_' + e.file.name, e.compressedBlob);
    });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ankipixel_compressed.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(`${ready.length} images downloaded as ZIP!`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to create ZIP. Please try again.', 'error');
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = '<i class="fa-solid fa-file-zipper"></i> Download All (ZIP)';
  }
});

/* ────────────── RESET ────────────── */
resetBtn.addEventListener('click', () => {
  state.files.forEach(e => {
    URL.revokeObjectURL(e.originalUrl);
    if (e.compressedUrl) URL.revokeObjectURL(e.compressedUrl);
  });
  state.files = [];
  imageList.innerHTML = '';
  toolPanel.classList.add('hidden');
  downloadAllBtn.classList.add('hidden');
  fileInput.value = '';
  showToast('Reset! Ready for new images.', 'info');
  document.getElementById('upload-zone').scrollIntoView({ behavior: 'smooth' });
});

/* ────────────── UTILS ────────────── */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/* ────────────── SCROLL ANIMATIONS ────────────── */
(function initScrollAnim() {
  const targets = document.querySelectorAll('.feature-card, .about-card');
  if (!('IntersectionObserver' in window)) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'cardIn 0.5s cubic-bezier(0.34,1.2,0.64,1) both';
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  targets.forEach(el => {
    el.style.opacity = '0';
    obs.observe(el);
  });
})();

/* ────────────── INIT ────────────── */
document.addEventListener('DOMContentLoaded', () => {
  injectLogos();
});

// Also call immediately in case DOMContentLoaded already fired
injectLogos();
