import wppconnect from '@wppconnect-team/wppconnect'
import commands, { sendText, getSenderNumber, CommandHandler } from './src/commands.js'

// Start timer anchor
const startTime = Date.now()

console.info('Collecting commands...')
console.time('Commands collected')

// FLATTEN FOR FAST LOOKUP
type CommandEntry = {
  menu: string
  description: string
  handler: CommandHandler
}
const commandTable: { [cmd: string]: CommandEntry } = {}
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

const config: wppconnect.CreateOptions = {
  session: 'session',
  autoClose: 0,
  headless: process.env.HEADLESS !== 'false',
  browserArgs: ['--no-sandbox', '--disable-encryption', '--disable-machine-id'],
  debug: process.env.DEBUG === 'true',
  phoneNumber: process.env.PHONE_NUMBER,
  catchLinkCode: (str) => console.log('Pairing code: ' + str),
  puppeteerOptions: {
    timeout: 0,
  },
}

async function shutdown(
  client: wppconnect.Whatsapp,
  //@ts-ignore
  message: wppconnect.Message = { from: process.env.PHONE_NUMBER || '' }
) {
  await sendText('Sayonara!', client, message, false)
  console.warn('Shutdown triggered')
  client.close()
  console.info('Client closed, finalizing...')
  process.exit(0)
}

try {
  const client = await wppconnect.create(config)
  // Timeout maximum uptime 5:50
  ;(async function tick() {
    const time = (Date.now() - startTime) / 1000
    if (time > 60 * 60 * (5 + 50 / 60)) {
      await shutdown(client)
    } else {
      setTimeout(tick, 10000)
    }
  })()
  client.onRevokedMessage(async (message) => {
    console.log('Revoked message:', message)
  })
  client.onStateChange((state) => {
    if (state === 'CONNECTED') {
      const phoneNumber = process.env.PHONE_NUMBER
      if (phoneNumber) {
        client.sendText(phoneNumber + '@c.us', 'Automatic client successfully connected.')
      }
    }
  })
  client.onAnyMessage(async (message) => {
    console.log('Retrieve message:', message)
    const msg = message.caption || message.body
    if (msg) {
      const i = msg.indexOf(' ')
      const incomingCmd = i > -1 ? msg.substring(0, i) : msg
      const entry = commandTable[incomingCmd]
      if (entry) {
        await entry.handler(client, message)
      } else {
        // This is owner command, usually hidden from menu
        if (process.env.OWNER_NUMBER?.split(',').includes(getSenderNumber(message))) {
          if (incomingCmd === '/shutdown') {
            await shutdown(client, message)
          }
        }
      }
    }
  })
} catch (err) {
  console.error(err)
}
