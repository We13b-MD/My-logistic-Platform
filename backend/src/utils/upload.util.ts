import fs from "fs";
import path from "path";
import crypto from "crypto";
import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary";

/**
 * Uploads a base64 image (data URL or raw base64) to Cloudinary or falls back to local disk.
 * @param base64Data Base64 encoded image string (e.g., 'data:image/png;base64,...')
 * @param subFolder Subfolder name (e.g., 'photos' or 'signatures')
 * @returns Public HTTP/HTTPS URL of the uploaded image
 */
export async function uploadToCloudStorage(
  base64Data: string,
  subFolder: "photos" | "signatures" = "photos"
): Promise<string> {
  if (!base64Data || typeof base64Data !== "string") {
    throw new Error("Invalid base64 image data provided");
  }

  // 1. If Cloudinary is configured, upload directly to Cloudinary CDN
  if (isCloudinaryConfigured) {
    try {
      const uploadResult = await cloudinary.uploader.upload(base64Data, {
        folder: `logistel/pod/${subFolder}`,
        resource_type: "image",
        transformation: [
          { quality: "auto:good", fetch_format: "auto" }
        ],
      });
      return uploadResult.secure_url;
    } catch (error: any) {
      console.error("Cloudinary upload failed, using local disk fallback:", error?.message || error);
    }
  }

  // 2. Fallback to Local Disk Storage (/uploads/pod/photos or /uploads/pod/signatures)
  const uploadsDir = path.join(__dirname, "../../../uploads/pod", subFolder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Extract base64 payload
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let imageBuffer: Buffer;
  let fileExt = "png";

  if (matches && matches.length === 3) {
    const mimeType = matches[1];
    fileExt = mimeType.split("/")[1] || "png";
    imageBuffer = Buffer.from(matches[2], "base64");
  } else {
    imageBuffer = Buffer.from(base64Data, "base64");
  }

  const fileName = `${subFolder}_${crypto.randomBytes(8).toString("hex")}_${Date.now()}.${fileExt}`;
  const filePath = path.join(uploadsDir, fileName);

  await fs.promises.writeFile(filePath, imageBuffer);

  const serverPort = process.env.PORT || 5000;
  return `http://localhost:${serverPort}/uploads/pod/${subFolder}/${fileName}`;
}
