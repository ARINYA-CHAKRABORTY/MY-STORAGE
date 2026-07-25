const fs = require("fs");
const path = require("path");
const axios = require("axios");

const DB_PATH = path.join(__dirname, "data", "db.json");
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "gallery_items";

const usingUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// Free hosts like Render wipe local files whenever the server restarts or
// wakes from sleep. Upstash Redis's free tier persists forever, so we use it
// automatically when its env vars are present (i.e. once deployed), and fall
// back to the plain local file for everyday localhost use.

async function readDb() {
  if (usingUpstash) {
    const res = await axios.get(`${UPSTASH_URL}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const raw = res.data.result;
    return raw ? JSON.parse(raw) : [];
  }
  if (!fs.existsSync(DB_PATH)) return [];
  const raw = fs.readFileSync(DB_PATH, "utf8").trim();
  return raw ? JSON.parse(raw) : [];
}

async function writeDb(items) {
  if (usingUpstash) {
    await axios.post(`${UPSTASH_URL}/set/${KEY}`, JSON.stringify(items), {
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "text/plain"
      }
    });
    return;
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(items, null, 2));
}

module.exports = { readDb, writeDb, usingUpstash };
