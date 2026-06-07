import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'splash')

const SIZES = [
  { name: 'splash-1179x2556.png', w: 1179, h: 2556 },
  { name: 'splash-1290x2796.png', w: 1290, h: 2796 },
  { name: 'splash-750x1334.png', w: 750, h: 1334 },
  { name: 'splash-1284x2778.png', w: 1284, h: 2778 },
  { name: 'splash-1668x2388.png', w: 1668, h: 2388 },
  { name: 'splash-1640x2360.png', w: 1640, h: 2360 },
]

const BG = '#0A0A0A'
const TITLE = 'Equipment QR Hub'
const SUBTITLE = 'by Mytra EHS'
const PURPLE = '#572DFF'

function buildSvg(w, h) {
  const titleSize = Math.round(w * 0.04)
  const subSize = Math.round(w * 0.016)
  const lineW = Math.round(w * 0.06)
  const cy = Math.round(h * 0.4)

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${BG}"/>
    <text x="${w / 2}" y="${cy}" text-anchor="middle"
          font-family="Inter, -apple-system, sans-serif" font-weight="700"
          font-size="${titleSize}" fill="#EDEDED" letter-spacing="-0.5">
      ${TITLE}
    </text>
    <text x="${w / 2}" y="${cy + titleSize * 1.2}" text-anchor="middle"
          font-family="Inter, -apple-system, sans-serif" font-weight="500"
          font-size="${subSize}" fill="${PURPLE}">
      ${SUBTITLE}
    </text>
    <line x1="${(w - lineW) / 2}" y1="${cy + titleSize * 2}"
          x2="${(w + lineW) / 2}" y2="${cy + titleSize * 2}"
          stroke="${PURPLE}" stroke-width="2" stroke-linecap="round"/>
  </svg>`
}

async function generate() {
  console.log(`Generating ${SIZES.length} splash images...`)
  for (const { name, w, h } of SIZES) {
    const svg = Buffer.from(buildSvg(w, h))
    await sharp(svg)
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, name))
    const { size } = await sharp(join(OUT, name)).metadata().then(() =>
      import('fs').then(fs => fs.statSync(join(OUT, name)))
    )
    console.log(`  ${name} (${w}×${h}) — ${Math.round(size / 1024)}KB`)
  }
  console.log('Done.')
}

generate().catch(console.error)
