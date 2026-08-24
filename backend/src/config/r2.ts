import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
export const bucketName = process.env.R2_BUCKET_NAME || "logistics-pod-assets";
export const publicDomain = process.env.R2_PUBLIC_DOMAIN;

export const isR2Configured = Boolean(accountId && accessKeyId && secretAccessKey);

export const s3Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    })
  : null;

if (isR2Configured) {
  console.log("☁️ Cloudflare R2 Object Storage configured successfully.");
} else {
  console.log("ℹ️ Cloudflare R2 environment variables missing. Falling back to local disk storage (/uploads/pod).");
}
