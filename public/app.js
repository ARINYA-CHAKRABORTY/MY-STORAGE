/* ══════════════════════════════════════════════════
   ARCHIVE — Professional Gallery App
══════════════════════════════════════════════════ */

// ── DOM refs ──────────────────────────────────────
const gridContainer      = document.getElementById('grid-container');
const emptyState         = document.getElementById('empty-state');
const filesView          = document.getElementById('files-view');
const galleryView        = document.getElementById('gallery-view');
const folderGrid         = document.getElementById('folder-grid');
const fileListContainer  = document.getElementById('file-list-container');
const filesEmptyState    = document.getElementById('files-empty-state');
const filesBreadcrumb    = document.getElementById('files-breadcrumb');

const uploadModal        = document.getElementById('upload-modal');
const uploadForm         = document.getElementById('upload-form');
const fileInput          = document.getElementById('file-input');
const fileLabel          = document.getElementById('file-label');
const albumField         = document.getElementById('album-field');
const albumSelect        = document.getElementById('album-select');
const folderField        = document.getElementById('folder-field');
const folderInput        = document.getElementById('folder-input');
const folderOptions      = document.getElementById('folder-options');
const captionInput       = document.getElementById('caption-input');
const uploadBtn          = document.getElementById('upload-btn');
const uploadStatus       = document.getElementById('upload-status');

const newFolderModal     = document.getElementById('new-folder-modal');
const newFolderName      = document.getElementById('new-folder-name');

const backupModal        = document.getElementById('backup-modal');
const excludeVideosCheck = document.getElementById('exclude-videos-check');

const deleteModal        = document.getElementById('delete-modal');

const lightbox           = document.getElementById('lightbox');
const lightboxContent    = document.getElementById('lightbox-content');
const lightboxCaption    = document.getElementById('lightbox-caption');
const lightboxClose      = document.getElementById('lightbox-close');
const lightboxPrev       = document.getElementById('lightbox-prev');
const lightboxNext       = document.getElementById('lightbox-next');

const sidebar            = document.getElementById('sidebar');
const sidebarBackdrop    = document.getElementById('sidebar-backdrop');
const menuToggle         = document.getElementById('menu-toggle');
const sidebarClose       = document.getElementById('sidebar-close');
const breadcrumbs        = document.getElementById('breadcrumbs');
const statFramesNum      = document.getElementById('stat-frames-num');
const statFilesNum       = document.getElementById('stat-files-num');

// ── State ─────────────────────────────────────────
let items        = [];
let isDemoMode   = false;
let section      = 'gallery';   // 'gallery' | 'files'
let activeAlbum  = 'All';
let activeFolder = null;        // null = root, string = folder name
let visibleFlat  = [];
let lightboxIndex = -1;
let pendingDeleteId = null;

// ── Sidebar toggle ────────────────────────────────
function openSidebar() {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('visible');
  document.body.style.overflow = '';
}
menuToggle.onclick    = openSidebar;
sidebarClose.onclick  = closeSidebar;
sidebarBackdrop.onclick = closeSidebar;

// ── Nav items ─────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const sec   = btn.dataset.section;
    const album = btn.dataset.album;

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (sec === 'gallery') {
      setSection('gallery', album || 'All');
    } else {
      setSection('files');
    }

    // close sidebar on mobile after nav
    if (window.innerWidth <= 820) closeSidebar();
  });
});

function setSection(sec, album) {
  section = sec;
  if (album !== undefined) activeAlbum = album;

  galleryView.hidden = sec !== 'gallery';
  filesView.hidden   = sec !== 'files';

  if (sec === 'gallery') {
    setBreadcrumb(activeAlbum);
    renderGallery();
  } else {
    activeFolder = null;
    setBreadcrumb('File Browser');
    renderFolderRoot();
  }
  updateStats();
}

function setBreadcrumb(label) {
  breadcrumbs.innerHTML = `<span class="breadcrumb active">${escHtml(label)}</span>`;
}

