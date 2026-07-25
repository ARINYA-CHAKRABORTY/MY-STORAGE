const gridContainer = document.getElementById("grid-container");
const emptyState = document.getElementById("empty-state");
const filesContainer = document.getElementById("files-container");
const filesEmptyState = document.getElementById("files-empty-state");
const galleryView = document.getElementById("gallery-view");
const filesView = document.getElementById("files-view");
const tabGallery = document.getElementById("tab-gallery");
const tabFiles = document.getElementById("tab-files");
const frameCount = document.getElementById("frame-count");
const albumTabs = document.getElementById("album-tabs");

const fab = document.getElementById("fab");
const uploadModal = document.getElementById("upload-modal");
const uploadForm = document.getElementById("upload-form");
const modalCancel = document.getElementById("modal-cancel");
const fileInput = document.getElementById("file-input");
const fileLabel = document.getElementById("file-label");
const albumField = document.getElementById("album-field");
const albumSelect = document.getElementById("album-select");
const folderField = document.getElementById("folder-field");
const folderInput = document.getElementById("folder-input");
const folderOptions = document.getElementById("folder-options");
const captionInput = document.getElementById("caption-input");
const uploadBtn = document.getElementById("upload-btn");
const uploadStatus = document.getElementById("upload-status");

const lightbox = document.getElementById("lightbox");
const lightboxContent = document.getElementById("lightbox-content");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");

let items = [];
let section = "gallery"; // "gallery" | "files"
let activeAlbum = "All";
let activeFolder = "All";
let visibleFlat = []; // currently displayed gallery items, for lightbox prev/next
let lightboxIndex = -1;

function mediaItems() { return items.filter((i) => i.type === "photo" || i.type === "video"); }
function fileItems() { return items.filter((i) => i.type === "document"); }

let isDemoMode = false;

function getMockData() {
  return [
    {
      id: "demo1",
      type: "photo",
      fileId: "",
      album: "Camera",
      filename: "sunset.jpg",
      mimetype: "image/jpeg",
      sizeBytes: 1542000,
      caption: "Beautiful beach sunset",
      demoUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      width: 1200,
      height: 800,
      uploadedAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "demo2",
      type: "photo",
      fileId: "",
      album: "Camera",
      filename: "architecture.jpg",
      mimetype: "image/jpeg",
      sizeBytes: 2450000,
      caption: "Modern architectural design",
      demoUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      width: 1200,
      height: 800,
      uploadedAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: "demo3",
      type: "video",
      fileId: "",
      album: "WhatsApp Video",
      filename: "sea_waves.mp4",
      mimetype: "video/mp4",
      sizeBytes: 4500000,
      caption: "Relaxing ocean waves",
      demoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      width: 640,
      height: 360,
      uploadedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "demo4",
      type: "photo",
      fileId: "",
      album: "Screenshots",
      filename: "analytics.jpg",
      mimetype: "image/jpeg",
      sizeBytes: 520000,
      caption: "UI design and dashboard inspiration",
      demoUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
      width: 1200,
      height: 800,
      uploadedAt: new Date(Date.now() - 172800000).toISOString()
    },
    {
      id: "demo5",
      type: "document",
      fileId: "",
      album: "Documents",
      filename: "Project_Proposal.pdf",
      mimetype: "application/pdf",
      sizeBytes: 1250000,
      uploadedAt: new Date(Date.now() - 259200000).toISOString()
    },
    {
      id: "demo6",
      type: "document",
      fileId: "",
      album: "Downloads",
      filename: "Backup_Archive.zip",
      mimetype: "application/zip",
      sizeBytes: 38400000,
      uploadedAt: new Date(Date.now() - 604800000).toISOString()
    }
  ];
}

async function loadMedia() {
  try {
    const res = await fetch("/api/media");
    if (res.status === 401) { window.location.href = "/login.html"; return; }
    if (!res.ok) throw new Error("API failed");
    items = await res.json();
    isDemoMode = false;
  } catch (err) {
    if (!isDemoMode) {
      console.warn("Using mock data as server is not running or returned an error.");
      isDemoMode = true;
      items = getMockData();
    }
  }
  items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  renderAlbumTabs();
  renderGallery();
  renderFiles();
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
});

document.getElementById("backup-btn").addEventListener("click", () => {
  const ok = confirm(
    "This downloads every photo, video, and file as one zip - your own independent copy. " +
    "For a large archive it can take a while; keep this tab open until the download finishes."
  );
  if (ok) window.location.href = "/api/backup";
});

// --- section switching ---
function setSection(next) {
  section = next;
  tabGallery.classList.toggle("active", section === "gallery");
  tabFiles.classList.toggle("active", section === "files");
  galleryView.hidden = section !== "gallery";
  filesView.hidden = section !== "files";
  albumTabs.hidden = section !== "gallery";
  renderAlbumTabs();
}
tabGallery.onclick = () => setSection("gallery");
tabFiles.onclick = () => setSection("files");

