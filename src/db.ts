import { waddler } from 'waddler/neo'
import { config } from 'dotenv'
import character from './ai/character.js'

config()

async function createSqlConnection(dbLocalPath: string, dbUrl?: string) {
  if (dbUrl) {
    try {
      const sql = waddler({
        url: dbUrl,
        min: 1,
        max: 8,
        accessMode: 'read_write',
      })
      // Attempt a lightweight query to verify connection
      const result = await sql`SELECT 1`
      if (result[0]['1'] === 1) {
        console.info('Connected to MotherDuck')
      } else {
        console.warn('Looks like something is not right:', result)
      }
      return sql
    } catch (err) {
      console.warn('MotherDuck connection failed, falling back to local db', err)
    }
  } else {
    console.warn('MotherDuck URL not provided, using local db')
  }
  // Fallback to local db
  try {
    const sql = waddler({
      url: dbLocalPath,
      min: 1,
      max: 8,
      accessMode: 'read_write',
    })
    // Attempt a lightweight query to verify connection
    const result = await sql`SELECT 1`
    if (result[0]['1'] === 1) {
      console.info('Connected to local db:', dbLocalPath)
    } else {
      console.warn('Looks like something is not right:', result)
    }
    return sql
  } catch (err) {
    console.error('Error creating connection to local db')
    throw err
  }
}

const sql = await createSqlConnection('data.db', process.env.DUCKDB)

async function dbInit() {
  await sql/* sql */ `use data.main`
  return await sql/* sql */ `
create table if not exists cai (
  room varchar not null primary key,
  name varchar not null,
  lang varchar(2) default 'id' not null,
  participant json default '[]'::JSON not null,
  data json default '[]'::JSON not null,
)`
}

const cai = {
  new: async (roomName: string, chatId: string, name: string, lang: keyof typeof character) => {
    const rm = `${roomName}:${chatId}`
    const result = await sql/* sql */ `
    insert into cai (room, name, lang) values (${rm}, ${name}, ${lang})
    `
    console.log('New room:', rm, name, lang, result)
    return result
  },
  updateMemory: async (roomName: string, chatId: string, data: { role: 'user' | 'assistant'; content: string }[]) => {
    const rm = `${roomName}:${chatId}`
    return sql/* sql */ `
    insert or update into cai (data) values (${data}) where room = ${rm}
    `
  },
  getMemory: async (roomName: string, chatId: string) => {
    const rm = `${roomName}:${chatId}`
    return sql/* sql */ `
    select data from cai where room = ${rm})
    `
  },
  rename: async (roomName: string, chatId: string, newRoomName: string) => {
    const rm = `${roomName}:${chatId}`
    return sql/* sql */ `
    update into cai values (room = ${newRoomName}:${chatId}) where room = ${rm}
    `
  },
  delete: async (roomName: string, chatId: string) => {
    const rm = `${roomName}:${chatId}`
    return sql/* sql */ `
    delete from cai where room = ${rm}
    `
  },
}

await dbInit()

export { cai }
