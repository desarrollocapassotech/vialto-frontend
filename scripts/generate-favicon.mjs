import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

async function main() {
  const logoPng = path.join(publicDir, 'logo.png');
  const logoSvg = path.join(publicDir, 'favicon.svg');
  const input = fs.existsSync(logoPng) ? logoPng : logoSvg;
  if (!fs.existsSync(input)) {
    console.error('No hay logo.png ni favicon.svg en public/');
    process.exit(1);
  }

  const sizes = [16, 32, 48];
  const buffers = await Promise.all(
    sizes.map((s) => sharp(input).resize(s, s, { fit: 'contain' }).png().toBuffer()),
  );
  const out = path.join(publicDir, 'favicon.ico');
  fs.writeFileSync(out, await toIco(buffers));
  console.log('Generado', out, 'desde', path.basename(input));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
