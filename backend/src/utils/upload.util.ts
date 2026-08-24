import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, isR2Configured, bucketName, publicDomain } from "../config/r2";

/**
 * Uploads a base64 image (data URL or raw base64) to Cloudflare R2 object storage or falls back to local disk.
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

  // Extract MIME type, extension, and buffer from base64 string
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let imageBuffer: Buffer;
  let mimeType = "image/png";
  let fileExt = "png";

  if (matches && matches.length === 3) {
    mimeType = matches[1];
    fileExt = mimeType.split("/")[1] || "png";
    imageBuffer = Buffer.from(matches[2], "base64");
  } else {
    imageBuffer = Buffer.from(base64Data, "base64");
  }

  const fileName = `${subFolder}_${crypto.randomBytes(8).toString("hex")}_${Date.now()}.${fileExt}`;
  const objectKey = `pod/${subFolder}/${fileName}`;

  // 1. If Cloudflare R2 is configured, upload directly to R2 Bucket via S3 protocol
  if (isR2Configured && s3Client) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: imageBuffer,
        ContentType: mimeType,
      });

      await s3Client.send(command);

      // Return public CDN/dev domain URL if configured, otherwise default R2 endpoint URL
      if (publicDomain) {
        const cleanDomain = publicDomain.endsWith("/") ? publicDomain.slice(0, -1) : publicDomain;
        return `${cleanDomain}/${objectKey}`;
      }

      const accountId = process.env.R2_ACCOUNT_ID;
      return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
    } catch (error: any) {
      console.error("Cloudflare R2 upload failed, using local disk fallback:", error?.message || error);
    }
  }

  // 2. Fallback to Local Disk Storage (/uploads/pod/photos or /uploads/pod/signatures)
  const uploadsDir = path.join(__dirname, "../../../uploads/pod", subFolder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(filePath, imageBuffer);

  const serverPort = process.env.PORT || 3000;
  return `http://localhost:${serverPort}/uploads/pod/${subFolder}/${fileName}`;
}
