/**
 * Encrypted storage for victim scan photos on the backend's own disk.
 *
 * - Photos are resized (max 1600px) and encrypted with AES-256-GCM before
 *   they touch the disk; nothing is uploaded to a public host.
 * - Key: SCAN_PHOTO_KEY (64 hex chars) in Backend/.env. If unset, a random key
 *   is created once at storage/scan-photos/.key (owner-only permissions).
 *   Losing the key makes stored photos unreadable.
 * - Location: SCAN_PHOTO_DIR, default Backend/storage/scan-photos/<scanId>/<n>.enc
 */
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(process.env.SCAN_PHOTO_DIR || path.join(__dirname, "../../storage/scan-photos"));
const KEY_FILE = path.join(ROOT, ".key");
const MAX_EDGE = 1600;

let keyPromise = null;

async function getKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      const fromEnv = String(process.env.SCAN_PHOTO_KEY || "").trim();
      if (fromEnv) {
        const key = Buffer.from(fromEnv, "hex");
        if (key.length !== 32) throw new Error("SCAN_PHOTO_KEY must be 64 hex characters (32 bytes).");
        return key;
      }
      await fs.mkdir(ROOT, { recursive: true, mode: 0o700 });
      try {
        return Buffer.from((await fs.readFile(KEY_FILE, "utf8")).trim(), "hex");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        const key = crypto.randomBytes(32);
        await fs.writeFile(KEY_FILE, key.toString("hex"), { mode: 0o600, flag: "wx" });
        return key;
      }
    })();
    keyPromise.catch(() => { keyPromise = null; });
  }
  return keyPromise;
}

function scanDir(scanId) {
  const id = String(scanId);
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error("Invalid scan id.");
  return path.join(ROOT, id);
}

/** File layout: 12-byte IV | 16-byte auth tag | ciphertext. */
async function encrypt(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", await getKey(), iv);
  const body = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

async function decrypt(buffer) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", await getKey(), buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
}

/**
 * @param {string} scanId
 * @param {Array<{buffer: Buffer}>} images
 * @returns {Promise<Array<{index: number, mimetype: string, bytes: number, storedAt: Date}>>}
 */
async function savePhotos(scanId, images) {
  const dir = scanDir(scanId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const saved = [];
  for (const [index, image] of images.entries()) {
    const jpeg = await sharp(image.buffer)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    await fs.writeFile(path.join(dir, `${index}.enc`), await encrypt(jpeg), { mode: 0o600 });
    saved.push({ index, mimetype: "image/jpeg", bytes: jpeg.length, storedAt: new Date() });
  }
  return saved;
}

/** Decrypted JPEG bytes, or null when the photo no longer exists. */
async function readPhoto(scanId, index) {
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0 || n > 20) return null;
  try {
    return await decrypt(await fs.readFile(path.join(scanDir(scanId), `${n}.enc`)));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function deletePhotos(scanId) {
  await fs.rm(scanDir(scanId), { recursive: true, force: true });
}

module.exports = { savePhotos, readPhoto, deletePhotos, PHOTO_ROOT: ROOT };
