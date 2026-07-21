import { Readable } from 'stream';
import cloudinary from '../config/cloudinary';

export function uploadBuffer(
  buffer: Buffer,
  folder: string,
  resourceType: string = 'auto',
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType as any },
      (err, result) => {
        if (err) reject(err);
        else resolve(result as any);
      },
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}