// --- album/folder tab bar (shared element, different source depending on section) ---
function renderAlbumTabs() {
  if (section !== "gallery") return;
  const list = mediaItems();
  const albums = ["All", ...new Set(list.map((i) => i.album || "Uploads"))];
  if (!albums.includes(activeAlbum)) activeAlbum = "All";

  albumTabs.innerHTML = "";
  albums.forEach((album) => {
    const count = album === "All" ? list.length : list.filter((i) => (i.album || "Uploads") === album).length;
    const tab = document.createElement("button");
    tab.className = "album-tab" + (album === activeAlbum ? " active" : "");
    tab.textContent = `${album} (${count})`;
    tab.onclick = () => { activeAlbum = album; renderAlbumTabs(); renderGallery(); };
    albumTabs.appendChild(tab);
  });
}

// --- Google Photos-style date grouping (gallery only) ---
function dateHeaderLabel(date) {
  const now = new Date();
  const isSameDay = (a, b) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  const opts = { weekday: "long", month: "long", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString(undefined, opts);
}

function groupByDate(list) {
  const groups = [];
  let currentKey = null, currentGroup = null;
  list.forEach((item) => {
    const d = new Date(item.uploadedAt);
    const key = d.toDateString();
    if (key !== currentKey) {
      currentKey = key;
      currentGroup = { label: dateHeaderLabel(d), items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(item);
  });
  return groups;
}

function renderGallery() {
  const all = mediaItems();
  const visible = activeAlbum === "All" ? all : all.filter((i) => (i.album || "Uploads") === activeAlbum);
  visibleFlat = visible;

  gridContainer.innerHTML = "";
  if (section === "gallery") frameCount.textContent = `${visible.length} frame${visible.length === 1 ? "" : "s"}`;
  emptyState.hidden = visible.length > 0;

  let globalIdx = 0;
  groupByDate(visible).forEach((group) => {
    const sec = document.createElement("section");
    sec.className = "date-group";

    const header = document.createElement("h2");
    header.className = "date-header";
    header.textContent = group.label;
    sec.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "grid";

    group.items.forEach((item) => {
      const frame = document.createElement("div");
      frame.className = "frame";
      frame.style.animationDelay = `${Math.min(globalIdx, 24) * 15}ms`;

      const media = item.type === "video"
        ? Object.assign(document.createElement("video"), { muted: true, preload: "metadata" })
        : document.createElement("img");
      media.className = "frame-media";
      media.src = item.demoUrl || `/api/file/${item.id}`;
      media.loading = "lazy";
      frame.appendChild(media);

      if (item.type === "video") {
        const badge = document.createElement("span");
        badge.className = "video-badge";
        badge.textContent = item.compressed ? "VIDEO · compressed" : "VIDEO";
        frame.appendChild(badge);
      }

      const footer = document.createElement("div");
      footer.className = "frame-footer";
      const label = document.createElement("span");
      label.className = "frame-num";
      const time = new Date(item.uploadedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      label.textContent = activeAlbum === "All" ? (item.album || "Uploads") : time;
      const del = document.createElement("button");
      del.className = "frame-delete";
      del.textContent = "remove";
      del.title = "Remove from gallery (stays in Telegram)";
      del.onclick = (e) => { e.stopPropagation(); deleteItem(item.id); };
      footer.appendChild(label);
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

// --- files section: grouped by folder, not date ---
function fileIcon(filename, mimetype) {
  const ext = (filename || "").split(".").pop().toLowerCase();
  if (ext === "pdf") return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["txt", "md"].includes(ext)) return "📄";
  return "📄";
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderFiles() {
  const all = fileItems();
  filesEmptyState.hidden = all.length > 0;
  if (section === "files") frameCount.textContent = `${all.length} file${all.length === 1 ? "" : "s"}`;

  // keep the folder autocomplete list current
  const folders = [...new Set(all.map((i) => i.album || "General"))];
  folderOptions.innerHTML = folders.map((f) => `<option value="${f}"></option>`).join("");

  filesContainer.innerHTML = "";
  const groups = {};
  all.forEach((item) => {
    const folder = item.album || "General";
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(item);
  });

  Object.keys(groups).sort().forEach((folder) => {
    const sec = document.createElement("section");
    sec.className = "folder-group";

    const header = document.createElement("h2");
    header.className = "folder-header";
    header.textContent = `${folder} (${groups[folder].length})`;
    sec.appendChild(header);

    const list = document.createElement("div");
    list.className = "file-list";

    groups[folder].forEach((item) => {
      const row = document.createElement("div");
      row.className = "file-row";

      const icon = document.createElement("span");
      icon.className = "file-icon";
      icon.textContent = fileIcon(item.filename, item.mimetype);
      row.appendChild(icon);

      const meta = document.createElement("div");
      meta.className = "file-meta";
      const name = document.createElement("div");
      name.className = "file-name";
      name.textContent = item.filename || "Untitled file";
      const sub = document.createElement("div");
      sub.className = "file-sub";
      const date = new Date(item.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      sub.textContent = [formatBytes(item.sizeBytes), date].filter(Boolean).join(" · ");
      meta.appendChild(name);
      meta.appendChild(sub);
      row.appendChild(meta);

      const del = document.createElement("button");
      del.className = "file-delete";
      del.textContent = "remove";
      del.title = "Remove from list (stays in Telegram)";
      del.onclick = (e) => { e.stopPropagation(); deleteItem(item.id); };
      row.appendChild(del);

      row.onclick = () => window.open(item.demoUrl || `/api/file/${item.id}`, "_blank");
      list.appendChild(row);
    });

    sec.appendChild(list);
    filesContainer.appendChild(sec);
  });
}

async function deleteItem(id) {
  if (!confirm("Remove this from your archive list? (The file itself stays safe in Telegram.)")) return;
  if (isDemoMode) {
    items = items.filter((i) => i.id !== id);
    renderAlbumTabs();
    renderGallery();
    renderFiles();
    return;
  }
  await fetch(`/api/media/${id}`, { method: "DELETE" });
  await loadMedia();
}

// --- lightbox with prev/next (photos/videos only) ---
function openLightbox(index) {
  lightboxIndex = index;
  renderLightbox();
  lightbox.hidden = false;
}
function renderLightbox() {
  const item = visibleFlat[lightboxIndex];
  if (!item) return;
  lightboxContent.innerHTML = "";
  const el = item.type === "video"
    ? Object.assign(document.createElement("video"), { controls: true, autoplay: true })
    : document.createElement("img");
  el.src = item.demoUrl || `/api/file/${item.id}`;
  lightboxContent.appendChild(el);
  lightboxCaption.textContent = item.caption || "";
  lightboxPrev.style.visibility = lightboxIndex > 0 ? "visible" : "hidden";
  lightboxNext.style.visibility = lightboxIndex < visibleFlat.length - 1 ? "visible" : "hidden";
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxContent.innerHTML = "";
  lightboxIndex = -1;
}
lightboxClose.onclick = closeLightbox;
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
lightboxPrev.onclick = () => { if (lightboxIndex > 0) { lightboxIndex--; renderLightbox(); } };
lightboxNext.onclick = () => { if (lightboxIndex < visibleFlat.length - 1) { lightboxIndex++; renderLightbox(); } };
document.addEventListener("keydown", (e) => {
  if (lightbox.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") lightboxPrev.onclick();
  if (e.key === "ArrowRight") lightboxNext.onclick();
});
let touchStartX = null;
lightbox.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; });
lightbox.addEventListener("touchend", (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) (dx > 0 ? lightboxPrev : lightboxNext).onclick();
  touchStartX = null;
});

// --- upload modal (adapts fields based on the chosen file's type) ---
function openModal() { uploadModal.hidden = false; }
function closeModal() {
  uploadModal.hidden = true;
  uploadForm.reset();
  fileLabel.textContent = "Choose a photo, video, or document";
  albumField.hidden = false;
  folderField.hidden = true;
}
fab.onclick = openModal;
modalCancel.onclick = closeModal;
uploadModal.addEventListener("click", (e) => { if (e.target === uploadModal) closeModal(); });

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileLabel.textContent = file ? file.name : "Choose a photo, video, or document";
  if (!file) return;
  const isMedia = file.type.startsWith("image/") || file.type.startsWith("video/");
  albumField.hidden = !isMedia;
  folderField.hidden = isMedia;
});

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;
  const isMedia = file.type.startsWith("image/") || file.type.startsWith("video/");

  uploadBtn.disabled = true;
  uploadStatus.hidden = false;
  uploadStatus.className = "upload-status";
  uploadStatus.textContent = `Uploading ${file.name}…`;
  closeModal();

  const form = new FormData();
  form.append("file", file);
  form.append("album", isMedia ? albumSelect.value : (folderInput.value.trim() || "General"));
  form.append("caption", captionInput.value);

  if (isDemoMode) {
    setTimeout(() => {
      const demoUrl = URL.createObjectURL(file);
      const newEntry = {
        id: `demo-${Date.now()}`,
        type: file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "photo" : "document",
        fileId: "",
        album: isMedia ? albumSelect.value : (folderInput.value.trim() || "General"),
        filename: file.name,
        mimetype: file.type,
        sizeBytes: file.size,
        caption: captionInput.value,
        demoUrl: demoUrl,
        width: 800,
        height: 600,
        uploadedAt: new Date().toISOString()
      };
      items.unshift(newEntry);
      uploadStatus.textContent = "Uploaded (Demo Mode).";
      renderAlbumTabs();
      renderGallery();
      renderFiles();
      uploadBtn.disabled = false;
      setTimeout(() => { uploadStatus.hidden = true; }, 2000);
    }, 800);
    return;
  }

  try {
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");

    uploadStatus.textContent = "Uploaded.";
    await loadMedia();
    setTimeout(() => { uploadStatus.hidden = true; }, 2000);
  } catch (err) {
    uploadStatus.className = "upload-status error";
    uploadStatus.textContent = `Failed: ${err.message}`;
  } finally {
    uploadBtn.disabled = false;
  }
});

loadMedia();
// Pick up anything your phone backs up automatically in the background
setInterval(loadMedia, 15000);
