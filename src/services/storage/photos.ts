import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export async function choosePhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera permission was denied. You can enable it in device settings.');
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Photo library permission was denied. You can enable it in device settings.');
  }
  const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.8 as const };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  const asset = result.assets[0];
  // Web has no app file system: keep the photo as a data URL so it survives a reload.
  if (typeof document !== 'undefined') {
    // Shrink it first: browser storage holds only ~5 MB, and a full phone photo would fill it in one scan.
    return await shrinkForWeb(asset.uri);
  }
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp' };
  const extension = extensions[asset.mimeType ?? ''] ?? asset.fileName?.match(/\.(jpe?g|png|heic|heif|webp)$/i)?.[1]?.toLowerCase() ?? 'jpg';
  const dir = new Directory(Paths.document, 'plant-photos');
  dir.create({ idempotent: true });
  const file = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
  new File(asset.uri).copy(file);
  return file.uri;
}

/** Web only: redraws the photo at most WEB_MAX_SIDE px on its long side as a JPEG data URL (about 100-200 KB). */
const WEB_MAX_SIDE = 1024;
export async function shrinkForWeb(uri: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the photo.'));
    img.src = uri;
  });
  const scale = Math.min(1, WEB_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not read the photo.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}