// ── Mock demo data ────────────────────────────────
function getMockData() {
  return [
    { id:'d1', type:'photo',    fileId:'', album:'Camera',        filename:'sunset.jpg',           mimetype:'image/jpeg',       sizeBytes:1542000, caption:'Beautiful beach sunset',          demoUrl:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',    uploadedAt: new Date(Date.now()-3600000).toISOString() },
    { id:'d2', type:'photo',    fileId:'', album:'Camera',        filename:'architecture.jpg',      mimetype:'image/jpeg',       sizeBytes:2450000, caption:'Modern architectural design',     demoUrl:'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',    uploadedAt: new Date(Date.now()-7200000).toISOString() },
    { id:'d3', type:'photo',    fileId:'', album:'Screenshots',   filename:'dashboard.jpg',         mimetype:'image/jpeg',       sizeBytes:520000,  caption:'Dashboard inspiration',           demoUrl:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',    uploadedAt: new Date(Date.now()-14400000).toISOString() },
    { id:'d4', type:'video',    fileId:'', album:'WhatsApp Video', filename:'sea_waves.mp4',        mimetype:'video/mp4',        sizeBytes:4500000, caption:'Ocean waves',                     demoUrl:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', uploadedAt: new Date(Date.now()-86400000).toISOString() },
    { id:'d5', type:'photo',    fileId:'', album:'Downloads',     filename:'nature.jpg',            mimetype:'image/jpeg',       sizeBytes:890000,  caption:'',                                demoUrl:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',    uploadedAt: new Date(Date.now()-172800000).toISOString() },
    { id:'d6', type:'document', fileId:'', album:'Documents',     filename:'Project_Proposal.pdf',  mimetype:'application/pdf',  sizeBytes:1250000, caption:'',                                uploadedAt: new Date(Date.now()-259200000).toISOString() },
    { id:'d7', type:'document', fileId:'', album:'Tax 2024',      filename:'tax_return_2024.pdf',   mimetype:'application/pdf',  sizeBytes:420000,  caption:'',                                uploadedAt: new Date(Date.now()-604800000).toISOString() },
    { id:'d8', type:'document', fileId:'', album:'Tax 2024',      filename:'receipt_april.jpg',     mimetype:'image/jpeg',       sizeBytes:180000,  caption:'',                                uploadedAt: new Date(Date.now()-700000000).toISOString() },
  ];
}

// ── Load from server ──────────────────────────────
async function loadMedia() {
  try {
    const res = await fetch('/api/media');
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    if (!res.ok) throw new Error('API failed');
    items = await res.json();
    isDemoMode = false;
  } catch (err) {
    if (!isDemoMode) {
      console.warn('Using demo data:', err.message);
      isDemoMode = true;
      items = getMockData();
    }
  }
  items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  updateStats();
  if (section === 'gallery') renderGallery();
  else renderFolderRoot();
  updateFolderDatalist();
}

function mediaItems()   { return items.filter(i => i.type === 'photo' || i.type === 'video'); }
function fileItems()    { return items.filter(i => i.type === 'document'); }
function folderItems()  { return items.filter(i => i.type === 'folder'); }

function updateStats() {
  statFramesNum.textContent = mediaItems().length;
  statFilesNum.textContent  = fileItems().length;
}

// ── Gallery renderer ──────────────────────────────
function dateHeaderLabel(date) {
  const now  = new Date();
  const prev = new Date(now); prev.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString())  return 'Today';
  if (date.toDateString() === prev.toDateString()) return 'Yesterday';
  const opts = { weekday:'long', month:'long', day:'numeric' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString(undefined, opts);
}

function groupByDate(list) {
  const groups = [];
  let curKey = null, curGroup = null;
  list.forEach(item => {
    const d = new Date(item.uploadedAt);
    const key = d.toDateString();
    if (key !== curKey) {
      curKey = key;
      curGroup = { label: dateHeaderLabel(d), items: [] };
      groups.push(curGroup);
    }
    curGroup.items.push(item);
  });
  return groups;
}

function renderGallery() {
  const all     = mediaItems();
  const visible = activeAlbum === 'All' ? all : all.filter(i => (i.album || 'Uploads') === activeAlbum);
  visibleFlat   = visible;

  gridContainer.innerHTML = '';
  emptyState.hidden = visible.length > 0;

  let globalIdx = 0;
  groupByDate(visible).forEach(group => {
    const sec = document.createElement('section');
    sec.className = 'date-group';

    const hdr = document.createElement('h2');
    hdr.className = 'date-header';
    hdr.textContent = group.label;
    sec.appendChild(hdr);

    const grid = document.createElement('div');
    grid.className = 'grid';

    group.items.forEach(item => {
      const frame = document.createElement('div');
      frame.className = 'frame';
      frame.style.animationDelay = `${Math.min(globalIdx, 30) * 12}ms`;

      const media = item.type === 'video'
        ? Object.assign(document.createElement('video'), { muted: true, preload: 'metadata' })
        : document.createElement('img');
      media.className = 'frame-media';
      media.src = item.demoUrl || `/api/file/${item.id}`;
      media.loading = 'lazy';
      frame.appendChild(media);

      if (item.type === 'video') {
        const badge = document.createElement('span');
        badge.className = 'video-badge';
        badge.textContent = 'VIDEO';
        frame.appendChild(badge);
      }

      const footer = document.createElement('div');
      footer.className = 'frame-footer';
      const lbl = document.createElement('span');
      lbl.className = 'frame-num';
      const t = new Date(item.uploadedAt).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
      lbl.textContent = activeAlbum === 'All' ? (item.album || 'Uploads') : t;
      const del = document.createElement('button');
      del.className = 'frame-delete';
      del.textContent = '✕ remove';
      del.onclick = e => { e.stopPropagation(); openDeleteModal(item.id); };
      footer.appendChild(lbl);
      footer.appendChild(del);
      frame.appendChild(footer);

      const idx = visibleFlat.indexOf(item);
      frame.onclick = () => openLightbox(idx);
      grid.appendChild(frame);
      globalIdx++;
    });

    sec.appendChild(grid);
    gridContainer.appendChild(sec);
  });
}

// ── File Browser ──────────────────────────────────
function allFolderNames() {
  const fromFiles = fileItems().map(i => i.album || 'General');
  const fromFolders = folderItems().map(i => i.album);
  return [...new Set([...fromFiles, ...fromFolders])].sort();
}

function renderFolderRoot() {
  activeFolder = null;
  // rebuild breadcrumb
  filesBreadcrumb.innerHTML = '';
  const root = mkBcItem('📁 Files', null, true);
  filesBreadcrumb.appendChild(root);

  folderGrid.innerHTML = '';
  fileListContainer.innerHTML = '';

  const folders = allFolderNames();
  filesEmptyState.hidden = folders.length > 0;

  folders.forEach((folder, idx) => {
    const count = fileItems().filter(i => (i.album || 'General') === folder).length;
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.style.animationDelay = `${idx * 40}ms`;
    card.innerHTML = `
      <span class="folder-card-icon">📁</span>
      <span class="folder-card-name">${escHtml(folder)}</span>
      <span class="folder-card-count">${count} file${count !== 1 ? 's' : ''}</span>
    `;
    card.onclick = () => openFolder(folder);
    folderGrid.appendChild(card);
  });
}

function openFolder(folderName) {
  activeFolder = folderName;

  // breadcrumb
  filesBreadcrumb.innerHTML = '';
  const root = mkBcItem('📁 Files', null, false);
  filesBreadcrumb.appendChild(root);
  const sep = document.createElement('span');
  sep.className = 'bc-sep'; sep.textContent = '/';
  filesBreadcrumb.appendChild(sep);
  const cur = mkBcItem(folderName, folderName, true);
  filesBreadcrumb.appendChild(cur);

  // also update topbar breadcrumb
  breadcrumbs.innerHTML = `
    <span class="breadcrumb" style="cursor:pointer" id="bc-root">File Browser</span>
    <span class="breadcrumb-sep">/</span>
    <span class="breadcrumb active">${escHtml(folderName)}</span>
  `;
  document.getElementById('bc-root').onclick = () => {
    setBreadcrumb('File Browser');
    renderFolderRoot();
  };

  folderGrid.innerHTML = '';
  fileListContainer.innerHTML = '';

  const files = fileItems().filter(i => (i.album || 'General') === folderName);
  filesEmptyState.hidden = files.length > 0;
  if (!files.length) return;

  const label = document.createElement('div');
  label.className = 'folder-section-label';
  label.textContent = `${folderName} — ${files.length} file${files.length !== 1 ? 's' : ''}`;
  fileListContainer.appendChild(label);

  files.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.style.animationDelay = `${idx * 30}ms`;

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = fileIcon(item.filename, item.mimetype);

    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const nm = document.createElement('div');
    nm.className = 'file-name';
    nm.textContent = item.filename || 'Untitled';
    const sub = document.createElement('div');
    sub.className = 'file-sub';
    const date = new Date(item.uploadedAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
    sub.textContent = [formatBytes(item.sizeBytes), date].filter(Boolean).join(' · ');
    meta.appendChild(nm);
    meta.appendChild(sub);

    const del = document.createElement('button');
    del.className = 'file-delete';
    del.innerHTML = '✕';
    del.title = 'Remove from list';
    del.onclick = e => { e.stopPropagation(); openDeleteModal(item.id); };

    row.appendChild(icon);
    row.appendChild(meta);
    row.appendChild(del);
    row.onclick = () => window.open(item.demoUrl || `/api/file/${item.id}`, '_blank');
    fileListContainer.appendChild(row);
  });
}

function mkBcItem(label, folderTarget, isActive) {
  const btn = document.createElement('button');
  btn.className = 'bc-item' + (isActive ? ' active' : '');
  btn.textContent = label;
  if (!isActive) {
    btn.onclick = () => {
      if (folderTarget === null) {
        setBreadcrumb('File Browser');
        renderFolderRoot();
      } else {
        openFolder(folderTarget);
      }
    };
  }
  return btn;
}

// ── New Folder ────────────────────────────────────
document.getElementById('new-folder-btn').onclick = () => {
  newFolderName.value = '';
  newFolderModal.hidden = false;
  setTimeout(() => newFolderName.focus(), 50);
};
document.getElementById('new-folder-cancel').onclick   = () => { newFolderModal.hidden = true; };
document.getElementById('new-folder-cancel-x').onclick = () => { newFolderModal.hidden = true; };

document.getElementById('new-folder-create').onclick = async () => {
  const name = newFolderName.value.trim();
  if (!name) { newFolderName.focus(); return; }
  newFolderModal.hidden = true;

  if (isDemoMode) {
    items.push({ id: `folder-${Date.now()}`, type:'folder', album: name, uploadedAt: new Date().toISOString() });
    renderFolderRoot();
    return;
  }
  try {
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    await loadMedia();
  } catch (err) {
    showStatus('Failed to create folder: ' + err.message, true);
  }
};

// click outside new-folder modal
newFolderModal.addEventListener('click', e => { if (e.target === newFolderModal) { newFolderModal.hidden = true; } });

// ── Backup Modal ──────────────────────────────────
document.getElementById('backup-btn').onclick = () => {
  excludeVideosCheck.checked = false;
  backupModal.hidden = false;
};
document.getElementById('backup-cancel').onclick   = () => { backupModal.hidden = true; };
document.getElementById('backup-cancel-x').onclick = () => { backupModal.hidden = true; };
backupModal.addEventListener('click', e => { if (e.target === backupModal) backupModal.hidden = true; });

document.getElementById('backup-confirm').onclick = () => {
  backupModal.hidden = true;
  const excludeVideos = excludeVideosCheck.checked;
  const url = '/api/backup' + (excludeVideos ? '?excludeVideos=true' : '');
  window.location.href = url;
  showStatus('Preparing your backup zip… Keep this tab open.', false);
};

// ── Delete Modal ──────────────────────────────────
function openDeleteModal(id) {
  pendingDeleteId = id;
  deleteModal.hidden = false;
}
document.getElementById('delete-cancel').onclick = () => { deleteModal.hidden = true; pendingDeleteId = null; };
deleteModal.addEventListener('click', e => { if (e.target === deleteModal) { deleteModal.hidden = true; pendingDeleteId = null; } });

document.getElementById('delete-confirm').onclick = async () => {
  deleteModal.hidden = true;
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  pendingDeleteId = null;

  if (isDemoMode) {
    items = items.filter(i => i.id !== id);
    await loadMedia(); return;
  }
  await fetch(`/api/media/${id}`, { method: 'DELETE' });
  await loadMedia();
};

// ── Upload Modal ──────────────────────────────────
function openModal() {
  // pre-fill folder if inside a folder in files section
  if (section === 'files' && activeFolder) {
    folderInput.value = activeFolder;
    albumField.hidden = true;
    folderField.hidden = false;
  }
  uploadModal.hidden = false;
}
function closeModal() {
  uploadModal.hidden = true;
  uploadForm.reset();
  fileLabel.textContent = 'Choose a photo, video, or document';
  albumField.hidden = false;
  folderField.hidden = true;
}

document.getElementById('fab').onclick = openModal;
document.getElementById('modal-cancel').onclick   = closeModal;
document.getElementById('modal-cancel-2').onclick = closeModal;
uploadModal.addEventListener('click', e => { if (e.target === uploadModal) closeModal(); });

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileLabel.textContent = file ? file.name : 'Choose a photo, video, or document';
  if (!file) return;
  const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
  albumField.hidden = !isMedia;
  folderField.hidden = isMedia;
});

uploadForm.addEventListener('submit', async e => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;
  const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');

  uploadBtn.disabled = true;
  showStatus(`Uploading ${file.name}…`, false);
  closeModal();

  const form = new FormData();
  form.append('file', file);
  form.append('album', isMedia ? albumSelect.value : (folderInput.value.trim() || 'General'));
  form.append('caption', captionInput.value);

  if (isDemoMode) {
    setTimeout(() => {
      const demoUrl = URL.createObjectURL(file);
      items.unshift({
        id: `demo-${Date.now()}`,
        type: file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'photo' : 'document',
        fileId: '', album: isMedia ? albumSelect.value : (folderInput.value.trim() || 'General'),
        filename: file.name, mimetype: file.type, sizeBytes: file.size,
        caption: captionInput.value, demoUrl, uploadedAt: new Date().toISOString()
      });
      showStatus('Uploaded (demo mode).', false);
      loadMedia();
      uploadBtn.disabled = false;
      setTimeout(() => { uploadStatus.hidden = true; }, 2500);
    }, 800);
    return;
  }

  try {
    const res  = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    showStatus('✓ Uploaded successfully!', false);
    await loadMedia();
    setTimeout(() => { uploadStatus.hidden = true; }, 2500);
  } catch (err) {
    showStatus(`Upload failed: ${err.message}`, true);
  } finally {
    uploadBtn.disabled = false;
  }
});

