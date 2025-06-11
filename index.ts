import wppconnect from '@wppconnect-team/wppconnect'
import commands, { CommandList } from './src/commands.js'

console.info('Collecting commands...')
console.time('Commands collected')

// FLATTEN FOR FAST LOOKUP
type CommandEntry = {
  menu: string
  description: string
  handler: (client: wppconnect.Whatsapp, message: wppconnect.Message) => Promise<void>
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
}

try {
  const client = await wppconnect.create(config)
  client.onStateChange((state) => {
    if (state === 'CONNECTED') {
      const phoneNumber = process.env.PHONE_NUMBER
      if (phoneNumber) {
        client.sendText(phoneNumber + '@c.us', 'Automatic client connected successfully.')
      }
    }
  })
  client.onAnyMessage(async (message) => {
    console.log(message)
    const msg = message.body
    if (msg) {
      const i = msg.indexOf(' ')
      const incomingCmd = i > -1 ? msg.substring(0, i) : msg
      const entry = commandTable[incomingCmd]
      if (entry) {
        await entry.handler(client, message)
      } else {
        // Unknown command
      }
    }
  })
} catch (err) {
  console.error(err)
}
