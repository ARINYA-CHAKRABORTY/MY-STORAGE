require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const cookieParser = require("cookie-parser");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const { readDb, writeDb, usingUpstash } = require("./storage");
const { ensureUnderLimit } = require("./compress");

// ── Concurrency guards ─────────────────────────────────────────────
// 1) Per-file in-flight lock: if two requests for the same filename+album
//    arrive at the same time (Termux retry, MacroDroid re-sync, etc.),
//    the second one waits for the first to finish and then sees it in the
//    DB, so it gets deduplicated instead of creating a duplicate.
const inflightUploads = new Map(); // key → Promise

// 2) DB write lock: serialises all readDb→mutate→writeDb sequences so
//    concurrent uploads can't overwrite each other (lost-write bug that
//    made some photos silently vanish from the gallery).
let dbLockChain = Promise.resolve();
function withDbLock(fn) {
  const next = dbLockChain.then(fn, fn); // always release even on error
  dbLockChain = next.catch(() => {});     // swallow so chain never rejects
  return next;
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
// Optional: a second private channel every upload gets mirrored into
// automatically, server-side, via Telegram's own copy - no re-download or
// local storage needed on your end.
const BACKUP_CHANNEL_ID = process.env.BACKUP_CHANNEL_ID;
const GALLERY_USER = process.env.GALLERY_USER;
const GALLERY_PASS = process.env.GALLERY_PASS;
// Falls back to something derived from your credentials if you don't set one -
// fine for a personal tool, but setting your own SESSION_SECRET is a bit safer.
const SESSION_SECRET = process.env.SESSION_SECRET || `${GALLERY_USER || "x"}:${GALLERY_PASS || "x"}:archive-fallback-secret`;
const PORT = process.env.PORT || 3000;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;
const TMP_DIR = path.join(__dirname, "tmp");

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error("Missing BOT_TOKEN or CHANNEL_ID. Copy .env.example to .env and fill it in.");
  process.exit(1);
}
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const app = express();
app.set("trust proxy", 1); // so secure cookies work correctly behind Render's proxy

app.use(cookieParser(SESSION_SECRET));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // login.html, app shell, css/js are not secret

if (!GALLERY_USER || !GALLERY_PASS) {
  console.warn(
    "GALLERY_USER / GALLERY_PASS are not set - the gallery has no login. " +
    "That's fine on localhost, but set them before deploying anywhere public."
  );
}

// --- browser login: sets a signed session cookie, no more basic-auth popup ---
app.post("/api/login", (req, res) => {
  if (!GALLERY_USER || !GALLERY_PASS) return res.json({ ok: true });
  const { username, password, remember } = req.body || {};
  if (username === GALLERY_USER && password === GALLERY_PASS) {
    res.cookie("archive_auth", "true", {
      signed: true,
      httpOnly: true,
      secure: req.secure,
      sameSite: "lax",
      ...(remember ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}) // 30 days, else a session cookie
    });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Wrong username or password" });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("archive_auth");
  res.json({ ok: true });
});

// --- keep-alive ping: no auth required, no processing, just wakes Render up ---
// MacroDroid calls this every 10 minutes so the server is always warm and ready.
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// --- everything under /api (except the two routes above) needs either the
// session cookie (browser, after logging in) or Basic Auth (MacroDroid's
// automated uploads, which can't use a login page) ---
app.use("/api", (req, res, next) => {
  if (!GALLERY_USER || !GALLERY_PASS) return next();
  if (req.signedCookies?.archive_auth === "true") return next();

  const header = req.headers.authorization || "";
  const [, encoded] = header.split(" ");
  if (encoded) {
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
    if (user === GALLERY_USER && pass === GALLERY_PASS) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Archive"');
  res.status(401).json({ error: "Not authenticated" });
});

// Files land on disk (not in memory) so a large original video before
// compression doesn't eat all the server's RAM. 300MB gives real headroom
// for phone videos that'll get compressed back down under Telegram's cap.
const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  }),
  limits: { fileSize: 300 * 1024 * 1024 }
});

// --- mirror a message into the backup channel, with no re-upload needed ---
// Telegram copies the file server-side; failures here are logged but never
// block the actual upload, since the primary copy already succeeded.
async function mirrorToBackupChannel(messageId) {
  if (!BACKUP_CHANNEL_ID) return;
  try {
    await axios.post(`${API}/copyMessage`, {
      chat_id: BACKUP_CHANNEL_ID,
      from_chat_id: CHANNEL_ID,
      message_id: messageId
    });
  } catch (err) {
    console.error("Backup channel mirror failed:", err.response?.data || err.message);
  }
}