// ── Logout ────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

// ── Status bar ────────────────────────────────────
function showStatus(msg, isError) {
  uploadStatus.hidden = false;
  uploadStatus.className = 'upload-status' + (isError ? ' error' : ' success');
  uploadStatus.textContent = msg;
  if (!isError) setTimeout(() => { uploadStatus.hidden = true; }, 3500);
}

// ── Folder datalist ───────────────────────────────
function updateFolderDatalist() {
  const folders = allFolderNames();
  folderOptions.innerHTML = folders.map(f => `<option value="${escHtml(f)}"></option>`).join('');
}

// ── Lightbox ──────────────────────────────────────
function openLightbox(idx) {
  lightboxIndex = idx;
  renderLightbox();
  lightbox.hidden = false;
}
function renderLightbox() {
  const item = visibleFlat[lightboxIndex];
  if (!item) return;
  lightboxContent.innerHTML = '';
  const el = item.type === 'video'
    ? Object.assign(document.createElement('video'), { controls: true, autoplay: true })
    : document.createElement('img');
  el.src = item.demoUrl || `/api/file/${item.id}`;
  lightboxContent.appendChild(el);
  lightboxCaption.textContent = item.caption || '';
  lightboxPrev.style.visibility = lightboxIndex > 0 ? 'visible' : 'hidden';
  lightboxNext.style.visibility = lightboxIndex < visibleFlat.length - 1 ? 'visible' : 'hidden';
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxContent.innerHTML = '';
  lightboxIndex = -1;
}
lightboxClose.onclick = closeLightbox;
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
lightboxPrev.onclick = () => { if (lightboxIndex > 0) { lightboxIndex--; renderLightbox(); } };
lightboxNext.onclick = () => { if (lightboxIndex < visibleFlat.length - 1) { lightboxIndex++; renderLightbox(); } };
document.addEventListener('keydown', e => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowLeft')   lightboxPrev.onclick();
  if (e.key === 'ArrowRight')  lightboxNext.onclick();
});
let touchStartX = null;
lightbox.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
lightbox.addEventListener('touchend',   e => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) (dx > 0 ? lightboxPrev : lightboxNext).onclick();
  touchStartX = null;
});

// ── Utilities ─────────────────────────────────────
function fileIcon(filename, mimetype) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'pdf')                       return '📕';
  if (['doc','docx'].includes(ext))        return '📘';
  if (['xls','xlsx','csv'].includes(ext))  return '📗';
  if (['ppt','pptx'].includes(ext))        return '📙';
  if (['zip','rar','7z'].includes(ext))    return '🗜️';
  if (['mp3','wav','aac'].includes(ext))   return '🎵';
  if (['txt','md'].includes(ext))          return '📄';
  if ((mimetype||'').startsWith('image/')) return '🖼️';
  return '📄';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ── Bootstrap ─────────────────────────────────────
setSection('gallery', 'All');
loadMedia();
setInterval(loadMedia, 15000);
