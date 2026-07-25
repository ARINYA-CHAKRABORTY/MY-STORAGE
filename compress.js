const { spawnSync } = require("child_process");
const fs = require("fs");
const ffmpegPath = require("ffmpeg-static");

// Telegram's Bot API upload ceiling. We leave a little headroom under the
// real 50MB limit since container/multipart overhead eats a small amount.
const MAX_UPLOAD_BYTES = 48 * 1024 * 1024;

// Each attempt trades quality for size. We stop at the first one that fits.
const ATTEMPTS = [
  { label: "720p", height: 720, crf: 26 },
  { label: "480p", height: 480, crf: 30 },
  { label: "360p", height: 360, crf: 32 }
];

function runFfmpeg(inputPath, outputPath, { height, crf }) {
  const args = [
    "-y",
    "-i", inputPath,
    "-vf", `scale=-2:${height}`,
    "-c:v", "libx264",
    "-crf", String(crf),
    "-preset", "veryfast",
    "-c:a", "aac",
    "-b:a", "128k",
    outputPath
  ];
  const result = spawnSync(ffmpegPath, args, { stdio: "ignore" });
  return result.status === 0 && fs.existsSync(outputPath);
}

// Compresses inputPath if needed. Returns { path, wasCompressed } — the path
// to actually send to Telegram, and whether it differs from the original.
// Throws if even the smallest attempt is still too big.
function ensureUnderLimit(inputPath) {
  const size = fs.statSync(inputPath).size;
  if (size <= MAX_UPLOAD_BYTES) {
    return { path: inputPath, wasCompressed: false };
  }

  for (const attempt of ATTEMPTS) {
    const outputPath = `${inputPath}.${attempt.label}.mp4`;
    const ok = runFfmpeg(inputPath, outputPath, attempt);
    if (ok) {
      const outSize = fs.statSync(outputPath).size;
      if (outSize <= MAX_UPLOAD_BYTES) {
        return { path: outputPath, wasCompressed: true, cleanupPath: outputPath };
      }
      fs.unlinkSync(outputPath); // didn't fit, try the next, smaller attempt
    }
  }

  throw new Error(
    "Video is too large even after compression. Try trimming it or shortening it before uploading."
  );
}

module.exports = { ensureUnderLimit, MAX_UPLOAD_BYTES };
