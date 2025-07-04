import fs from 'node:fs'
import path from 'node:path'
import si from 'systeminformation'
import ffmpeg from 'fluent-ffmpeg'
import wppconnect from '@wppconnect-team/wppconnect'
import { config } from 'dotenv'
import { create, all } from 'mathjs'
import { ChatCompletionCreateParams } from 'openai/resources'
import { GifskiCommand } from 'gifski-command'
import character from './ai/character.js'
import { CharName, chat, getMemorySlot, Models, resetMemorySlot, setMemorySlot } from './ai/openrouter.js'
import { shutdown } from '../index.js'
import { cai } from './db.js'

let lang: keyof typeof character = 'id'
const modelOptions: ChatCompletionCreateParams = {
  model: Models.V3,
  temperature: 0.7, // Bikin lebih variatif
  messages: [],
  // top_p: 0.95, // Sampling untuk kreativitas
  frequency_penalty: 0, // Biasanya 0 untuk roleplay
  presence_penalty: 0.2, // Dorong ide baru sedikit
  max_tokens: 512,
  stream: false,
}

const math = create(all)

config()

/* CONSTANTS */
console.log('Gathering `package.json`...')
console.time('Package information stored')
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')).toString())
const bun = process.versions.bun,
  node = process.versions.node
const versions = [
  bun ? `Bun v${bun}` : undefined,
  node ? `NodeJS v${node}` : undefined,
  [pkg['name'], pkg['version']].join(' v'),
].filter((e) => e !== undefined)
console.timeEnd('Package information stored')

const readMore = ` ${'\u{34f}'.repeat(1024 * 3)}`

/* SYSTEM INFO */
console.log('Gathering system information...')
console.time('System information stored')
const system = await si.system()
console.timeEnd('System information stored')
console.log('Gathering OS information...')
console.time('OS information stored')
const osInfo = await si.osInfo()
console.timeEnd('OS information stored')
console.time('CPU information stored')
const cpu = await si.cpu()
console.timeEnd('CPU information stored')
const sysinfo = async () => {
  const time = si.time()
  console.log('Gathering memory information...')
  console.time('Memory information gathered')
  const mem = await si.mem()
  console.timeEnd('Memory information gathered')
  console.log('Gathering filesystem information...')
  console.time('Filesystem information gathered')
  const fsSize = await si.fsSize()
  console.timeEnd('Filesystem information gathered')
  return `*System Uptime:* ${new Date(time.uptime * 1000).toISOString().substr(11, 8)}
*Runner:* ${system.manufacturer} ${system.model}${system.virtual ? ' (Virtualized)' : ''} ${system.version}
*OS:* ${osInfo.distro} ${osInfo.release}${osInfo.codename ? ` "${osInfo.codename}"` : ''} (kernel: ${osInfo.kernel} ${
    osInfo.arch
  })
*CPU:* ${cpu.manufacturer} ${cpu.brand} (${cpu.cores} cores available, up to ${cpu.speed} GHz)
*Memory:* ${convertByteUnit(mem.used, 'GB')}/${convertByteUnit(mem.total, 'GB')} GB
*Disk:* ${convertByteUnit(fsSize[0].used, 'GB')}/${convertByteUnit(fsSize[0].size, 'GB')} GB

*💼 Project*${readMore}
\`\`\`
${JSON.stringify(pkg, null, 2)}
\`\`\`

> ${versions.join(' | ')}`
}

/* UTILS */
function convertByteUnit(bytes: number, unit: 'KB' | 'MB' | 'GB') {
  const units = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  }
  const value = bytes / units[unit]
  const result = Math.round(value * 100) / 100
  return result
}

function randomBetween(min: number, max: number) {
  const minCeiled = Math.ceil(min)
  const maxFloored = Math.floor(max)
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled) // The maximum is exclusive and the minimum is inclusive
}

