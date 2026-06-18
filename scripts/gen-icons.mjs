// Generates PWA / favicon raster assets from an inline fox-mascot SVG.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pub = resolve(root, 'public')
mkdirSync(resolve(pub, 'icons'), { recursive: true })

const ORANGE = '#f97316'
const ORANGE_DK = '#c2410c'
const CREAM = '#fdf3e7'
const DARK = '#0b0b0f'

// Stylized geometric fox face, drawn on a 512x512 grid, symmetric about x=256.
function fox() {
  return `
  <g>
    <!-- ears -->
    <path d="M150 210 L118 70 L238 158 Z" fill="${ORANGE}"/>
    <path d="M362 210 L394 70 L274 158 Z" fill="${ORANGE}"/>
    <path d="M158 188 L139 108 L210 162 Z" fill="${ORANGE_DK}"/>
    <path d="M354 188 L373 108 L302 162 Z" fill="${ORANGE_DK}"/>
    <!-- head -->
    <path d="M256 150
             C 196 150 150 180 138 238
             C 130 290 168 348 256 430
             C 344 348 382 290 374 238
             C 362 180 316 150 256 150 Z" fill="${ORANGE}"/>
    <!-- cheeks / muzzle (cream) -->
    <path d="M256 250
             C 222 250 196 268 188 300
             C 210 360 240 398 256 430
             C 272 398 302 360 324 300
             C 316 268 290 250 256 250 Z" fill="${CREAM}"/>
    <path d="M256 168
             C 236 196 236 232 256 256
             C 276 232 276 196 256 168 Z" fill="${CREAM}"/>
    <!-- eyes -->
    <path d="M196 244 L232 232 L222 268 Z" fill="${DARK}"/>
    <path d="M316 244 L280 232 L290 268 Z" fill="${DARK}"/>
    <!-- nose -->
    <path d="M236 318 L276 318 L256 346 Z" fill="${DARK}"/>
  </g>`
}

function svg({ size, bg, rounded, scale }) {
  const inner = fox()
  const t =
    scale && scale !== 1
      ? `<g transform="translate(${(512 * (1 - scale)) / 2} ${
          (512 * (1 - scale)) / 2
        }) scale(${scale})">${inner}</g>`
      : inner
  const bgEl = bg
    ? rounded
      ? `<rect width="512" height="512" rx="112" fill="${bg}"/>`
      : `<rect width="512" height="512" fill="${bg}"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${bgEl}${t}</svg>`
}

const png = (opts, out) =>
  sharp(Buffer.from(svg(opts)))
    .png()
    .toFile(resolve(pub, out))
    .then(() => console.log('✓', out))

await Promise.all([
  png({ size: 192, bg: DARK, rounded: true }, 'icons/icon-192.png'),
  png({ size: 512, bg: DARK, rounded: true }, 'icons/icon-512.png'),
  // maskable: full-bleed background, fox kept inside the ~80% safe zone
  png({ size: 512, bg: DARK, rounded: false, scale: 0.72 }, 'icons/icon-maskable-512.png'),
  png({ size: 180, bg: DARK, rounded: true }, 'apple-touch-icon.png'),
])

// Crisp scalable favicon (transparent background)
writeFileSync(resolve(pub, 'favicon.svg'), svg({ size: 512 }).trim())
console.log('✓ favicon.svg')
