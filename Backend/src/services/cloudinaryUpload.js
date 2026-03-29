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
 * @returns {Promise<{url:string, publicId:string, resourceType:string, format:string, bytes:number}>}
 */
function uploadBuffer(buffer, mimetype) {
  ensureConfigured();
  const isVideo = String(mimetype || "").toLowerCase().startsWith("video/");
  const resourceType = isVideo ? "video" : "image";

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "dmews/incidents",
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

module.exports = {
  isCloudinaryConfigured,
  uploadBuffer,
};

