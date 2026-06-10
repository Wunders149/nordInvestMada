import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const BASE_FOLDER = 'nord-invest';

export function getCloudinaryUrl(publicId, options = {}) {
  return cloudinary.url(publicId, {
    quality: 'auto',
    fetch_format: 'auto',
    secure: true,
    ...options
  });
}

export async function uploadImage(buffer, { folder, publicId, mimetype }) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${BASE_FOLDER}/${folder}`,
        public_id: publicId,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto'
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

export async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

export async function listImagesByFolder(folder) {
  try {
    const result = await cloudinary.api.resources_by_asset_folder(
      `${BASE_FOLDER}/${folder}`,
      { max_results: 100 }
    );
    return result.resources || [];
  } catch {
    return [];
  }
}

const CLOUDINARY_MAPPING_KEY = 'cloudinary_mapping';

let mappingCache = null;

export async function getCloudinaryMapping() {
  if (mappingCache) return mappingCache;
  try {
    const { supabase } = await import('./supabase.js');
    const { data, error } = await supabase.from('settings').select('value').eq('key', CLOUDINARY_MAPPING_KEY).single();
    if (error && error.code === 'PGRST116') {
      mappingCache = {};
      return mappingCache;
    }
    if (error) throw error;
    mappingCache = data?.value || {};
    return mappingCache;
  } catch {
    mappingCache = {};
    return mappingCache;
  }
}

export async function setCloudinaryMapping(id, entry) {
  const map = await getCloudinaryMapping();
  if (entry === null) {
    delete map[id];
  } else {
    map[id] = entry;
  }
  mappingCache = map;
  const { supabase } = await import('./supabase.js');
  await supabase.from('settings').upsert(
    { key: CLOUDINARY_MAPPING_KEY, value: map, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
}

export async function clearCloudinaryMapping() {
  mappingCache = null;
}

export async function uploadPdf(buffer, { folder, publicId }) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${BASE_FOLDER}/${folder}`,
        public_id: publicId,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto'
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

export function getPdfThumbnailUrl(publicId, width = 300) {
  try {
    return cloudinary.url(publicId, {
      width,
      page: 1,
      crop: 'fit',
      quality: 'auto',
      fetch_format: 'auto',
      secure: true
    });
  } catch {
    return null;
  }
}

export function getPdfUrl(publicId) {
  try {
    return cloudinary.url(publicId, { secure: true });
  } catch {
    return null;
  }
}

export function getPdfDownloadUrl(publicId) {
  try {
    return cloudinary.url(publicId, {
      flags: 'attachment',
      secure: true
    });
  } catch {
    return null;
  }
}

export { cloudinary, BASE_FOLDER };
