import { cai } from './db.js'
// import duckdb from '@duckdb/node-api'
try {
  console.log(await cai.new('raidens', 'tes@g.us', 'Raiden', 'id'))
  console.log(await cai.new('raidens', 'tes@g.us', 'Raiden', 'id'))
} catch (error) {
  const err = error as Error
  console.error(err.message)
}
// console.log(await cai.new('raidenz', 'tes@g.us', 'Raiden', 'id'))
