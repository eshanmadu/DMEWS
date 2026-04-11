const { v2: cloudinary } = require("cloudinary");

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function ensureConfigured() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {{ folder?: string }} [options]
 * @returns {Promise<{url:string, publicId:string, resourceType:string, format:string, bytes:number}>}
 */
function uploadBuffer(buffer, mimetype, options = {}) {
  ensureConfigured();
  const isVideo = String(mimetype || "").toLowerCase().startsWith("video/");
  const resourceType = isVideo ? "video" : "image";
  const folder = options.folder || "dmews/incidents";

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result?.secure_url || result?.url,
          publicId: result?.public_id || "",
          resourceType: result?.resource_type || resourceType,
          format: result?.format || "",
          bytes: result?.bytes || 0,
        });
      }
    );
    upload.end(buffer);
  });
}

/**
 * Best-effort delete by Cloudinary public_id (image).
 * @param {string} publicId
 */
async function destroyPublicId(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return;
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(String(publicId), { resource_type: "image" });
  } catch (e) {
    console.warn("Cloudinary destroy failed", publicId, e?.message || e);
  }
}

/**
 * Destroy uploaded incident (or other) media — images vs video use different resource_type.
 */
async function destroyMediaPublicId(publicId, resourceType) {
  if (!publicId || !isCloudinaryConfigured()) return;
  ensureConfigured();
  const rt = String(resourceType || "").toLowerCase() === "video" ? "video" : "image";
  try {
    await cloudinary.uploader.destroy(String(publicId), { resource_type: rt });
  } catch (e) {
    console.warn("Cloudinary destroy failed", publicId, rt, e?.message || e);
  }
}

module.exports = {
  isCloudinaryConfigured,
  uploadBuffer,
  destroyPublicId,
  destroyMediaPublicId,
};

