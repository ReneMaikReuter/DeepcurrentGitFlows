// Converts assets/icon.png → assets/icon.ico (multi-size: 16,32,48,64,128,256)
import { Jimp } from 'jimp'
import pngToIco from 'png-to-ico'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const SIZES = [16, 32, 48, 64, 128, 256]
const tmpDir = 'scripts/tmp-ico'
mkdirSync(tmpDir, { recursive: true })

const src = await Jimp.read('assets/icon.png')

const pngPaths = []
for (const size of SIZES) {
  const resized = src.clone().resize({ w: size, h: size })
  const outPath = join(tmpDir, `icon_${size}.png`)
  await resized.write(outPath)
  pngPaths.push(outPath)
}

const icoBuffer = await pngToIco(pngPaths)
writeFileSync('assets/icon.ico', icoBuffer)
console.log('assets/icon.ico written with sizes:', SIZES.join(', '))
