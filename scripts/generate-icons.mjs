// Generates the opaque icons needed for a first-class install experience on
// iOS and Android, derived from the existing (transparent, rounded) icon-512.png.
//
//   apple-touch-icon.png  180x180  opaque  — iOS home screen (iOS ignores the
//                                            manifest and composites alpha onto
//                                            black, so it must be flat/opaque)
//   maskable-512.png      512x512  opaque  — Android adaptive/maskable icon
//                                            (full-bleed, safe-zone friendly)
//
// The flatten background is sampled from the source icon's own body so the
// filled corners match the artwork exactly regardless of the exact saffron.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'public/icon-512.png')

// Sample the top-edge centre pixel — inside the rounded-rect body, so it is the
// artwork's background colour, not a transparent corner.
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const px = (x, y) => {
  const i = (y * info.width + x) * info.channels
  return { r: data[i], g: data[i + 1], b: data[i + 2] }
}
const body = px(Math.floor(info.width / 2), 4)

const flatten = (size) =>
  sharp(src).flatten({ background: body }).resize(size, size, { fit: 'cover' }).png()

await flatten(180).toFile(resolve(root, 'public/apple-touch-icon.png'))
await flatten(512).toFile(resolve(root, 'public/maskable-512.png'))

console.log(`icons generated (body #${[body.r, body.g, body.b].map((n) => n.toString(16).padStart(2, '0')).join('')})`)
