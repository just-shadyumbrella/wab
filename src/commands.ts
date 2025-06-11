import fs from 'node:fs'
import path from 'node:path'
import si from 'systeminformation'
import { config } from 'dotenv'
import wppconnect from '@wppconnect-team/wppconnect'

config()
const ownerNumbers = process.env.OWNER_NUMBER?.split(',')

/* CONSTANTS */

console.log('Gathering `package.json...`')
console.time('Stored `package.json`')
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')).toString())
const bun = process.versions.bun,
  node = process.versions.node
const versions = [
  bun ? `Bun v${bun}` : undefined,
  node ? `NodeJS v${node}` : undefined,
  [pkg['name'], pkg['version']].join(' v'),
].filter((e) => e !== undefined)
console.timeEnd('Stored `package.json`')

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
  return `*📝 Status*
  
*System Uptime:* ${new Date(time.uptime * 1000).toISOString().substr(11, 8)}
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

function help(commandInstructions: string, description: string) {
  return `💡 *Penggunaan*
\`\`\`${commandInstructions}\`\`\`
${description}`
}

function getSenderNumber(message: wppconnect.Message): string {
  const author = message.author
  if (typeof author !== 'string') return ''
  return author.replace(/@.*$/, '')
}

// type Contact2 = {
//   id
// } & wppconnect.Contact

async function getMembers(client: wppconnect.Whatsapp, message: wppconnect.Message) {
  if (message.isGroupMsg) {
    const admins = await client.getGroupAdmins(message.from)
    const members = (await client.getGroupMembers(message.from)).filter((e) => {
      for (const admin of admins) {
        if (e.id.user === admin.user) {
          return false
        }
      }
      return true
    })

    return { members, admins }
  }
}

/* COMMANDS */

const commands = {
  'Menu Utama': {
    '/start': [
      'Cek status aktif mode bot.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        client.sendText(
          message.from,
          `🤖 Hai! Saya kembali untuk bergabung dengan kalian! 😁

Silahkan kirim perintah \`/help\` untuk list perintah.`,
          {
            quotedMsg: message.id,
          }
        )
      },
    ],
    '/help': [
      'Menampilkan pesan ini.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        let msg = `*📝 LIST PERINTAH*

Info penggunaan cukup kirim perintah tanpa argumen, atau \`/[perintah] help\`.

> 👑 Hanya Admin
`
        for (const menuHead of Object.keys(commands)) {
          const commandList = commands[menuHead] as CommandList
          let list = ''
          for (const cmd of Object.keys(commandList)) {
            list += `- \`${cmd}\` ${commandList[cmd][0]}\n`
          }
          msg += `
*${menuHead}:*
${list}`
        }
        client.sendText(message.from, msg.trim(), {
          quotedMsg: message.id,
        })
      },
    ],
    '/status': [
      'Cek status host.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        client.sendText(message.from, await sysinfo(), {
          quotedMsg: message.id,
        })
      },
    ],
  },
  'Menu Grup': {
    '/ping': [
      'Tag seluruh penghuni grup.',
      async (client: wppconnect.Whatsapp, message: wppconnect.Message) => {
        const params = parseCommand(message.body || '')
        if (params.length <= 1 || params[1] === 'help') {
          const helpMsg = help(
            `
/ping all <alasan?>
/ping admin <alasan?>
/ping member <alasan?>
`,
            'Tag seluruh penghuni grup, atau admin/member saja.'
          )
          return client.sendText(message.from, helpMsg, {
            quotedMsg: message.id,
          })
        }

        const groupMembers = await getMembers(client, message)
        if (groupMembers) {
          const param1 = params[1]
          const alasan = params[2]
          const senderNumber = getSenderNumber(message)
          let msg = '*🔔 Ping*' + (alasan ? '' : readMore) + '\n\n'
          if (alasan) {
            msg += `> ${alasan}\n\n_@${senderNumber}_\n${readMore}\n`
          }
          const adminList = groupMembers.admins.map((admin) => `👑 @${admin.user}`).join('\n')
          const memberList = groupMembers.members.map((member) => `👤 @${member.id.user}`).join('\n')
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
          client.sendText(message.from, msg, {
            quotedMsg: message.id,
          })
        }
      },
    ],
  },
}

type CommandHandler = (client: wppconnect.Whatsapp, message: wppconnect.Message) => Promise<void>
export type CommandList = { [key: string]: [string, CommandHandler] }

export default commands
