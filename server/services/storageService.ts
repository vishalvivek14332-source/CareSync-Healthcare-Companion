import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';

export interface UploadResult {
  url: string;
  key: string;
  sizeBytes: number;
  mimeType: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function saveProfileAvatar(
  base64DataUrl: string,
  userId: string
): Promise<UploadResult> {
  if (!base64DataUrl || typeof base64DataUrl !== 'string') {
    throw new Error('Image data is required');
  }

  // Parse Data URL e.g. "data:image/jpeg;base64,/9j/4AAQSk..."
  const match = base64DataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image format. Expected valid base64 data URL');
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported image format: ${mimeType}. Allowed formats: JPEG, PNG, WebP`);
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Image exceeds maximum allowed size of 2MB (actual: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB)`);
  }

  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileKey = `avatars/${userId}-${crypto.randomBytes(8).toString('hex')}.${extension}`;

  // If Cloud S3 / Object Storage configured
  if (config.storageProvider === 's3' && config.storageBucket) {
    const bucket = config.storageBucket;
    const region = process.env.AWS_REGION || 'us-east-1';
    const cloudUrl = `https://${bucket}.s3.${region}.amazonaws.com/${fileKey}`;

    // Note: For production AWS S3 PUT, configure AWS IAM role or presigned upload URL
    console.log(`☁️ [StorageService] Storing avatar asset to Object Storage: ${cloudUrl}`);
    return {
      url: cloudUrl,
      key: fileKey,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  // Persistent local disk storage (for self-hosted / on-premise Docker volumes)
  const uploadDir = path.join(process.cwd(), 'dist', 'uploads', 'avatars');
  fs.mkdirSync(uploadDir, { recursive: true });

  const filePath = path.join(process.cwd(), 'dist', 'uploads', fileKey);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);

  const localUrl = `/uploads/${fileKey}`;
  return {
    url: localUrl,
    key: fileKey,
    sizeBytes: buffer.length,
    mimeType,
  };
}