// --- raw body parser middleware to handle simple uploads from MacroDroid without multipart ---
const rawBodyParser = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  
  if (contentType.includes("multipart/form-data")) {
    return upload.single("file")(req, res, next);
  }
  
  const isBinary = contentType.startsWith("image/") || 
                   contentType.startsWith("video/") || 
                   contentType.startsWith("audio/") ||
                   (contentType.startsWith("application/") &&
                    !contentType.includes("json") &&
                    !contentType.includes("x-www-form-urlencoded"));
                   
  if (!isBinary) {
    return next();
  }
  
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = path.join(TMP_DIR, filename);
  const writeStream = fs.createWriteStream(filePath);
  
  let sizeBytes = 0;
  req.on("data", (chunk) => {
    sizeBytes += chunk.length;
  });
  
  req.pipe(writeStream);
  
  writeStream.on("finish", () => {
    let originalname = `upload-${Date.now()}`;
    const disposition = req.headers["content-disposition"];
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match) originalname = match[1];
    } else {
      const ext = contentType.split("/")[1] || "bin";
      originalname = `${originalname}.${ext}`;
    }
    
    req.file = {
      path: filePath,
      originalname: originalname,
      mimetype: contentType,
      size: sizeBytes
    };
    next();
  });
  
  writeStream.on("error", (err) => {
    console.error("Raw body upload write error:", err);
    res.status(500).json({ error: "Failed to save raw upload" });
  });
};

// --- upload a photo or video straight to your private Telegram channel ---
app.post("/api/upload", rawBodyParser, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  const filename = req.file.originalname;
  const album = req.body?.album || req.query.album || "Uploads";
  const lockKey = `${album}::${filename}`;

  // ── Per-file concurrency gate ──────────────────────────────
  // If the same file is already being uploaded (Termux retry, slow
  // connection, MacroDroid re-sync), wait for the first request to
  // finish, then re-check the DB — the first one will have written
  // the entry, so this request becomes a harmless duplicate skip.
  if (inflightUploads.has(lockKey)) {
    console.log(`Waiting for in-flight upload to finish: ${lockKey}`);
    try { await inflightUploads.get(lockKey); } catch (_) { /* first failed, we'll retry */ }
  }

  // Create a deferred promise that other concurrent requests for the
  // same file can await.
  let resolveLock, rejectLock;
  const lockPromise = new Promise((res, rej) => { resolveLock = res; rejectLock = rej; });
  inflightUploads.set(lockKey, lockPromise);

  const cleanupPaths = [req.file.path];
  try {
    // ── Duplicate detection (pre-upload) ─────────────────────
    const existingItems = await readDb();
    const duplicate = existingItems.find(
      (i) => i.filename === filename && (i.album || "Uploads") === album
    );
    if (duplicate) {
      console.log(`Skipping duplicate: ${filename} (already in ${album})`);
      resolveLock();
      return res.json({ ok: true, duplicate: true, item: duplicate });
    }

    const isVideo = req.file.mimetype.startsWith("video/");
    const isImage = req.file.mimetype.startsWith("image/");
    const isDocument = !isVideo && !isImage;
    const method = isVideo ? "sendVideo" : isImage ? "sendPhoto" : "sendDocument";
    const fieldName = isVideo ? "video" : isImage ? "photo" : "document";

    let sendPath = req.file.path;
    let wasCompressed = false;
    if (isVideo) {
      const result = ensureUnderLimit(req.file.path); // throws if still too big
      sendPath = result.path;
      wasCompressed = result.wasCompressed;
      if (result.cleanupPath) cleanupPaths.push(result.cleanupPath);
    } else if (isDocument && req.file.size > 48 * 1024 * 1024) {
      throw new Error("File is too large (over 48MB). Documents aren't compressed - try splitting it or zipping it smaller.");
    }

    const form = new FormData();
    form.append("chat_id", CHANNEL_ID);
    form.append(fieldName, fs.createReadStream(sendPath), { filename: req.file.originalname });
    
    const caption = req.body?.caption || req.query.caption || "";
    if (caption) form.append("caption", caption);

    const tgRes = await axios.post(`${API}/${method}`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000 // 2 min timeout – generous for big files on mobile
    });

    const result = tgRes.data.result;
    let fileId, width, height, sizeBytes;

    if (isVideo) {
      fileId = result.video.file_id;
      width = result.video.width;
      height = result.video.height;
      sizeBytes = result.video.file_size;
    } else if (isImage) {
      const sizes = result.photo; // array, last = largest
      const largest = sizes[sizes.length - 1];
      fileId = largest.file_id;
      width = largest.width;
      height = largest.height;
      sizeBytes = largest.file_size;
    } else {
      fileId = result.document.file_id;
      sizeBytes = result.document.file_size;
    }

    // ── Atomic DB write (locked) ─────────────────────────────
    // Re-read the DB inside a lock to avoid lost writes when multiple
    // uploads finish at the same time, and re-check duplicates as a
    // safety net (belt-and-suspenders with the in-flight gate above).
    const entry = await withDbLock(async () => {
      const items = await readDb();

      // Re-check duplicate inside the lock — another request may have
      // finished and written this same file while we were uploading.
      const dup = items.find(
        (i) => i.filename === filename && (i.album || "Uploads") === album
      );
      if (dup) {
        console.log(`Post-upload duplicate caught: ${filename}`);
        return dup; // return existing entry, don't double-write
      }

      const newEntry = {
        id: `${result.message_id}`,
        type: isVideo ? "video" : isImage ? "photo" : "document",
        fileId,
        album,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        sizeBytes,
        caption,
        compressed: wasCompressed,
        width,
        height,
        uploadedAt: new Date().toISOString()
      };
      items.unshift(newEntry);
      await writeDb(items);
      return newEntry;
    });

    await mirrorToBackupChannel(result.message_id);
    resolveLock();
    res.json({ ok: true, item: entry });
  } catch (err) {
    rejectLock(err);
    console.error(err.response?.data || err.message);
    res.status(err.message?.includes("too large") ? 413 : 500).json({
      error: err.response?.data ? "Upload failed" : err.message,
      detail: err.response?.data
    });
  } finally {
    inflightUploads.delete(lockKey);
    for (const p of cleanupPaths) {
      fs.unlink(p, () => {}); // best-effort cleanup, ignore errors
    }
  }
});

