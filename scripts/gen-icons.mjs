import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.cwd(), "public/icons");
mkdirSync(outDir, { recursive: true });

function svg({ size, padding }) {
  const s = size;
  const p = padding;
  const boardW = s - p * 2;
  const boardH = boardW * 0.62;
  const boardY = s - p - boardH;
  const whiteKeys = 5;
  const whiteW = boardW / whiteKeys;
  const blackW = whiteW * 0.58;
  const blackH = boardH * 0.6;

  let whites = "";
  for (let i = 0; i < whiteKeys; i++) {
    whites += `<rect x="${p + i * whiteW}" y="${boardY}" width="${whiteW - 2}" height="${boardH}" rx="${whiteW * 0.12}" fill="#f8fafc"/>`;
  }
  let blacks = "";
  [0, 1, 3, 4].forEach((i) => {
    const cx = p + (i + 1) * whiteW;
    blacks += `<rect x="${cx - blackW / 2}" y="${boardY}" width="${blackW}" height="${blackH}" rx="${blackW * 0.15}" fill="#0f172a"/>`;
  });

  const barW = whiteW * 0.55;
  const bar = (i, h, y) =>
    `<rect x="${p + i * whiteW + (whiteW - barW) / 2}" y="${y}" width="${barW}" height="${h}" rx="${barW * 0.3}" fill="#38bdf8"/>`;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0ea5e9"/>
        <stop offset="1" stop-color="#0369a1"/>
      </linearGradient>
    </defs>
    <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#bg)"/>
    ${bar(1, boardH * 0.9, boardY - boardH * 1.05)}
    ${bar(3, boardH * 0.6, boardY - boardH * 0.75)}
    ${whites}
    ${blacks}
  </svg>`;
}

async function make(name, size, padding) {
  const buf = Buffer.from(svg({ size, padding }));
  await sharp(buf).png().toFile(path.join(outDir, name));
  console.log("wrote", name);
}

await make("icon-192.png", 192, 22);
await make("icon-512.png", 512, 58);
await make("apple-touch-icon.png", 180, 18);
await make("icon-maskable-512.png", 512, 100);