function parseCommand(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false
  let escapeNext = false

  for (const char of input) {
    if (escapeNext) {
      current += char
      escapeNext = false
    } else if (char === '\\') {
      escapeNext = true
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

function help(commandInstructions: string[], description: string) {
  const formattedInstructions = commandInstructions.map((e) => `\`${e}\``)
  return `💡 *Penggunaan*

${formattedInstructions.join('\n')}

${description}`
}

const kerangAjaib = (pertanyaan: string) => {
  const lowerPertanyaan = pertanyaan.toLowerCase()

  const jawaban = [
    {
      keywords: ['boleh', 'izin', 'haruskah'],
      responses: ['Kurasa tidak.', 'Tidak keduanya.', 'Mungkin suatu hari.', 'Ya.'],
    },
    {
      keywords: ['aku', 'saya', 'gimana', 'bagaimana'],
      responses: ['Coba tanya lagi.', 'Mungkin suatu hari.', 'Kurasa tidak.'],
    },
    { keywords: ['akan', 'bakal', 'apakah'], responses: ['Ya.', 'Kurasa tidak.', 'Tidak juga.'] },
    { keywords: ['dimana', 'di mana', 'lokasi'], responses: ['Tidak ada.', 'Coba tanya lagi.', 'Kurasa tidak.'] },
    { keywords: ['kapan', 'waktu'], responses: ['Mungkin suatu hari.', 'Coba tanya lagi.', 'Tidak keduanya.'] },
  ]

  for (const rule of jawaban) {
    if (rule.keywords.some((keyword) => lowerPertanyaan.includes(keyword))) {
      return rule.responses[Math.floor(Math.random() * rule.responses.length)]
    }
  }

  // Default fallback random
  const defaultResponses = [
    'Mungkin suatu hari.',
    'Tidak juga.',
    'Tidak keduanya.',
    'Kurasa tidak.',
    'Ya.',
    'Coba tanya lagi.',
    'Tidak ada.',
  ]

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)]
}

export function getSenderNumber(message: wppconnect.Message): string {
  const author = message.author
  if (typeof author !== 'string') return ''
  return author.replace(/@.*$/, '')
}

export function sendText(
  msg: string,
  client: wppconnect.Whatsapp,
  message: wppconnect.Message,
  quoted: boolean = true
) {
  return client.sendText(resolveIncomingChatId(message), msg, {
    quotedMsg: quoted ? message.id : undefined,
  })
}

export function resolveIncomingChatId(message: wppconnect.Message) {
  return message.fromMe ? message.to : message.from
}

async function splitMembersAndAdmins(client: wppconnect.Whatsapp, message: wppconnect.Message) {
  if (message.isGroupMsg) {
    const chatId = resolveIncomingChatId(message)
    const admins = (await client.getGroupAdmins(chatId)) as wppconnect.Wid[]
    const adminUsers = new Set(admins.map((a) => a.user)) // More efficient lookup
    const members = (await client.getGroupMembersIds(chatId)).filter((e) => !adminUsers.has(e.user))
    return { members, admins }
  }
}

async function isAdmin(client: wppconnect.Whatsapp, message: wppconnect.Message) {
  if (message.isGroupMsg) {
    const admins = (await client.getGroupAdmins(resolveIncomingChatId(message))) as wppconnect.Wid[]
    for (const admin of admins) {
      if (admin.user === getSenderNumber(message)) {
        return true
      }
    }
  }
  return false
}

/**
(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) → lebih imut, blushing intens.

(｡•́‿•̀｡) → malu ringan, lebih kalem.

(//ω//) → blushing shy gaya Jepang klasik.

(≧◡≦) → malu tapi senang.

(>///<) → lebih pendek dan universal.
 */
function blushReact() {
  const blush = ['\\(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)/', '(｡•́‿•̀｡)', '(｡^‿^｡)', '(//ω//)', '(≧◡≦)', '(>///<)']
  return blush[Math.floor(Math.random() * blush.length)]
}

/* COMMANDS */
const commands = {
  'Menu Utama': {
    '/start': [
      'Cek status aktif mode bot.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        return await sendText(
          `🤖 Hai! Saya kembali untuk bergabung dengan kalian! 😁

Silahkan kirim perintah \`/help\` untuk list perintah.`,
          client,
          message
        )
      },
    ],
    '/help': [
      'Menampilkan pesan ini.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        let msg = `*Info penggunaan cukup kirim perintah tanpa argumen, atau \`/[perintah] help\`. Beberapa perintah dapat digunakan tanpa argumen.*

> 👑 Hanya Admin
`
        for (const menuHead of Object.keys(commands)) {
          const commandList = commands[menuHead] as CommandList
          let list = ''
          for (const cmd of Object.keys(commandList)) {
            list += `- \`${cmd}\` ${commandList[cmd][0]}\n`
          }
          msg += `
*📝 ${menuHead}:*
${list}`
        }
        return await sendText(msg.trim(), client, message)
      },
    ],
    '/status': [
      'Cek status host.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        return await sendText(await sysinfo(), client, message)
      },
    ],
  },
  'Menu Grup': {
    '/ping': [
      'Tag seluruh penghuni grup.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        if (message.isGroupMsg) {
          const params = parseCommand(message.body || '')
          if (params.length <= 1 || params[1] === 'help') {
            const helpMsg = help(
              [`${params[0]} all <alasan?>`, `${params[0]} admin <alasan?>`, `${params[0]} member <alasan?>`],
              'Tag seluruh penghuni grup, atau admin/member saja'
            )
            return await sendText(helpMsg, client, message)
          }
          const groupMembers = await splitMembersAndAdmins(client, message)
          if (groupMembers) {
            const param1 = params[1]
            const alasan = params[2]
            const senderNumber = getSenderNumber(message)
            let msg = '*🔔 Ping*' + (alasan ? '' : readMore) + '\n\n'
            if (alasan) {
              msg += `> ${alasan}\n\n_@${senderNumber}_\n${readMore}\n`
            }
            const adminList = groupMembers.admins.map((admin) => `👑 @${admin.user}`).join('\n')
            const memberList = groupMembers.members.map((member) => `👤 @${member.user}`).join('\n')
            switch (param1) {
              case 'all':
                msg += `*Admin:*\n${adminList}\n${readMore}\n*Member:*\n${memberList}`
                break
              case 'admin':
                msg += `*Admin:*\n${adminList}`
                break
              case 'member':
                msg += `*Member:*\n${memberList}`
                break
            }
            return await sendText(msg, client, message)
          }
        }
      },
    ],
    '/open': [
      'Membuka grup; mengizinkan member untuk mengirim pesan. 👑',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        if (message.isGroupMsg && (await isAdmin(client, message))) {
          await client.setMessagesAdminsOnly(message.from, false)
          return await sendText(`Grup ini dibuka oleh admin @${getSenderNumber(message)}`, client, message, false)
        }
      },
    ],
    '/close': [
      'Menutup grup; melarang member untuk mengirim pesan. 👑',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        if (message.isGroupMsg && (await isAdmin(client, message))) {
          await client.setMessagesAdminsOnly(message.from, true)
          return await sendText(`Grup ini ditutup oleh admin @${getSenderNumber(message)}`, client, message, false)
        }
      },
    ],
    '/kick': [
      'Keluarkan member. 👑',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        if (message.isGroupMsg && (await isAdmin(client, message))) {
          const params = parseCommand(message.body || '')
          if (params.length <= 1 || params[1] === 'help') {
            const helpMsg = help(
              [`${params[0]} @username`, `${params[0]} @username1 @username2 <...>`, `[reply] ${params[0]}`],
              'Keluarkan admin'
            )
            return await sendText(helpMsg, client, message)
          }
          params.shift()
          if (message.quotedMsgId) {
            params.push(getSenderNumber(await client.getMessageById(message.quotedMsgId || '')))
          }
          // Earlier so tags are not missed
          const result = await sendText(
            `@${getSenderNumber(message)} telah mengeluarkan ${params.join(', ')}`,
            client,
            message,
            false
          )
          for (const param of params) {
            await client.removeParticipant(resolveIncomingChatId(message), param.replace('@', '') + '@c.us')
          }
          if (params.length > 1) params[params.length - 1] = 'dan ' + params[params.length - 1]
          return result
        }
      },
    ],
    '/promote': [
      'Memberikan tahta admin. 👑',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        if (message.isGroupMsg && (await isAdmin(client, message))) {
          const params = parseCommand(message.body || '')
          if (params.length <= 1 || params[1] === 'help') {
            const helpMsg = help(
              [`${params[0]} @username`, `${params[0]} @username1 @username2 <...>`, `[reply] ${params[0]}`],
              'Memberikan tahta admin'
            )
            return await sendText(helpMsg, client, message)
          }
          params.shift()
          if (message.quotedMsgId) {
            params.push(getSenderNumber(await client.getMessageById(message.quotedMsgId || '')))
          }
          for (const param of params) {
            await client.promoteParticipant(resolveIncomingChatId(message), param.replace('@', '') + '@c.us')
          }
          if (params.length > 1) params[params.length - 1] = 'dan ' + params[params.length - 1]
          return await sendText(
            `${params.join(', ')} diberikan tahta admin oleh @${getSenderNumber(message)}`,
            client,
            message,
            false
          )
        }
      },
    ],
    '/demote': [
      'Kudeta admin. 👑',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        if (message.isGroupMsg && (await isAdmin(client, message))) {
          const params = parseCommand(message.body || '')
          if (params.length <= 1 || params[1] === 'help') {
            const helpMsg = help(
              [`${params[0]} @username`, `${params[0]} @username1 @username2 <...>`, `[reply] ${params[0]}`],
              'Kudeta admin'
            )
            return await sendText(helpMsg, client, message)
          }
          params.shift()
          if (message.quotedMsgId) {
            params.push(getSenderNumber(await client.getMessageById(message.quotedMsgId || '')))
          }
          for (const param of params) {
            await client.demoteParticipant(resolveIncomingChatId(message), param.replace('@', '') + '@c.us')
          }
          if (params.length > 1) params[params.length - 1] = 'dan ' + params[params.length - 1]
          return await sendText(
            `@${getSenderNumber(message)} telah mengkudeta ${params.join(', ')}`,
            client,
            message,
            false
          )
        }
      },
    ],
  },
  'Menu Fun': {
    '/jodoh': [
      'Jodohkan member grup secara acak.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        if (message.isGroupMsg) {
          const params = parseCommand(message.body || '')
          if (params.length <= 2 || params[1] === 'help') {
            const helpMsg = help(
              [`${params[0]} <all|admin|member|@tag><all|admin|member|@tag>`],
              'Jodohkan member grup secara acak'
            )
            return await sendText(helpMsg, client, message)
          }
          const splitted = await splitMembersAndAdmins(client, message)
          const memberList = splitted?.members.map((member) => member.user) || []
          const adminList = splitted?.admins.map((member) => member.user) || []
          const allList = [...memberList, ...adminList]

          const getRandomUser = (type: string) => {
            switch (type) {
              case 'all':
                return '@' + allList[Math.floor(Math.random() * allList.length)]
              case 'admin':
                return '@' + adminList[Math.floor(Math.random() * adminList.length)]
              case 'member':
                return '@' + memberList[Math.floor(Math.random() * memberList.length)]
              default:
                return type
            }
          }

          const user1 = getRandomUser(params[1])
          const user2 = getRandomUser(params[2])

          return await sendText(
            `*💌 Lamaran*

🗣️ ${user1}: Aku suka sama kamu *${user2}!* Mohon berpacaranlah denganku! 💓
💟 ${user2}: 💕${blushReact()}💕`,
            client,
            message
          )
        }
      },
    ],
    '/kerangajaib': [
      '🐚 Puja Kerang Ajaib! ULOLOLOLOLOLOLOLOLOLO 👅 (alpha)',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const params = parseCommand(message.body || '')
        if (params.length <= 1 || params[1] === 'help') {
          const helpMsg = help([`${params[0]} <pertanyaan>`], 'ALPHA')
          return await sendText(helpMsg, client, message)
        }
        params.shift()
        return await sendText(kerangAjaib(params.join('')), client, message)
      },
    ],
    '/percent': [
      'Seberapa persen keberuntungan kamu.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const params = parseCommand(message.body || '')
        if (params.length <= 1 || params[1] === 'help') {
          const helpMsg = help([`${params[0]} <pertanyaan>`], 'UNDOCUMENTED')
          return await sendText(helpMsg, client, message)
        }
        params.shift()
        return await sendText(`${randomBetween(0, 100)}%`, client, message)
      },
    ],
  },
  'Karakter AI (experimental)': {
    '/new': [
      'Buat room baru (chat ini saja).',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const params = parseCommand(message.body || '')
        if (params.length <= 3 || params[1] === 'help') {
          const helpMsg = help([`${params[0]} <nama_room> <karakter>`], 'UNDOCUMENTED')
          return await sendText(helpMsg, client, message)
        }
        const roomName = params[1],
          charName = params[2] as keyof typeof character.en | keyof typeof character.id
        if (charName) {
          const char = [...Object.keys(character.id), ...Object.keys(character.en)]
          if (char.includes(charName)) {
            try {
              await cai.new(roomName, resolveIncomingChatId(message), charName, lang)
              return await sendText(`Room \`${roomName}\` dibuat`, client, message)
            } catch (error) {
              const err = error as Error
              await sendText(err.message, client, message)
              throw err
            }
          } else {
            return await sendText(`Karakter \`${charName}\` tidak tersedia`, client, message)
          }
        }
      },
    ],
    '/rename': ['Ganti nama room.', async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {}],
    '/delete': ['Hapus room.', async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {}],
    '/enter': [
      'Masuk room.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const params = parseCommand(message.body || '')
        if (params.length <= 2 || params[1] === 'help') {
          const helpMsg = help([`${params[0]} <nama_room> <karakter>`], 'UNDOCUMENTED')
          return await sendText(helpMsg, client, message)
        }
      },
    ],
    '/exit': ['Keluar room.', async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {}],

    '/Raiden': [
      'Yang Mulia Electro Archon: Raiden Shogun dan Ei.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const params = parseCommand(message.body || '')
        if (params.length <= 1 || params[1] === 'help') {
          const helpMsg = help([`${params[0]} <chat apa aja>`], 'Masih eksperimental, belum punya fitur memori.')
          return await sendText(helpMsg, client, message)
        }
        const charName = params[0].slice(1) as CharName
        params.shift()
        try {
          const chatResult = await chat(
            getSenderNumber(message),
            resolveIncomingChatId(message),
            charName,
            lang,
            params.join(' '),
            modelOptions
          )
          return await sendText(`*🌀 Raiden Shogun*\n\n${chatResult}`, client, message, true)
        } catch (error) {
          await sendText(`🤖 Ups, ${charName} kayaknya sedang sibuk 😅`, client, message, true)
          throw error
        }
      },
    ],
    '/Wanderer': [
      'Seorang boneka yang entah kemana ia berkelana sekarang. (Versi Serenitea Pot)',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const params = parseCommand(message.body || '')
        if (params.length <= 1 || params[1] === 'help') {
          const helpMsg = help([`${params[0]} <chat apa aja>`], 'Masih eksperimental, belum punya fitur memori.')
          return await sendText(helpMsg, client, message)
        }
        const charName = params[0].slice(1) as CharName
        params.shift()
        try {
          const chatResult = await chat(
            getSenderNumber(message),
            resolveIncomingChatId(message),
            charName,
            lang,
            params.join(' '),
            modelOptions
          )
          return await sendText(`*🎎 Wanderer*\n\n${chatResult}`, client, message, true)
        } catch (error) {
          await sendText(`🤖 Ups, ${charName} kayaknya sedang sibuk 😅`, client, message, true)
          throw error
        }
      },
    ],
  },
  'Menu Lainnya': {
    '/math': [
      'Pustaka mathjs.org (alpha: entahlah, coba aja pake)',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const params = parseCommand(message.body || '')
        if (params.length <= 1 || params[1] === 'help') {
          const helpMsg = help([`${params[0]}<expression>`], 'Selengkapnya: mathjs.org bagian `evaluate`')
          return await sendText(helpMsg, client, message)
        }
        params.shift()
        return await sendText(math.evaluate(params.join(' ')).toString(), client, message, true)
      },
    ],
    '/sticker': [
      'Gambar atau video jadi stiker (alpha: kemungkinan masih belum stabil)',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const incomingMsg = message
        message =
          !(message.type === wppconnect.MessageType.IMAGE || message.type === wppconnect.MessageType.VIDEO) &&
          message.quotedMsgId
            ? await client.getMessageById(message.quotedMsgId)
            : message // Image/Video msg
        const params = parseCommand((incomingMsg.quotedMsgId ? incomingMsg.body : message.caption) || '')
        // Include quoted msg
        if (message.type === wppconnect.MessageType.IMAGE || message.type === wppconnect.MessageType.VIDEO) {
          try {
            fs.mkdirSync('.tmp')
          } catch (e) {
            // console.error(e)
          }
          let filePath = `.tmp/${crypto.randomUUID()}`
          await client.decryptAndSaveFile(message, filePath)
          if (params[1] === 'fit') {
            if (message.type === wppconnect.MessageType.VIDEO) {
              // ffmpeg -i ./test/video.mp4 ./test/video.mp4.frame%04d.png
              fs.mkdirSync(`${filePath}.tmp`, { recursive: true })
              console.log('Crushing video to image frames...')
              console.time('Frames extraction complete')
              await new Promise<void>((resolve, reject) => {
                ffmpeg(filePath)
                  .videoFilter(
                    '[0]scale=2*trunc(max(iw\\,ih)/2):2*trunc(max(iw\\,ih)/2):force_original_aspect_ratio=decrease[scaled];[scaled]pad=2*trunc(max(iw\\,ih)/2):2*trunc(max(iw\\,ih)/2):(ow-iw)/2:(oh-ih)/2:color=0x00000000'
                  )
                  .outputOptions(['-pix_fmt', 'rgba', '-y'])
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
              console.log('Gifski Command:', result)
              console.timeEnd(`Gifski output: ${filePath}.gif`)
              fs.rmSync(`${filePath}.tmp`, { recursive: true, force: true })
              filePath = `${filePath}.gif`
            } else {
              console.log('Fit square transparent background image')
              console.time(`Ffmpeg output: ${filePath}.webp`)
              await new Promise<void>((resolve, reject) => {
                ffmpeg(filePath)
                  .videoFilter(
                    '[0]scale=2*trunc(max(iw\\,ih)/2):2*trunc(max(iw\\,ih)/2):force_original_aspect_ratio=decrease[scaled];[scaled]pad=2*trunc(max(iw\\,ih)/2):2*trunc(max(iw\\,ih)/2):(ow-iw)/2:(oh-ih)/2:color=0x00000000'
                  )
                  .outputOptions(['-pix_fmt', 'bgra', '-lossless 1', '-c:v', 'libwebp_anim', '-y'])
                  .output(`${filePath}.webp`)
                  .on('end', () => resolve())
                  .on('error', (err) => reject(err))
                  .run()
              })
              console.timeEnd(`Ffmpeg output: ${filePath}.webp`)
              fs.rmSync(filePath, { force: true })
              filePath = `${filePath}.webp`
            }
          }
          let result
          if (message.type === wppconnect.MessageType.VIDEO) {
            result = await client.sendImageAsStickerGif(resolveIncomingChatId(message), filePath, {
              quotedMsg: incomingMsg.id,
            })
          } else if (message.type === wppconnect.MessageType.IMAGE) {
            result = await client.sendImageAsSticker(resolveIncomingChatId(message), filePath, {
              quotedMsg: incomingMsg.id,
            })
          }
          fs.rmSync(filePath, { force: true })
          return result
        } else {
          const helpMsg = help(
            [`[gambar/video] ${params[0]} <fit?>`, `[reply gambar/video] ${params[0]} <fit?>`],
            'Untuk saat ini hanya bisa satu gambar/video'
          )
          return await sendText(helpMsg, client, message)
        }
      },
    ],
  },
}

