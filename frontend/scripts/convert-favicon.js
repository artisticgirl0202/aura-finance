/**
 * Convert favicon.svg to PNG and JPG using sharp
 * PNG: preserves transparency
 * JPG: white background for transparent areas
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const inputPath = path.join(publicDir, 'favicon.svg');
const pngPath = path.join(publicDir, 'favicon.png');
const jpgPath = path.join(publicDir, 'favicon.jpg');

async function convert() {
  try {
    // PNG: preserve transparency
    await sharp(inputPath)
      .resize(48, 48)
      .png()
      .toFile(pngPath);
    console.log('Saved:', pngPath);

    // JPG: white background for transparent areas
    await sharp(inputPath)
      .resize(48, 48)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toFile(jpgPath);
    console.log('Saved:', jpgPath);

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

convert();
