# Getting started — from zero

This walks through every account and step needed, assuming you're starting
completely fresh. Do these in order.

---

## Part 1 — Telegram: your storage

### 1.1 Get the Telegram app (skip if you already use it)
1. Open the Play Store on your phone.
2. Search **Telegram**, install it, open it.
3. Enter your phone number, tap **Next**.
4. Telegram sends you a code by SMS (or through another Telegram app if
   you're logged in elsewhere) — type it in.
5. Set a name/profile photo if it asks — optional, skip if you want.

### 1.2 Create your bot
1. In Telegram, tap the search icon (magnifying glass) at the top.
2. Type **BotFather** — the official one has a blue verified checkmark.
3. Tap it, then tap **Start** at the bottom.
4. Send the message: `/newbot`
5. BotFather asks for a **name** — this is just the display name, e.g.
   `My Archive Bot`. Type it and send.
6. BotFather asks for a **username** — must be unique and end in `bot`,
   e.g. `myarchive_storage_bot`. Type it and send.
7. BotFather replies with a message containing a long token that looks like:
   `123456789:AAExampleTokenxxxxxxxxxxxxxxxxxxxxx`
   **Copy this and save it somewhere safe** (e.g. a notes app) — this is
   your `BOT_TOKEN`. Don't share it publicly; anyone with it can control
   your bot.

### 1.3 Create your private storage channel
1. In Telegram, tap the pencil/edit icon (usually bottom-right) → **New Channel**.
2. Give it any name, e.g. `My Personal Archive`.
3. On the next screen, choose **Private Channel**.
4. Skip adding members for now — tap the arrow/checkmark to finish creating it.

### 1.4 Add your bot as an admin of that channel
1. Open the channel you just made.
2. Tap the channel name at the top → **Administrators** (or the "..." menu → Manage Channel → Administrators).
3. Tap **Add Admin**.
4. Search for your bot by the username you gave it in step 1.2.
5. Select it, leave the default admin permissions as they are, confirm.

### 1.5 Get the channel's numeric ID
1. Post any message in the channel (e.g. "test").
2. Tap and hold that message → **Forward**.
3. In the search box, type **userinfobot** and select it, then send the forward.
4. It replies with details including a `Chat ID` — a negative number like
   `-1001234567890`. **Save this** — it's your `CHANNEL_ID`.

You now have both values the app needs: `BOT_TOKEN` and `CHANNEL_ID`.

### 1.6 (Optional but recommended) Create a backup channel too
This gives you a second, independent copy of everything with zero extra
effort per upload — worth doing.
1. Repeat steps 1.3-1.5: create another new **private** channel (e.g.
   `Archive Backup`), add your same bot as admin, and get its chat ID.
2. Save that as `BACKUP_CHANNEL_ID`. You'll add it to `.env` in step 2.3
   and to Render's environment variables in step 3.4.

From here on, every photo/video/document you upload automatically gets
copied into this channel too, at no extra bandwidth cost — Telegram does
the copying on its own servers.

---

## Part 2 — Get the project running locally (recommended first, to test)

### 2.1 Install Node.js on your computer
1. Go to **nodejs.org** in a browser.
2. Download the **LTS** version for your operating system.
3. Run the installer, click through with defaults.
4. Confirm it worked: open a terminal (Command Prompt/PowerShell on
   Windows, Terminal on Mac) and type `node -v` — it should print a
   version number like `v20.x.x`.

### 2.2 Unzip the project
1. Unzip the `telegram-gallery.zip` file I gave you, anywhere convenient
   (e.g. your Documents folder).

### 2.3 Install dependencies and configure
In your terminal:
```bash
cd path/to/telegram-gallery
npm install
cp .env.example .env
```
(On Windows Command Prompt, use `copy .env.example .env` instead of `cp`.)

Open the new `.env` file in any text editor and fill in:
```
BOT_TOKEN=the token from step 1.2
CHANNEL_ID=the number from step 1.5
BACKUP_CHANNEL_ID=the number from step 1.6, if you set one up (optional)
```
Leave `GALLERY_USER`, `GALLERY_PASS`, and the `UPSTASH_*` lines blank for now.

### 2.4 Run it
```bash
npm start
```
Open **http://localhost:3000** in your browser. Try uploading a test photo.
If it appears in the gallery, everything so far is working.

---

## Part 3 — Put it online so your phone can reach it anywhere

### 3.1 Create a GitHub account
1. Go to **github.com** → **Sign up**.
2. Enter an email, password, and username, verify your email.

### 3.2 Create a private repository and push your code
Still in your terminal, inside the `telegram-gallery` folder:
```bash
git init
git add .
git commit -m "Initial commit"
```
On GitHub: click the **+** icon (top right) → **New repository** → name it
`telegram-gallery` → set visibility to **Private** → **Create repository**.
GitHub then shows you commands like these — run them in your terminal:
```bash
git remote add origin https://github.com/YOUR_USERNAME/telegram-gallery.git
git branch -M main
git push -u origin main
```
(It'll prompt you to log in the first time — follow its instructions, it
may open a browser window to confirm.)

### 3.3 Create a free Upstash Redis database (keeps your gallery list from disappearing)
1. Go to **console.upstash.com** → sign up (you can use your GitHub account
   to sign up faster).
2. Click **Create Database**.
3. Give it any name, pick a region close to you, leave other settings
   default, click **Create**.
4. On the database's page, scroll to the **REST API** section.
5. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` values
   — save them for the next step.

### 3.4 Deploy on Render
1. Go to **render.com** → sign up (again, GitHub sign-up is fastest, and
   it'll let Render see your repos).
2. Click **New** → **Web Service**.
3. Choose **Build and deploy from a Git repository**, find and select your
   `telegram-gallery` repo, click **Connect**.
4. Fill in:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - Leave the plan on **Free**.
5. Scroll to **Environment Variables**, add each of these (click "Add
   Environment Variable" for each):
   - `BOT_TOKEN` → your bot token
   - `CHANNEL_ID` → your channel ID
   - `BACKUP_CHANNEL_ID` → your backup channel's ID, if you set one up (optional)
   - `GALLERY_USER` → pick any username, e.g. `me`
   - `GALLERY_PASS` → pick a real password
   - `UPSTASH_REDIS_REST_URL` → from step 3.3
   - `UPSTASH_REDIS_REST_TOKEN` → from step 3.3
   - `SESSION_SECRET` → optional, any random string (safe to skip)
   (Don't add `PORT` — Render sets that automatically.)
6. Click **Create Web Service**. Wait a couple of minutes while it builds.
7. Once it says "Live", you'll see a URL at the top like
   `https://telegram-gallery-xxxx.onrender.com` — that's your permanent
   address, reachable from any phone, anywhere.

### 3.5 Open it on your phone
1. Open that URL in your phone's browser — you'll land on a sign-in page.
2. Enter the `GALLERY_USER` / `GALLERY_PASS` you set in step 3.4. Tick
   "Keep me signed in" to stay logged in for 30 days instead of just until
   you close the browser.
3. Optional: tap **Share** → **Add to Home Screen** so it opens like an app.

**Note:** Render's free tier sleeps after ~15 minutes with no visits, so
the very first open after a while takes 30-50 seconds to wake up. Normal,
not a bug.

---

## Part 4 — Automatic backup from your Android camera/WhatsApp folders

### 4.1 Install MacroDroid
1. Play Store → search **MacroDroid** → install → open it.
2. Grant the permissions it asks for on first launch (notifications,
   accessibility, etc.) — these are needed for it to watch folders reliably.
3. Also go to Android **Settings → Battery → Battery Optimization**, find
   MacroDroid, and set it to **Not optimized** — otherwise Android may kill
   it in the background and backups silently stop.

### 4.2 Create one macro per folder you want auto-backed-up
Repeat this for each row below. In MacroDroid:
1. Tap **+** to add a new macro.
2. **Trigger** → *Connectivity* category → **File/Folder Modified** →
   browse to the folder from the table.
3. **Action** → add a **Wait** action, 2-3 seconds (lets the file finish writing).
4. Add another **Action** → *Connectivity* → **HTTP Request**:
   - Method: `POST`
   - URL: `https://your-app.onrender.com/api/upload` (use your real Render URL)
   - Authentication: Basic — enter your `GALLERY_USER` / `GALLERY_PASS`
     (this is different from the sign-in page you use in a browser —
     automated requests like this one still use plain Basic Auth, which
     the server accepts alongside the login page)
   - Body type: **Multipart/Form-data**
   - Add a field named `file`, value = the trigger's file path variable
   - Add a field named `album`, value = the text from the table below
5. Save, name the macro, enable it.

| Folder to watch | `album` value |
|---|---|
| `DCIM/Camera` | `Camera` |
| `Pictures/Screenshots` | `Screenshots` |
| `Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images` | `WhatsApp Images` |
| `Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video` | `WhatsApp Video` |
| `Download` | `Downloads` |

(Check your Files app to confirm the exact WhatsApp path on your phone —
it varies slightly by Android/WhatsApp version.)

### 4.3 Confirm it's working
Take a photo, wait about 10-15 seconds, open your gallery URL — it should
appear on its own. Only delete originals from your phone once you've seen
them show up here.

---

## Everything after this point
You're done with setup. From here it's just normal use: tap **+** to upload
manually (photos/videos/documents), browse by album/folder, tap to view.
See `README.md` for day-to-day details and known limits.