const modelList = Object.entries(Models)
  .map(([key, value]) => `*${key}*: \`${value}\``)
  .join('\n')
  .trim()
export const ownerCommands = {
  '/shutdown': async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
    return await shutdown(client, message)
  },
  '/model': async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
    const params = parseCommand(message.body || '')
    const arg = Models[params[1]]
    if (arg) {
      modelOptions.model = arg
      return await sendText(`Current selected model: \`${modelOptions.model}\``, client, message)
    } else {
      await sendText(`Current selected model: \`${modelOptions.model}\``, client, message)
      return await sendText(
        `${modelList}\n\nBeberapa model mungkin memang tidak cocok untuk roleplay`,
        client,
        message,
        false
      )
    }
  },
  '/lang': async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
    const params = parseCommand(message.body || '')
    const arg = params[1] as keyof typeof character
    if (arg) {
      lang = arg
    }
    return await sendText(`Current lang: \`${lang}\``, client, message)
  },
  '/temp': async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
    const params = parseCommand(message.body || '')
    const arg = Number(params[1])
    if (arg) {
      modelOptions.temperature = arg
    }
    return await sendText(`Current temperature: \`${modelOptions.temperature}\``, client, message)
  },
  '/memory': async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
    let msg = `Current memory slot: \`${getMemorySlot()}\``
    const params = parseCommand(message.body || '')
    const arg = Number(params[1])
    if (arg) {
      setMemorySlot(arg)
      msg = `Current memory slot: \`${getMemorySlot()}\``
    } else if (params[1] === 'reset') {
      resetMemorySlot(resolveIncomingChatId(message), params[2] as keyof typeof character, params[3] as CharName)
      msg += ` (reset: \`${params[2]}\`, \`${params[3]}\`)`
    }
    return await sendText(msg, client, message)
  },
  '/max_t': async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
    const params = parseCommand(message.body || '')
    const arg = Number(params[1])
    if (arg) {
      modelOptions.max_tokens = arg
    }
    return await sendText(`Current token size: \`${modelOptions.max_tokens}\``, client, message)
  },
}

// FLATTEN FOR FAST LOOKUP
console.info('Collecting commands...')
console.time('Commands collected')

type CommandEntry = {
  menu: string
  description: string
  handler: CommandHandler
}

export const commandTable: { [cmd: string]: CommandEntry } = {}
for (const menuName of Object.keys(commands)) {
  const menu = commands[menuName]
  for (const cmd of Object.keys(menu)) {
    const [description, handler] = menu[cmd]
    commandTable[cmd] = {
      menu: menuName,
      description,
      handler,
    }
  }
}

console.timeEnd('Commands collected')

type CommandHandler = (client: wppconnect.Whatsapp, message: wppconnect.Message) => Promise<wppconnect.Message>
type CommandList = { [key: string]: [string, CommandHandler] }

export default commands
