// Converts assets/icon.png → assets/icon.ico
// ICO format: embeds the PNG directly as a 256x256 PNG entry (Windows Vista+)
const fs = require('fs')
const path = require('path')

const pngPath = path.join(__dirname, '../assets/icon.png')
const icoPath = path.join(__dirname, '../assets/icon.ico')

const pngData = fs.readFileSync(pngPath)

// ICO header: reserved(2) + type=1(2) + count=1(2)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)   // reserved
header.writeUInt16LE(1, 2)   // type: 1 = icon
header.writeUInt16LE(1, 4)   // count: 1 image

// Image directory entry (16 bytes)
const entry = Buffer.alloc(16)
entry[0] = 0          // width: 0 = 256
entry[1] = 0          // height: 0 = 256
entry[2] = 0          // color count: 0 = no palette
entry[3] = 0          // reserved
entry.writeUInt16LE(1, 4)   // planes
entry.writeUInt16LE(32, 6)  // bit count
entry.writeUInt32LE(pngData.length, 8)   // size of image data
entry.writeUInt32LE(6 + 16, 12)          // offset to image data (after header + one entry)

const ico = Buffer.concat([header, entry, pngData])
fs.writeFileSync(icoPath, ico)
console.log(`ICO written to ${icoPath} (${ico.length} bytes)`)
