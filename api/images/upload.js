/**
 * Image Upload Endpoint
 * POST /api/images/upload
 * Uploads images to Vercel Blob storage
 * Requires admin authentication
 *
 * Body should contain: { imageData: base64string, filename: string, productId: string }
 */

import { put } from '@vercel/blob';
import { requireAdmin } from '../../lib/admin-auth.mjs';

// Vercel Serverless Functions on Hobby cap request bodies at 4.5MB at the
// platform level — there is no per-function override (the Next-style
// `bodyParser` config is ignored here). Base64-encoded JSON inflates by ~33%,
// so practical raw-image ceiling is ~3MB. Callers must resize/compress
// client-side before posting; see public/admin/admin-header-manager.js
// uploadBannerImage().
const MAX_RAW_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAdmin(req, res))) return;

  // Vercel Blob needs a read/write token. Without a connected Blob store the
  // SDK throws a generic error that surfaced to admins as "Internal server
  // error" with no clue. Fail fast with an actionable message instead — this
  // is the most common reason image uploads don't work on a fresh deploy.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'Image storage is not configured. In the Vercel dashboard, create/connect a Blob store for this project (Storage → Blob), then redeploy. This sets BLOB_READ_WRITE_TOKEN automatically.',
      code: 'BLOB_NOT_CONFIGURED'
    });
  }

  try {
    const { imageData, filename, productId } = req.body || {};

    if (!imageData || !filename) {
      return res.status(400).json({ error: 'Missing image data or filename' });
    }

    // Extract base64 data and content type
    const matches = imageData.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image data format' });
    }

    const contentType = matches[1];
    const base64Data = matches[2];

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        allowed: ['JPEG', 'PNG', 'WebP']
      });
    }

    // Convert base64 to Buffer
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_RAW_BYTES) {
      return res.status(400).json({
        error: 'File too large',
        maxSize: '3MB (after the Vercel 4.5MB body limit and base64 inflation)',
        actualSize: `${(buffer.length / 1024 / 1024).toFixed(2)}MB`
      });
    }

    // Upload to Vercel Blob
    const blobFilename = productId
      ? `products/${productId}/${Date.now()}-${filename}`
      : `products/${Date.now()}-${filename}`;

    let blob;
    try {
      blob = await put(blobFilename, buffer, {
        access: 'public',
        addRandomSuffix: true,
        contentType
      });
    } catch (blobErr) {
      // Surface the real storage error (bad/expired token, store deleted, quota)
      // instead of a generic 500 so the admin can actually fix it.
      console.error('Vercel Blob put() failed:', blobErr);
      return res.status(502).json({
        error: 'Image storage rejected the upload. Check that the Vercel Blob store is connected and BLOB_READ_WRITE_TOKEN is valid.',
        code: 'BLOB_UPLOAD_FAILED',
        message: blobErr.message
      });
    }

    return res.status(200).json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      size: buffer.length,
      contentType
    });

  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
