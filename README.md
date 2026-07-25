# Archive — a personal photo/video gallery backed by Telegram

Your files live in a private Telegram channel (free, effectively unlimited storage).
This app is a window onto them: a small website that uploads to that channel and
streams things back so you can view them without keeping copies on your phone.

It can run two ways:
- **Locally**, on your own computer only (`localhost`).
- **Deployed**, so you can open it from your phone anywhere, even on cellular data.

These instructions cover both. Do the local setup first to make sure everything
works, then deploy.

---

## Part 1 — Local setup

### 1. Create your Telegram bot
1. Open Telegram, search for **@BotFather**, start a chat.
2. Send `/newbot`, follow the prompts.
3. Save the **token** it gives you (looks like `123456789:AAExample...`).

### 2. Create a private channel for storage
1. Create a new Telegram channel, set it to **Private**.
2. Add your bot as an **admin** (Channel settings → Administrators → Add Admin).
3. Get the channel's numeric **chat ID** (`-100...`): post any message in the
   channel, forward it to **@userinfobot**, and it'll show you the ID.

### 3. Install and configure
You need [Node.js](https://nodejs.org) v18+.

```bash
cd telegram-gallery
npm install
cp .env.example .env
```

Fill in `.env` with your `BOT_TOKEN` and `CHANNEL_ID`. Leave `GALLERY_USER`,
`GALLERY_PASS`, and the `UPSTASH_*` values blank for now — they're only needed
once you deploy.

### 4. Run it
```bash
npm start
```
Open **http://localhost:3000**. Upload a photo to test, then click it to view
full-size. Once it's confirmed working, move to Part 2.

---

## Part 2 — Deploying so your phone can reach it anywhere

Two things change once this is public: it needs a **login** (otherwise anyone
with the link could see or upload to your gallery), and it needs **storage that
survives restarts** (the free hosting tier wipes local files whenever the
server sleeps or redeploys — a plain `data/db.json` won't stick around).

### 1. Set a login
In `.env` (and later in your host's dashboard), set:
```
GALLERY_USER=yourname
GALLERY_PASS=choose-a-real-password
```
Opening the site for the first time takes you to a proper sign-in page
(not a browser popup). Check "Keep me signed in" to stay logged in for 30
days; leave it unchecked to be signed out when you close the browser.
There's a **Sign out** button in the top bar whenever you want to end the
session early.

MacroDroid's automated uploads (Part 3 in `GETTING_STARTED.md`) keep using
plain Basic Auth with the same username/password, since an automation tool
can't click through a login page — nothing changes there.

### 2. Set up free persistent storage (Upstash Redis)
1. Go to [console.upstash.com](https://console.upstash.com), sign up free.
2. Create a database (any region close to you).
3. On the database page, find the **REST API** section — copy the
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` values.
4. Put both into `.env`. The app automatically switches from the local file to
   Upstash whenever these are present — no code changes needed.

### 3. Push the project to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
```
Create a new **private** repo on GitHub and push this to it. (`.env` is
already excluded via `.gitignore`, so your secrets won't be uploaded.)

### 4. Deploy on Render (free tier)
1. Go to [render.com](https://render.com), sign up, click **New → Web Service**.
2. Connect your GitHub repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Under **Environment**, add: `BOT_TOKEN`, `CHANNEL_ID`, `GALLERY_USER`,
   `GALLERY_PASS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and
   optionally `SESSION_SECRET` (any random string - safe to skip).
   (Don't set `PORT` — Render sets it automatically.)
5. Click **Deploy**. After a couple of minutes you'll get a URL like
   `https://your-app.onrender.com`.

### 5. Open it on your phone
Visit that URL in your phone's browser — you'll land on the sign-in page.
Log in with `GALLERY_USER`/`GALLERY_PASS`, tick "Keep me signed in" if you
want. To make it feel more like an app: in Safari or Chrome, use
**Share → Add to Home Screen** — it'll open full-screen without browser chrome.

**Note on the free tier:** Render's free web services fall asleep after ~15
minutes of no traffic, so the first load after a while takes 30–50 seconds to
wake up. Totally fine for personal use, just not instant.

---

## Part 3 — Automatic backup with folders (Android)

The gallery now supports **albums**, so it can mirror your phone's folder
structure — Camera, Screenshots, WhatsApp Images, WhatsApp Video, Downloads —
instead of dumping everything into one pile. Each upload carries an `album`
field; the site groups things into tabs automatically.

### Set up one MacroDroid macro per folder
Repeat the MacroDroid steps from before, once per folder you want backed up.
The only two things that change each time are the **watched folder** and the
**`album` value** in the form data:

| Folder to watch | `album` value to send |
|---|---|
| `DCIM/Camera` | `Camera` |
| `Pictures/Screenshots` | `Screenshots` |
| `Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images` | `WhatsApp Images` |
| `Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video` | `WhatsApp Video` |
| `Download` | `Downloads` |

(On older Android/WhatsApp versions the WhatsApp folder is instead at
`WhatsApp/Media/WhatsApp Images` directly under storage root — check which one
exists on your phone.)

In each macro's HTTP Request action, add an extra multipart form field named
`album` with the value from the table above, alongside the `file` field.
MacroDroid will ask for **All files access** to watch folders outside DCIM —
grant it, or the WhatsApp/Downloads triggers won't fire.

### Viewing your photos
Nothing extra to do — open your deployed URL, log in once, and it's all there,
sorted into tabs by folder. The site quietly re-checks for new uploads every
15 seconds while it's open, so anything your phone backs up in the background
shows up on its own.

### When it's safe to delete from your phone
Only delete an original once you've **seen it appear in the web gallery** —
that's your confirmation the file actually made it to Telegram, not just that
MacroDroid tried. Two tips to make this reliable:
- Don't delete in a rush right after taking a photo — give it a few seconds
  for the macro to fire and the upload to finish.
- In MacroDroid, add a second action on the same macro: **"Show
  Notification"** if the HTTP request fails, so a failed backup doesn't
  silently disappear. Without that, the only sign of a failure is the photo
  never showing up in the gallery.

If you want extra peace of mind, only turn on auto-delete (e.g. a "clean
Camera folder" macro) for photos older than a day or two — that guarantees
they've had time to be confirmed.

## Files (documents)
Besides photos and videos, you can upload any other file — Word docs, PDFs,
spreadsheets, zips — the same way. Tap **+**, choose the file; the modal
automatically switches from an "Album" field to a "Folder" field once it
sees you've picked a non-photo/video file. Type any folder name (new or
existing) to sort it. Switch to the **Files** tab up top to browse by folder.

Opening a file lets your browser handle it: PDFs and images preview inline
in a new tab, but most other formats (like .docx) will download instead,
since browsers don't have a built-in Word viewer. That's a browser
limitation, not something the app can work around.

Documents aren't compressed (only video is) — the same 48MB practical cap
applies, so very large files should be zipped or split first.

## Backing up off a single channel
A single Telegram channel is still one point of failure. The most
practical fix, if you don't have spare device storage to download to,
is a **second private channel that every upload mirrors into
automatically** — no re-upload, no local storage, it's a server-side copy
on Telegram's end.

### Set it up
1. Create another private Telegram channel (same steps as your main one —
   see `GETTING_STARTED.md` Part 1.3), name it something like
   `Archive Backup`.
2. Add your same bot as admin there too.
3. Get its chat ID the same way (forward a message to @userinfobot).
4. Set `BACKUP_CHANNEL_ID` to that value, locally in `.env` or in Render's
   environment variables.

From then on, every upload — manual or from MacroDroid — lands in your
main channel and is instantly copied into the backup channel too, with no
extra bandwidth or waiting since Telegram does the copy itself.

**Worth knowing:** both channels are still on the same Telegram account, so
this protects you against accidentally deleting/losing one channel, but
not against your whole account being compromised — that's what Two-Step
Verification (Settings → Privacy and Security) is for, and is still worth
turning on regardless.

If you *do* ever have spare storage and want a copy off Telegram entirely,
the **⤓ Backup** button in the top bar still works — it downloads
everything as one zip, organized the same way as the site.

## Using it day to day
- Photos and videos are grouped by the day they were backed up — "Today",
  "Yesterday", then full dates — same as a normal phone gallery, within
  whichever album tab you have selected.
- **+ add frame** → pick a photo/video, optional caption, upload. It goes to
  your Telegram channel; only a tiny reference is stored elsewhere.
- Tap a thumbnail to view full-size, no download.
- **remove** takes it out of your gallery view only — the file stays safe in
  the Telegram channel, so nothing is ever destructively deleted from here.
- Once something's in the gallery, it's safe to delete from your camera roll.

## Automatic video compression
Videos over ~48MB are compressed automatically on the server before being
sent to Telegram — no action needed on your end, and it applies equally to
manual uploads and phone auto-backups. It tries 720p first, then 480p, then
360p, stopping at the first one that fits under the cap. Anything already
under the cap is sent untouched, at full quality.

**Worth knowing:**
- Compression uses real CPU on the server. On Render's free tier (shared,
  limited CPU) a long or high-resolution video can take a while — for very
  long clips it may be worth trimming them first rather than waiting it out.
- If even 360p can't get under 48MB (very long videos), the upload is
  rejected with an error asking you to trim it — nothing silently fails.
- Compressed videos are marked with a small "compressed" tag in the gallery,
  so you always know which ones weren't backed up at original quality.

## Limits to know about
- Telegram's Bot API caps uploads at **50 MB per file** — compress larger
  videos first, or send them into the channel manually from the Telegram app.
- Upstash's free tier (10,000 commands/day) is far more than personal use
  needs.