// --- list everything in the gallery ---
app.get("/api/media", async (req, res) => {
  res.json(await readDb());
});

// --- delete an item from the gallery (only removes it from your list, not from Telegram) ---
app.delete("/api/media/:id", async (req, res) => {
  const items = (await readDb()).filter((i) => i.id !== req.params.id);
  await writeDb(items);
  res.json({ ok: true });
});

// --- stream the actual photo/video bytes from Telegram on demand ---
app.get("/api/file/:id", async (req, res) => {
  try {
    const items = await readDb();
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).send("Not found");

    // file_path can expire, so we ask Telegram for a fresh one every time
    const fileInfo = await axios.get(`${API}/getFile`, { params: { file_id: item.fileId } });
    const filePath = fileInfo.data.result.file_path;

    const fileRes = await axios.get(`${FILE_API}/${filePath}`, { responseType: "stream" });
    const contentType = item.mimetype || (item.type === "video" ? "video/mp4" : "image/jpeg");
    res.setHeader("Content-Type", contentType);
    if (item.filename) {
      res.setHeader("Content-Disposition", `inline; filename="${item.filename.replace(/"/g, "")}"`);
    }
    fileRes.data.pipe(res);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Failed to fetch file");
  }
});

// --- download everything as one zip, your own independent copy ---
function backupEntryName(item) {
  const folder = (item.album || "Uploads").replace(/[/\\]/g, "-");
  let filename = item.filename;
  if (!filename) {
    const ext = item.type === "video" ? "mp4" : item.type === "photo" ? "jpg" : "bin";
    filename = `${item.id}.${ext}`;
  }
  return `${folder}/${filename}`;
}

// Fetches one file from Telegram and appends it, waiting for the stream to
// fully drain into the archive before moving on - keeps memory flat and
// avoids opening a pile of concurrent connections to Telegram at once.
function appendToArchive(archive, item) {
  return new Promise(async (resolve) => {
    try {
      const fileInfo = await axios.get(`${API}/getFile`, { params: { file_id: item.fileId } });
      const filePath = fileInfo.data.result.file_path;
      const fileRes = await axios.get(`${FILE_API}/${filePath}`, { responseType: "stream" });
      fileRes.data.on("end", resolve);
      fileRes.data.on("error", (err) => {
        console.error(`Backup: skipping ${item.id} (${err.message})`);
        resolve();
      });
      archive.append(fileRes.data, { name: backupEntryName(item) });
    } catch (err) {
      console.error(`Backup: skipping ${item.id} (${err.message})`);
      resolve(); // one bad file shouldn't stop the whole backup
    }
  });
}

app.get("/api/backup", async (req, res) => {
  const excludeVideos = req.query.excludeVideos === "true";
  let items = await readDb();
  // Filter out video items if requested
  if (excludeVideos) items = items.filter(i => i.type !== "video");
  // Skip folder marker items (no real file to download)
  items = items.filter(i => i.type !== "folder" && i.fileId);

  const filename = `archive-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const archive = archiver("zip", { zlib: { level: 0 } }); // media's already compressed, skip re-zipping it
  archive.on("error", (err) => {
    console.error("Backup archive error:", err.message);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  for (const item of items) {
    await appendToArchive(archive, item);
  }
  await archive.finalize();
});

// --- create an empty folder marker (lightweight; no Telegram upload needed) ---
app.post("/api/folders", async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Folder name is required" });
  const items = await readDb();
  // Avoid duplicate folder names
  if (items.some(i => i.type === "folder" && i.album === name)) {
    return res.status(409).json({ error: "A folder with that name already exists" });
  }
  const entry = {
    id: `folder-${Date.now()}`,
    type: "folder",
    album: name,
    uploadedAt: new Date().toISOString()
  };
  items.unshift(entry);
  await writeDb(items);
  res.json({ ok: true, folder: entry });
});

app.listen(PORT, () => {
  console.log(`Gallery running at http://localhost:${PORT}`);
  console.log(`Storage backend: ${usingUpstash ? "Upstash Redis (persistent)" : "local file (data/db.json)"}`);
});
