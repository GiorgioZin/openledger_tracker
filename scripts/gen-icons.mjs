// Renders the SVG favicon to the PNG icons the PWA manifest needs.
// Uses sharp if available; otherwise writes a solid-color fallback PNG so the
// build always has valid icon files. Run: node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')
mkdirSync(outDir, { recursive: true })

const sizes = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: '../apple-touch-icon.png', size: 180 },
]

async function withSharp() {
  const sharp = (await import('sharp')).default
  const svg = readFileSync(resolve(root, 'public/favicon.svg'))
  for (const { file, size } of sizes) {
    const buf = await sharp(svg).resize(size, size).png().toBuffer()
    writeFileSync(resolve(outDir, file), buf)
  }
  console.log('icons: rendered from SVG via sharp')
}

// Minimal solid-color PNG encoder (no deps), used as a fallback.
function solidPng(size, [r, g, b]) {
  const crcTable = (() => {
    const t = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })()
  const crc32 = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeBuf = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
    return Buffer.concat([len, typeBuf, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r
    row[1 + x * 3 + 1] = g
    row[1 + x * 3 + 2] = b
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function withFallback() {
  for (const { file, size } of sizes) {
    writeFileSync(resolve(outDir, file), solidPng(size, [15, 23, 42]))
  }
  console.log('icons: wrote solid-color fallback PNGs (install sharp for the real logo)')
}

try {
  await withSharp()
} catch {
  withFallback()
}
