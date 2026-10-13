const $ = (selector) => document.querySelector(selector);
const canvas = $('#post-canvas');
let ctx = canvas.getContext('2d');
const makeId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'page-' + Date.now() + '-' + Math.random().toString(36).slice(2));
const state = { project: null, size: 'square', pages: [], previewIndex: 0, editIndex: null, editDraft: null };
const dims = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920] };
const pageTypes = [['title', 'Judul'], ['content', 'Isi'], ['closing', 'Penutup / CTA']];
const projectThemes = {
  education: { name: 'Edukasi & tips', description: 'Struktur langkah, nomor, dan catatan yang mudah dipindai.', canvas: '#edf1f7', card: '#ffffff', ink: '#11172c', sub: '#53627c', accent: '#763be8', secondary: '#2fc9b9', kind: 'education' },
  promotion: { name: 'Promosi & layanan', description: 'Kontras kuat untuk manfaat, penawaran, dan ajakan.', canvas: '#101729', card: '#1b2640', ink: '#ffffff', sub: '#c7d0e2', accent: '#8b63f6', secondary: '#2fc9b9', kind: 'promotion' },
  portfolio: { name: 'Portofolio & karya', description: 'Komposisi editorial yang memberi ruang lebih pada karya.', canvas: '#f2efe8', card: '#fffefa', ink: '#171a27', sub: '#686a74', accent: '#763be8', secondary: '#2fc9b9', kind: 'portfolio' },
  studio: { name: 'Cerita studio', description: 'Layout ringan untuk kabar, proses, dan cerita bebas.', canvas: '#ffffff', card: '#f1f4f9', ink: '#11172c', sub: '#64718a', accent: '#763be8', secondary: '#2fc9b9', kind: 'studio' }
};
let toastTimer;
let imageDbPromise;

