import sql, { cai } from './db.js'
import ffmpeg from 'fluent-ffmpeg'
import { GifskiCommand } from 'gifski-command'
import fs from 'node:fs'
// import duckdb from '@duckdb/node-api'

// try {
//   console.log(await cai.new('raidens','tes@g.us', 'Raiden', 'id'))
//   console.log(await cai.new('raidenz','tes@g.us', 'Raiden', 'id'))
//   console.log(await cai.enter('raidens','tes@g.us', '6123'))
// } catch (error) {
//   const err = error as Error
//   console.error(err.message)
// }

async function main() {
  const filePath = '.tmp/input.mkv'
  fs.mkdirSync(`${filePath}.tmp`, { recursive: true })
  console.log('Crushing video to image frames...')
  console.time('Frames extraction complete')
  await new Promise<void>((resolve, reject) => {
    ffmpeg(filePath)
      .output(`${filePath}.tmp/frame%04d.png`)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
  console.timeEnd('Frames extraction complete')
  fs.rmSync(filePath, { force: true })
  console.log('Gifski post-porcessing....')
  console.time(`Gifski output: ${filePath}.gif`)

  const command = new GifskiCommand({
    frames: [`${filePath}.tmp/frame*.png`],
    output: `${filePath}.gif`,
    quality: 100,
  })
  const result = await command.run()
  console.timeEnd(`Gifski output: ${filePath}.gif`)
  fs.rmSync(`${filePath}.tmp`, { recursive: true, force: true })
}

await main()
