import wppconnect from '@wppconnect-team/wppconnect'
import { sendText, getSenderNumber, resolveIncomingChatId, commandTable, ownerCommands } from './src/commands.js'

// Start timer anchor
const startTime = Date.now()

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

export async function shutdown(
  client: wppconnect.Whatsapp,
  //@ts-ignore
  message: wppconnect.Message = { from: process.env.PHONE_NUMBER || '' }
) {
  await sendText('Sayonara!', client, message, false)
  console.warn('Shutdown triggered')
  client.close()
  console.info('Client closed, finalizing...')
  return process.exit(0)
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
    return console.log('Revoked message:', message)
  })
  client.onStateChange(async (state) => {
    if (state === 'CONNECTED') {
      const phoneNumber = process.env.PHONE_NUMBER
      if (phoneNumber) {
        return await client.sendText(phoneNumber + '@c.us', `Automatic client successfully connected at ${Date}.`)
      }
    }
  })
  client.onAnyMessage(async (message) => {
    const msg = message.caption || message.body || ''
    if (msg.slice(0, 1) === '/') {
      console.log('onAnyMessage:', message)
      const i = msg.indexOf(' ')
      const incomingCmd = i > -1 ? msg.substring(0, i) : msg
      const entry = commandTable[incomingCmd]
      if (entry) {
        client.startTyping(resolveIncomingChatId(message))
        try {
          console.time('Request handled')
          await entry.handler(client, message)
          console.timeEnd('Request handled')
        } catch (err) {
          console.error('onAnyMessage error:', err)
          throw err
        }
        client.stopTyping(resolveIncomingChatId(message))
      } else {
        // This is owner command, usually hidden from menu
        if (process.env.OWNER_NUMBER?.split(',').includes(getSenderNumber(message))) {
          try {
            console.time('Owner request handled')
            ownerCommands[incomingCmd](client, message)
            console.timeEnd('Owner request handled')
          } catch (err) {
            console.error('Owner onAnyMessage error:', err)
            throw err
          }
        }
      }
    }
  })
} catch (err) {
  console.error(err)
}