function roundedRect(x, y, w, h, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function wrap(text, maxWidth, font) {
  ctx.font = font;
  const lines = [];
  String(text || '').split('\n').forEach((paragraph) => {
    if (!paragraph) { lines.push(''); return; }
    let line = '';
    paragraph.split(/\s+/).forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; }
      else line = next;
    });
    if (line) lines.push(line);
  });
  return lines;
}
function drawLines(lines, x, y, lineHeight, maxLines) {
  lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return Math.min(lines.length, maxLines) * lineHeight;
}
function fontScale(page, part) { return Math.max(.7, Math.min(1.5, (Number(page.fontScale?.[part]) || 100) / 100)); }
function persist() {
  try {
    const saved = { project: state.project, size: state.size, previewIndex: state.previewIndex, pages: state.pages.map(({ imageData, imageObject, ...page }) => page) };
    localStorage.setItem('trycode-postmaker', JSON.stringify(saved));
  }
  catch { /* Browser storage may be unavailable. */ }
}
function openImageDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
  if (!imageDbPromise) imageDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('trycode-postmaker-assets', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('images')) request.result.createObjectStore('images'); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return imageDbPromise;
}
async function saveImageAsset(id, data) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => { const tx = db.transaction('images', 'readwrite'); tx.objectStore('images').put(data, id); tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error); });
}
async function getImageAsset(id) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => { const request = db.transaction('images', 'readonly').objectStore('images').get(id); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); });
}
async function deleteImageAsset(id) {
  if (!id) return;
  try { const db = await openImageDb(); db.transaction('images', 'readwrite').objectStore('images').delete(id); } catch { /* No stored image to remove. */ }
}
function decodeImage(src) {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
}
async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Pilih file gambar seperti JPG, PNG, atau WebP.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Ukuran file maksimal 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const original = await decodeImage(url), maxSide = 1400, ratio = Math.min(1, maxSide / Math.max(original.naturalWidth, original.naturalHeight));
    const temp = document.createElement('canvas'); temp.width = Math.max(1, Math.round(original.naturalWidth * ratio)); temp.height = Math.max(1, Math.round(original.naturalHeight * ratio));
    const tempCtx = temp.getContext('2d'); tempCtx.fillStyle = '#fffefa'; tempCtx.fillRect(0, 0, temp.width, temp.height); tempCtx.drawImage(original, 0, 0, temp.width, temp.height);
    const data = temp.toDataURL('image/jpeg', .86); return { data, image: await decodeImage(data) };
  } finally { URL.revokeObjectURL(url); }
}
function drawPageImage(page, w, h, scale, frame) {
  const image = page.imageObject; if (!image?.naturalWidth) return;
  const theme = themeForPage(page);
  const placement = page.imagePosition || 'top-right';
  const box = Math.round(w * (theme.kind === 'portfolio' ? .34 : theme.kind === 'promotion' ? .25 : .205)), gap = Math.round(14 * scale), margin = Math.round(w * .055);
  const x = placement.endsWith('left') ? frame.x + margin : frame.x + frame.w - margin - box;
  const y = placement.startsWith('bottom') ? frame.y + frame.h - Math.round(h * .055) - box : frame.y + Math.round(h * .135);
  ctx.save(); ctx.shadowColor = '#11101845'; ctx.shadowBlur = 22 * scale; ctx.shadowOffsetY = 8 * scale;
  roundedRect(x - gap / 2, y - gap / 2, box + gap, box + gap, 11 * scale, theme.canvas);
  ctx.restore(); ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, box, box, 7 * scale); ctx.clip();
  ctx.fillStyle = '#fffefa'; ctx.fillRect(x, y, box, box);
  const iw = image.naturalWidth, ih = image.naturalHeight, fit = page.imageFit || 'cover';
  if (fit === 'contain') { const ratio = Math.min(box / iw, box / ih), dw = iw * ratio, dh = ih * ratio; ctx.drawImage(image, x + (box - dw) / 2, y + (box - dh) / 2, dw, dh); }
  else {
    const focus = page.imageFocus || 'center'; let sx = 0, sy = 0, sw = iw, sh = ih;
    if (iw > ih) { sw = ih; sx = focus === 'left' ? 0 : focus === 'right' ? iw - sw : (iw - sw) / 2; }
    else if (ih > iw) { sh = iw; sy = focus === 'top' ? 0 : focus === 'bottom' ? ih - sh : (ih - sh) / 2; }
    ctx.drawImage(image, sx, sy, sw, sh, x, y, box, box);
  }
  ctx.restore();
  ctx.strokeStyle = theme.accent; ctx.lineWidth = 3 * scale; ctx.beginPath(); ctx.roundRect(x, y, box, box, 7 * scale); ctx.stroke();
}
function drawPageLayout(page, index, total, w, h) {
  const s = w / 1080, role = page.kind || 'title';
  const theme = themeForPage(page);
  const p = { ...theme, bg: theme.canvas, purple: theme.accent, teal: theme.secondary };
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
  const frame = { x: w * .052, y: h * .052, w: w * .896, h: h * .896 };
  roundedRect(frame.x, frame.y, frame.w, frame.h, 18 * s, p.card);
  const x = frame.x + 48 * s, maxW = frame.w - 96 * s;
  const hasImage = Boolean(page.imageObject?.naturalWidth);
  const imageAtTop = hasImage && !String(page.imagePosition || '').startsWith('bottom');
  const imageBottom = imageAtTop ? frame.y + Math.round(h * .135) + Math.round(w * (theme.kind === 'portfolio' ? .34 : theme.kind === 'promotion' ? .25 : .205)) : 0;
  if (hasImage) drawPageImage(page, w, h, s, frame);

  if (theme.kind === 'education') {
    ctx.fillStyle = p.accent; ctx.fillRect(frame.x, frame.y, 9 * s, frame.h);
    ctx.fillStyle = p.secondary; ctx.fillRect(frame.x + 25 * s, frame.y + 25 * s, 34 * s, 5 * s);
  } else if (theme.kind === 'promotion') {
    ctx.fillStyle = p.accent; ctx.fillRect(frame.x, frame.y, frame.w, 10 * s);
    ctx.fillStyle = p.secondary; ctx.beginPath(); ctx.arc(frame.x + frame.w - 37 * s, frame.y + 53 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
  } else if (theme.kind === 'portfolio') {
    ctx.strokeStyle = '#11172c22'; ctx.lineWidth = s; ctx.strokeRect(frame.x + 20 * s, frame.y + 20 * s, frame.w - 40 * s, frame.h - 40 * s);
    ctx.fillStyle = p.secondary; ctx.fillRect(frame.x + 25 * s, frame.y + 25 * s, 42 * s, 4 * s);
  } else {
    ctx.fillStyle = p.accent; ctx.fillRect(frame.x + 25 * s, frame.y + 25 * s, 42 * s, 5 * s);
    ctx.fillStyle = p.secondary; ctx.fillRect(frame.x + frame.w - 84 * s, frame.y + 25 * s, 58 * s, 5 * s);
  }
  const labelText = String(page.label || '').trim().toUpperCase();
  ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = p.purple;
  ctx.font = `600 ${15 * s * fontScale(page, 'label')}px "JetBrains Mono", monospace`;
  if (labelText) ctx.fillText(labelText, x, frame.y + 58 * s, maxW * .75);
  ctx.textAlign = 'right'; ctx.fillStyle = p.sub;
  ctx.font = `500 ${14 * s}px "JetBrains Mono", monospace`;
  ctx.fillText(String(index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'), frame.x + frame.w - 30 * s, frame.y + 58 * s);
  ctx.textAlign = 'left';

  const titleText = String(page.title || '').trim();
  if (role === 'title') {
    let y = imageAtTop ? Math.max(frame.y + frame.h * .43, imageBottom + 24 * s) : frame.y + frame.h * (hasImage ? .25 : .31);
    const fontSize = (theme.kind === 'promotion' ? 100 : theme.kind === 'portfolio' ? 84 : 92) * s * fontScale(page, 'title');
    const font = `700 ${fontSize}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = p.ink; ctx.font = font;
    const lines = wrap(titleText, maxW * (theme.kind === 'promotion' ? .82 : .9), font);
    y += drawLines(lines, x, y, fontSize * 1.04, imageAtTop ? 2 : 3);
    ctx.fillStyle = p.secondary; roundedRect(x, y + 15 * s, theme.kind === 'portfolio' ? 124 * s : 82 * s, 7 * s, 3 * s, p.secondary);
    if (page.body) {
      const bodyScale = fontScale(page, 'body'), bodyFont = `400 ${26 * s * bodyScale}px "DM Sans", sans-serif`; ctx.fillStyle = p.sub; ctx.font = bodyFont;
      y += 47 * s;
      drawLines(wrap(page.body, maxW * .82, bodyFont), x, y, 36 * s * bodyScale, imageAtTop ? 2 : 3);
    }
  } else if (role === 'content') {
    let y = imageAtTop ? Math.max(frame.y + frame.h * .44, imageBottom + 24 * s) : frame.y + frame.h * (hasImage ? .24 : .22);
    const fontSize = (imageAtTop ? (theme.kind === 'portfolio' ? 42 : 50) : theme.kind === 'portfolio' ? 58 : 62) * s * fontScale(page, 'title');
    const font = `700 ${fontSize}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = p.ink; ctx.font = font;
    const lines = wrap(titleText, maxW * .92, font);
    y += drawLines(lines, x, y, fontSize * 1.08, imageAtTop ? 2 : 3) + 22 * s;
    if (page.body) {
      const bodyScale = fontScale(page, 'body'), bodyFont = `400 ${27 * s * bodyScale}px "DM Sans", sans-serif`; ctx.font = bodyFont;
      const bodyLines = wrap(page.body, maxW - 84 * s, bodyFont).slice(0, imageAtTop ? 4 : 5);
      const cardY = y, cardH = Math.max(156 * s, bodyLines.length * 39 * s * bodyScale + 58 * s);
      const bodyCard = theme.kind === 'promotion' ? '#26324d' : theme.kind === 'portfolio' ? '#f3f0e9' : '#ffffff';
      roundedRect(x, cardY, maxW, cardH, theme.kind === 'portfolio' ? 2 * s : 13 * s, bodyCard);
      if (theme.kind === 'education') {
        roundedRect(x + 18 * s, cardY + 19 * s, 6 * s, cardH - 38 * s, 3 * s, p.accent);
        ctx.fillStyle = p.secondary; ctx.beginPath(); ctx.arc(x + maxW - 28 * s, cardY + 28 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
      } else if (theme.kind === 'promotion') {
        ctx.fillStyle = p.secondary; ctx.fillRect(x, cardY, maxW, 5 * s);
      } else if (theme.kind === 'portfolio') {
        ctx.strokeStyle = '#11172c22'; ctx.lineWidth = s; ctx.strokeRect(x, cardY, maxW, cardH);
      } else roundedRect(x + 18 * s, cardY + 19 * s, 6 * s, cardH - 38 * s, 3 * s, p.secondary);
      ctx.fillStyle = p.sub; ctx.font = bodyFont; ctx.textBaseline = 'top';
      drawLines(bodyLines, x + 38 * s, cardY + 27 * s, 39 * s * bodyScale, imageAtTop ? 4 : 5);
    }
  } else {
    const centerX = frame.x + frame.w / 2;
    const y = imageAtTop ? Math.max(frame.y + frame.h * .43, imageBottom + 24 * s) : frame.y + frame.h * (hasImage ? .24 : .27);
    ctx.textAlign = 'center';
    const fontSize = (imageAtTop ? 58 : theme.kind === 'promotion' ? 82 : 76) * s * fontScale(page, 'title'), font = `700 ${fontSize}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = p.ink; ctx.font = font;
    const lines = wrap(titleText, maxW * .78, font);
    let nextY = y + drawLines(lines, centerX, y, fontSize * 1.06, imageAtTop ? 2 : 3) + 25 * s;
    if (page.body) {
      const bodyScale = fontScale(page, 'body'), bodyFont = `400 ${25 * s * bodyScale}px "DM Sans", sans-serif`; ctx.fillStyle = p.sub; ctx.font = bodyFont;
      nextY += drawLines(wrap(page.body, maxW * .7, bodyFont), centerX, nextY, 36 * s * bodyScale, imageAtTop ? 2 : 3) + 26 * s;
    }
    if (page.cta) {
      const ctaScale = fontScale(page, 'cta'), ctaFont = `600 ${19 * s * ctaScale}px "DM Sans", sans-serif`; ctx.font = ctaFont;
      const buttonW = Math.min(ctx.measureText(page.cta).width + 54 * s * ctaScale, maxW * .78), buttonH = 58 * s * ctaScale;
      const buttonX = centerX - buttonW / 2, buttonY = imageAtTop ? nextY : Math.min(nextY, frame.y + frame.h * .75);
      const buttonColor = theme.kind === 'promotion' ? p.secondary : p.accent;
      roundedRect(buttonX, buttonY, buttonW, buttonH, theme.kind === 'portfolio' ? 2 * s : 9 * s, buttonColor);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = theme.kind === 'promotion' ? '#11172c' : '#ffffff';
      ctx.fillText(page.cta, centerX, buttonY + buttonH / 2, buttonW - 28 * s);
    }
  }
  const handle = String(page.instagram || '').trim().replace(/^@+/, '');
  if (handle) {
    const footerY = frame.y + frame.h - 39 * s;
    ctx.strokeStyle = theme.kind === 'promotion' ? '#ffffff26' : '#11172c22';
    ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(x, footerY - 13 * s); ctx.lineTo(x + maxW, footerY - 13 * s); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = p.sub;
    ctx.font = `500 ${15 * s * fontScale(page, 'instagram')}px "JetBrains Mono", monospace`;
    ctx.fillText('@' + handle, x, footerY, maxW * .75);
  }
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function typeName(kind) { return pageTypes.find(([key]) => key === kind)?.[1] || 'Isi'; }
function themeForPage(page) { return projectThemes[page.theme || state.project?.theme || 'education'] || projectThemes.education; }
function themeColor(themeKey) { const theme = projectThemes[themeKey] || projectThemes.education; return `linear-gradient(135deg,${theme.accent} 0 43%,${theme.canvas} 44% 76%,${theme.secondary} 77%)`; }
function defaultLabel(kind, themeKey = state.project?.theme || 'education') {
  const labels = {
    education: { title: 'PANDUAN PRAKTIS', content: 'POIN UTAMA', closing: 'RANGKUMAN' },
    promotion: { title: 'PENAWARAN', content: 'MANFAAT', closing: 'AKSI BERIKUTNYA' },
    portfolio: { title: 'STUDI KASUS', content: 'PROSES KARYA', closing: 'HASIL AKHIR' },
    studio: { title: 'CATATAN STUDIO', content: 'DI BALIK LAYAR', closing: 'KABAR STUDIO' }
  };
  return (labels[themeKey] || labels.education)[kind] || '';
}
function defaultCta(themeKey = state.project?.theme || 'education') {
  return ({ education: 'Simpan panduan ini ↗', promotion: 'Tanya layanan ↗', portfolio: 'Lihat proyek ↗', studio: 'Mulai ngobrol ↗' })[themeKey] || 'Mulai ngobrol ↗';
}
function makeBlankPage() {
  const theme = state.project?.theme || 'education';
  return { id: makeId(), kind: 'title', label: defaultLabel('title', theme), instagram: 'trycode_studio', title: '', body: '', cta: '', theme, fontScale: {}, imagePosition: 'top-right', imageFit: 'cover', imageFocus: 'center' };
}
function showWorkspace() {
  if (!state.project) return;
  $('#project-home').hidden = true; $('#project-workspace').hidden = false;
  $('#workspace-title').textContent = state.project.name || 'Project tanpa judul';
  $('#workspace-kind').textContent = (projectThemes[state.project.theme] || projectThemes.education).name.toUpperCase();
  $('#workspace-subtitle').textContent = (projectThemes[state.project.theme] || projectThemes.education).description;
  $('#workspace-size').value = state.size;
  renderProject();
}
function showHome() {
  $('#project-workspace').hidden = true; $('#project-home').hidden = false;
  if (state.project) {
    document.querySelectorAll('.project-theme-option').forEach((button) => {
      const active = button.dataset.theme === state.project.theme;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    const resume = $('#resume-project'); resume.hidden = false;
    resume.textContent = 'Lanjutkan project terakhir · ' + (state.project.name || 'Project tanpa judul') + ' →';
    resume.onclick = showWorkspace;
  }
}
function createProject() {
  const size = document.querySelector('.size-option.active')?.dataset.size;
  const theme = document.querySelector('.project-theme-option.active')?.dataset.theme || 'education';
  if (!size) return;
  if (state.project && !window.confirm('Project terakhir akan digantikan oleh project baru ini. Lanjutkan?')) return;
  state.pages.forEach((page) => { if (page.id) deleteImageAsset(page.id).catch(() => {}); });
  const sizeName = size === 'square' ? 'Feed' : size === 'portrait' ? 'Portrait' : 'Story';
  state.project = { id: makeId(), name: `Project ${sizeName}`, theme };
  state.size = size; state.pages = []; state.previewIndex = 0; state.editDraft = null; state.editIndex = null;
  persist(); showWorkspace();
}
function movePage(index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= state.pages.length) return;
  [state.pages[index], state.pages[destination]] = [state.pages[destination], state.pages[index]];
  state.previewIndex = destination; renderProject(); render();
}
function renderProject() {
  const grid = $('#posts-grid'); grid.replaceChildren();
  $('#workspace-title').textContent = state.project?.name || 'Project tanpa judul';
  $('#posts-count').textContent = state.pages.length + (state.pages.length === 1 ? ' POST' : ' POSTS');
  $('#preview-count').textContent = state.pages.length;
  if (!state.pages.length) {
    const empty = document.createElement('section'); empty.className = 'empty-project';
    const art = document.createElement('div'); art.className = 'empty-project-art'; art.innerHTML = '<span>trycode_</span><i></i><b>+</b>';
    const copy = document.createElement('div'); copy.className = 'empty-project-copy';
    const label = document.createElement('span'); label.className = 'step-label'; label.textContent = 'CANVAS PROJECT';
    const title = document.createElement('h2'); title.textContent = 'Project-mu siap diisi.';
    const body = document.createElement('p'); body.textContent = 'Mulai dengan satu post. Pilih perannya, tulis isinya, dan tema ' + (projectThemes[state.project?.theme] || projectThemes.education).name + ' akan menyesuaikan layout.';
    const add = document.createElement('button'); add.type = 'button'; add.className = 'primary-action'; add.textContent = 'Buat post pertama'; add.addEventListener('click', () => openPostEditor());
    copy.append(label, title, body, add); empty.append(art, copy); grid.append(empty);
  } else {
    state.pages.forEach((page, index) => {
      const card = document.createElement('article'); card.className = 'post-card';
      const visual = document.createElement('div'); visual.className = 'post-card-visual';
      const thumb = document.createElement('canvas');
      const [baseW, baseH] = dims[state.size] || dims.square, thumbW = 320, thumbH = Math.round(thumbW * baseH / baseW);
      thumb.width = thumbW; thumb.height = thumbH; thumb.setAttribute('aria-label', 'Preview post ' + (index + 1));
      visual.append(thumb);
      const previousContext = ctx; ctx = thumb.getContext('2d');
      try { drawPageLayout(page, index, state.pages.length, thumbW, thumbH); } finally { ctx = previousContext; }
      const detail = document.createElement('div'); detail.className = 'post-card-detail';
      const meta = document.createElement('div'); meta.className = 'post-card-meta';
      const kind = document.createElement('span'); kind.className = 'post-kind-pill'; kind.textContent = typeName(page.kind);
      const number = document.createElement('span'); number.className = 'post-number'; number.textContent = 'POST ' + String(index + 1).padStart(2, '0');
      meta.append(kind, number);
      const title = document.createElement('h2'); title.textContent = page.title || 'Post tanpa judul';
      const theme = document.createElement('p'); theme.className = 'post-theme-name'; theme.textContent = themeForPage(page).name + (page.imageObject ? ' · Ada gambar' : '');
      const tools = document.createElement('div'); tools.className = 'post-card-tools';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'post-edit'; edit.textContent = 'Edit post'; edit.addEventListener('click', () => openPostEditor(index));
      const up = document.createElement('button'); up.type = 'button'; up.className = 'post-tool'; up.textContent = '↑'; up.title = 'Geser ke atas'; up.disabled = index === 0; up.addEventListener('click', () => movePage(index, -1));
      const down = document.createElement('button'); down.type = 'button'; down.className = 'post-tool'; down.textContent = '↓'; down.title = 'Geser ke bawah'; down.disabled = index === state.pages.length - 1; down.addEventListener('click', () => movePage(index, 1));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'post-tool post-remove'; remove.textContent = '×'; remove.title = 'Hapus post'; remove.addEventListener('click', async () => { const [deleted] = state.pages.splice(index, 1); try { await deleteImageAsset(deleted.id); } catch {} state.previewIndex = Math.max(0, Math.min(state.previewIndex, state.pages.length - 1)); persist(); renderProject(); });
      tools.append(edit, up, down, remove); detail.append(meta, title, theme, tools); card.append(visual, detail); grid.append(card);
    });
    const addCard = document.createElement('button'); addCard.type = 'button'; addCard.className = 'add-post-card'; addCard.innerHTML = '<span>＋</span><strong>Tambah post</strong><small>Lanjutkan alur project-mu</small>'; addCard.addEventListener('click', () => openPostEditor()); grid.append(addCard);
  }
  persist();
}
function renderThemeOptions() {
  const choices = $('#post-theme-choices'); choices.replaceChildren();
  const theme = themeForPage(state.editDraft);
  const button = document.createElement('div'); button.className = 'theme-choice active'; button.setAttribute('aria-label', 'Tema ' + theme.name);
  const swatch = document.createElement('i'); swatch.style.background = themeColor(state.editDraft.theme);
  const copy = document.createElement('span'); copy.className = 'theme-choice-copy';
  const title = document.createElement('strong'); title.textContent = theme.name;
  const description = document.createElement('small'); description.textContent = theme.description + ' Layout juga menyesuaikan peran post.';
  copy.append(title, description); button.append(swatch, copy); choices.append(button);
}
function updatePostEditor() {
  const page = state.editDraft; if (!page) return;
  $('#post-kind').value = page.kind;
  $('#post-title-label').textContent = page.kind === 'closing' ? 'JUDUL PENUTUP' : page.kind === 'content' ? 'JUDUL ISI' : 'JUDUL UTAMA';
  $('#post-label-caption').textContent = page.kind === 'closing' ? 'LABEL PEMBUKA' : page.kind === 'content' ? 'LABEL BAGIAN' : 'LABEL PEMBUKA';
  $('#post-label').value = page.label || '';
  $('#post-instagram').value = String(page.instagram || '').replace(/^@+/, '');
  $('#post-cta-field').hidden = page.kind !== 'closing';
  $('#post-cta').placeholder = 'Contoh: ' + defaultCta(page.theme || state.project?.theme || 'education');
  $('#post-title').value = page.title || ''; $('#post-body').value = page.body || ''; $('#post-cta').value = page.cta || '';
  ['label', 'title', 'body', 'cta', 'instagram'].forEach((part) => {
    const value = Number(page.fontScale?.[part]) || 100;
    const slider = $('#font-' + part); slider.value = value; $('#font-' + part + '-output').value = value + '%';
  });
  $('#post-image-position').value = page.imagePosition || 'top-right'; $('#post-image-fit').value = page.imageFit || 'cover'; $('#post-image-focus').value = page.imageFocus || 'center';
  const hasImage = Boolean(page.imageData && page.imageObject);
  $('#post-image-thumb').hidden = !hasImage; if (hasImage) $('#post-image-thumb').src = page.imageData;
  $('#post-image-empty').hidden = hasImage; $('#remove-post-image').hidden = !hasImage;
  $('#post-image-settings').hidden = !hasImage; $('#post-image-focus-field').hidden = !hasImage || page.imageFit === 'contain';
  $('#image-button-text').textContent = hasImage ? 'Ganti gambar' : 'Pilih gambar';
  renderThemeOptions();
}
function openPostEditor(index = null) {
  state.editIndex = index;
  state.editDraft = index === null ? makeBlankPage() : { ...state.pages[index] };
  $('#post-dialog-title').textContent = index === null ? 'Post baru' : 'Edit post ' + String(index + 1).padStart(2, '0');
  updatePostEditor(); $('#post-dialog').showModal(); $('#post-kind').focus();
}
function closePostEditor() { $('#post-dialog').close(); state.editDraft = null; state.editIndex = null; }
async function savePost() {
  const page = state.editDraft;
  if (!page?.title.trim()) { $('#post-title').focus(); toast('Isi judul post dulu sebelum disimpan.'); return; }
  const previous = state.editIndex === null ? null : state.pages[state.editIndex];
  let imageSaved = true;
  if (page.imageData && page.imageObject) {
    try { await saveImageAsset(page.id, page.imageData); }
    catch { imageSaved = false; }
  } else if (previous?.imageObject || previous?.imageData) { try { await deleteImageAsset(page.id); } catch {} }
  if (state.editIndex === null) { state.pages.push(page); state.previewIndex = state.pages.length - 1; }
  else { state.pages[state.editIndex] = page; state.previewIndex = state.editIndex; }
  closePostEditor(); renderProject(); render();
  toast(imageSaved ? 'Post ditambahkan ke project.' : 'Post tersimpan, tetapi gambar tidak bisa disimpan untuk sesi berikutnya.');
}
function renderProjectPreview() {
  if (!state.pages.length) return;
  state.previewIndex = Math.max(0, Math.min(state.previewIndex, state.pages.length - 1));
  const page = state.pages[state.previewIndex], size = dims[state.size] || dims.square, w = size[0], h = size[1];
  canvas.width = w; canvas.height = h; drawPageLayout(page, state.previewIndex, state.pages.length, w, h);
  $('#format-chip').textContent = w + ' × ' + h;
  $('#slide-counter').textContent = (state.previewIndex + 1) + ' / ' + state.pages.length;
  $('#preview-caption').textContent = 'Post ' + (state.previewIndex + 1) + ' · ' + typeName(page.kind);
  $('#theme-caption').textContent = 'TEMA ' + themeForPage(page).name.toUpperCase();
  $('#prev-slide').disabled = state.previewIndex === 0; $('#next-slide').disabled = state.previewIndex === state.pages.length - 1;
  persist();
}
function render() { renderProjectPreview(); }
function pngBytes(dataUrl) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return table;
})();
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function zipStore(files) {
  const encoder = new TextEncoder(), chunks = [], central = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), data = file.data, crc = crc32(data);
    const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true); local.set(name, 30); chunks.push(local, data);
    const directory = new Uint8Array(46 + name.length), dv = new DataView(directory.buffer);
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true); dv.setUint16(14, 0x21, true); dv.setUint32(16, crc, true); dv.setUint32(20, data.length, true); dv.setUint32(24, data.length, true); dv.setUint16(28, name.length, true); dv.setUint32(42, offset, true); directory.set(name, 46); central.push(directory); offset += local.length + data.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}
function downloadOne() {
  const page = state.pages[state.previewIndex], size = dims[state.size]; canvas.width = size[0]; canvas.height = size[1];
  drawPageLayout(page, state.previewIndex, state.pages.length, size[0], size[1]);
  const link = document.createElement('a'); link.download = 'trycode-post-' + String(state.previewIndex + 1).padStart(2, '0') + '-' + state.size + '.png'; link.href = canvas.toDataURL('image/png'); link.click(); render();
  toast('Post ' + (state.previewIndex + 1) + ' berhasil diunduh.');
}
async function downloadAll() {
  const button = $('#download-all'); button.disabled = true; button.textContent = 'Menyiapkan ZIP…';
  const original = state.previewIndex, files = [];
  try {
    for (let i = 0; i < state.pages.length; i++) {
      state.previewIndex = i; render();
      files.push({ name: 'trycode-post-' + String(i + 1).padStart(2, '0') + '.png', data: pngBytes(canvas.toDataURL('image/png')) });
    }
    const url = URL.createObjectURL(zipStore(files)), link = document.createElement('a');
    link.href = url; link.download = 'trycode-post-' + state.size + '.zip'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(files.length + ' post dikemas dalam satu file ZIP.');
  } catch { toast('ZIP belum berhasil dibuat. Coba unduh post satu per satu.'); }
  finally { state.previewIndex = original; render(); button.disabled = false; button.innerHTML = 'Unduh semua post <small>.ZIP</small>'; }
}
try {
  const saved = JSON.parse(localStorage.getItem('trycode-postmaker') || 'null');
  if (saved) {
    if (Array.isArray(saved.pages)) state.pages = saved.pages;
    else if (Array.isArray(saved.slides) && saved.slides.length) {
      state.pages = saved.slides.map((slide, index) => ({ id: makeId(), kind: index === 0 ? 'title' : 'content', label: saved.label || '', title: slide.title || '', body: slide.body || '', cta: '', theme: 'trycode' }));
      state.pages.push({ id: makeId(), kind: 'closing', label: 'PENUTUP', title: saved.outroTitle || 'Punya ide? Yuk, wujudkan.', body: saved.outroBody || '', cta: saved.outroCta || 'Mulai ngobrol ↗', theme: 'trycode' });
    } else if (saved.title) state.pages = [{ id: makeId(), kind: 'title', label: saved.label || '', title: saved.title, body: saved.body || '', cta: saved.cta || '', theme: 'trycode' }];
    if (saved.project) {
      state.project = saved.project;
      if (!projectThemes[state.project.theme]) {
        state.project.theme = ({ education: 'education', promotion: 'promotion', portfolio: 'portfolio', other: 'studio' })[state.project.type] || 'education';
      }
    } else if (state.pages.length) state.project = { id: makeId(), name: 'Project sebelumnya', theme: 'education' };
    if (dims[saved.size]) state.size = saved.size;
    if (Number.isInteger(saved.previewIndex)) state.previewIndex = saved.previewIndex;
  }
} catch { /* Ignore malformed or unavailable browser storage. */ }
state.pages.forEach((page) => {
  if (!page.id) page.id = makeId();
  if (!page.kind) page.kind = 'content';
  page.theme = state.project?.theme || 'education';
  if (typeof page.title !== 'string') page.title = '';
  if (typeof page.body !== 'string') page.body = '';
  if (typeof page.cta !== 'string') page.cta = '';
  if (typeof page.label !== 'string') page.label = '';
  if (typeof page.instagram !== 'string') page.instagram = state.project?.instagram || 'trycode_studio';
  page.instagram = page.instagram.replace(/^@+/, '');
  if (!page.fontScale || typeof page.fontScale !== 'object') page.fontScale = {};
  ['label', 'title', 'body', 'cta', 'instagram'].forEach((part) => {
    const value = Number(page.fontScale[part]); page.fontScale[part] = Number.isFinite(value) ? Math.max(70, Math.min(150, value)) : 100;
  });
  if (!page.imagePosition) page.imagePosition = 'top-right';
  if (!page.imageFit) page.imageFit = 'cover';
  if (!page.imageFocus) page.imageFocus = 'center';
});
state.previewIndex = state.pages.length ? Math.max(0, Math.min(state.previewIndex, state.pages.length - 1)) : 0;
if (state.project) document.querySelectorAll('.project-theme-option').forEach((button) => {
  const active = button.dataset.theme === state.project.theme;
  button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
});
if (state.project) { $('#resume-project').hidden = false; $('#resume-project').textContent = 'Lanjutkan project terakhir · ' + (state.project.name || 'Project tanpa judul') + ' →'; }
Promise.all(state.pages.map(async (page) => {
  try {
    if (page.imageData) { page.imageObject = await decodeImage(page.imageData); return; }
    const data = await getImageAsset(page.id); if (data) { page.imageData = data; page.imageObject = await decodeImage(data); }
  } catch { /* Image persistence may be blocked by browser settings. */ }
})).then(() => { if (!$('#project-workspace').hidden) renderProject(); });
document.querySelectorAll('.size-option').forEach((button) => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => { document.querySelectorAll('.size-option').forEach((el) => { const selected = el === button; el.classList.toggle('active', selected); el.setAttribute('aria-pressed', String(selected)); }); updateCreateButton(); });
});
document.querySelectorAll('.project-theme-option').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.project-theme-option').forEach((item) => {
      const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active));
    });
  });
});
function updateCreateButton() { $('#create-project').disabled = !document.querySelector('.size-option.active'); }
$('#create-project').addEventListener('click', createProject);
$('#resume-project').addEventListener('click', showWorkspace);
$('#back-home').addEventListener('click', showHome);
$('#workspace-size').addEventListener('change', (event) => {
  if (!dims[event.target.value] || !state.project) return;
  state.size = event.target.value;
  persist();
  renderProject();
  if ($('#preview-dialog').open) render();
});
$('#open-preview').addEventListener('click', () => { if (!state.pages.length) { toast('Tambahkan post dulu sebelum ekspor.'); return; } state.previewIndex = 0; render(); $('#preview-dialog').showModal(); $('#close-preview').focus(); });
$('#close-preview').addEventListener('click', () => $('#preview-dialog').close());
$('#preview-dialog').addEventListener('click', (event) => { if (event.target === $('#preview-dialog')) $('#preview-dialog').close(); });
$('#close-post-dialog').addEventListener('click', closePostEditor);
$('#cancel-post').addEventListener('click', closePostEditor);
$('#save-post').addEventListener('click', savePost);
$('#post-kind').addEventListener('change', (event) => {
  if (!state.editDraft) return;
  const oldKind = state.editDraft.kind, newKind = event.target.value, theme = state.editDraft.theme || state.project?.theme || 'education';
  const labelWasDefault = !state.editDraft.label || state.editDraft.label.toUpperCase() === defaultLabel(oldKind, theme);
  const ctaWasDefault = state.editDraft.cta === defaultCta(theme);
  state.editDraft.kind = newKind;
  if (labelWasDefault) state.editDraft.label = defaultLabel(newKind, theme);
  if (newKind === 'closing' && !state.editDraft.cta) state.editDraft.cta = defaultCta(theme);
  if (newKind !== 'closing' && ctaWasDefault) state.editDraft.cta = '';
  updatePostEditor();
});
$('#post-label').addEventListener('input', (event) => { if (state.editDraft) state.editDraft.label = event.target.value; });
$('#post-instagram').addEventListener('input', (event) => { if (state.editDraft) state.editDraft.instagram = event.target.value.replace(/^@+/, ''); });
document.querySelectorAll('[data-font]').forEach((slider) => slider.addEventListener('input', (event) => {
  if (!state.editDraft) return;
  const part = event.target.dataset.font, value = Number(event.target.value);
  state.editDraft.fontScale ||= {}; state.editDraft.fontScale[part] = value;
  $('#font-' + part + '-output').value = value + '%';
}));
$('#post-title').addEventListener('input', (event) => { if (state.editDraft) state.editDraft.title = event.target.value; });
$('#post-body').addEventListener('input', (event) => { if (state.editDraft) state.editDraft.body = event.target.value; });
$('#post-cta').addEventListener('input', (event) => { if (state.editDraft) state.editDraft.cta = event.target.value; });
$('#post-image-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0], draft = state.editDraft; if (!file || !draft) return;
  try { const packed = await prepareImage(file); if (state.editDraft !== draft) return; draft.imageData = packed.data; draft.imageObject = packed.image; updatePostEditor(); }
  catch (error) { toast(error.message || 'Gambar belum bisa dibuka. Coba file lain.'); }
  event.target.value = '';
});
$('#remove-post-image').addEventListener('click', () => { if (!state.editDraft) return; state.editDraft.imageData = ''; state.editDraft.imageObject = null; updatePostEditor(); });
$('#post-image-position').addEventListener('change', (event) => { if (state.editDraft) state.editDraft.imagePosition = event.target.value; });
$('#post-image-fit').addEventListener('change', (event) => { if (state.editDraft) { state.editDraft.imageFit = event.target.value; updatePostEditor(); } });
$('#post-image-focus').addEventListener('change', (event) => { if (state.editDraft) state.editDraft.imageFocus = event.target.value; });
$('#prev-slide').addEventListener('click', () => { state.previewIndex = Math.max(0, state.previewIndex - 1); render(); });
$('#next-slide').addEventListener('click', () => { state.previewIndex = Math.min(state.pages.length - 1, state.previewIndex + 1); render(); });
let touchStartX = 0;
$('#canvas-stage').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); state.previewIndex = Math.max(0, state.previewIndex - 1); render(); }
  if (event.key === 'ArrowRight') { event.preventDefault(); state.previewIndex = Math.min(state.pages.length - 1, state.previewIndex + 1); render(); }
});
$('#canvas-stage').addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
$('#canvas-stage').addEventListener('touchend', (event) => {
  const delta = event.changedTouches[0].clientX - touchStartX; if (Math.abs(delta) < 45) return;
  state.previewIndex = Math.max(0, Math.min(state.pages.length - 1, state.previewIndex + (delta < 0 ? 1 : -1))); render();
}, { passive: true });
$('#download-page').addEventListener('click', downloadOne);
$('#download-all').addEventListener('click', downloadAll);
$('#preview-dialog').addEventListener('close', () => { if (state.pages.length) renderProject(); });
if (document.fonts?.ready) document.fonts.ready.then(() => { if (!$('#project-workspace').hidden) renderProject(); render(); });
