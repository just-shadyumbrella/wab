import OpenAI from 'openai'
import { config } from 'dotenv'
import character from './character.js'

config()

let MEMORY_SLOT_LIMIT = 16

export function setMemorySlot(limit: number) {
  MEMORY_SLOT_LIMIT = limit
}

export function getMemorySlot() {
  return MEMORY_SLOT_LIMIT
}

export function resetMemorySlot(room: string, lang: keyof typeof character, charName: CharName) {
  memorySlots.delete(getMemoryKey(room, lang, charName))
}

// Map untuk menyimpan percakapan per karakter → key: `${lang}:${charName}`
const memorySlots = new Map<string, { role: 'user' | 'assistant'; content: string }[]>()

export type CharName = keyof typeof character.en | keyof typeof character.id

function getMemoryKey(room: string, lang: keyof typeof character, charName: CharName) {
  return `${room}:${lang}:${charName}`
}

// Tambahkan pesan ke memori karakter (dengan batas maksimal MEMORY_SLOT_LIMIT)
function updateMemory(
  room: string,
  lang: keyof typeof character,
  charName: CharName,
  role: 'user' | 'assistant',
  content: string
) {
  const key = getMemoryKey(room, lang, charName)
  if (!memorySlots.has(key)) {
    memorySlots.set(key, [])
  }
  const history = memorySlots.get(key)!
  history.push({ role, content })
  if (history.length > MEMORY_SLOT_LIMIT) {
    history.shift() // Buang paling lama (FIFO)
  }
}

// Markdown to WhatsApp format
function modelResponseFix(user: string, content: string): string {
  // Escape user for regex
  const escapedUser = user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 1. Markdown to WhatsApp format (bold & italic)
  // Replace bold (**text**) → *text*
  let result = content.replace(/\*\*(.*?)\*\*/g, '*$1*')
  // Replace italic (*text*) → _text_
  result = result.replace(/\*(.*?)\*/g, '_$1_')

  // 2. User mention replacement
  // Replace unformatted mentions of the user unless preceded by @, also with the literal word "user"
  const userPattern = new RegExp(`(?<!@)${escapedUser}\\b`, 'g')
  const genericUserPattern = /\buser\b/g

  let mentionFixApplied = false, userFixApplied = false
  result = result
    .replace(userPattern, () => {
      mentionFixApplied = true
      return `@${user}`
    })
    .replace(genericUserPattern, () => {
      mentionFixApplied = true
      return `@${user}`
    })

  if (mentionFixApplied) {
    console.warn('User mention `@628XXXXXXXXXX` fix has been made.')
  }

  if (userFixApplied) {
    console.warn('`user` mention fix has been made.')
  }

  // 3. Remove parentheses at start and end of the string
  const originalResult = result
  result = result.replace(/^\(/, '').replace(/\)$/, '')

  if (originalResult !== result) {
    console.warn('Parenthesis fix has been made.')
  }

  // 4. Remove leading and trailing parentheses
  result = result.replace(/^\(|\)$/g, '')

  return result
}


/**
 * Models are subject to change depends on free availability and suitness for roleplay chats.
 */
export enum Models {
  V3 = 'deepseek/deepseek-chat-v3-0324:free',
  Chimera = 'tngtech/deepseek-r1t-chimera:free',
  R1Q = 'deepseek/deepseek-r1-0528-qwen3-8b:free',
  R1 = 'deepseek/deepseek-r1-0528:free',
  Qwen = 'qwen/qwen3-235b-a22b:free',
  Nemo = 'mistralai/mistral-nemo:free',
  DeepHermes = 'nousresearch/deephermes-3-mistral-24b-preview:free',
  Dolphin = 'cognitivecomputations/dolphin3.0-mistral-24b:free',
  Gemma = 'google/gemma-3-27b-it:free',
  Exp = 'google/gemini-2.0-flash-exp:free', // Rate limited for some reason
  Nemotron3 = 'nvidia/llama-3.3-nemotron-super-49b-v1:free',
  Nemotron1 = 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
  Instruct = 'meta-llama/llama-3.3-70b-instruct:free',
  Scout = 'meta-llama/llama-4-scout:free',
  Maverick = 'meta-llama/llama-4-maverick:free',
}

const keys = process.env.OPEN_ROUTER?.split(',')

export async function chat(
  user: string,
  room: string,
  charName: CharName,
  lang: keyof typeof character,
  msg: string,
  modelOptions: OpenAI.ChatCompletionCreateParams
) {
  const content =
    lang === 'en'
      ? `You're roleplaying to this character as accurate as possible, so make the conversation as you're them:

${character.en[charName]}`
      : `[PERLU DIINGAT: Kamu berbicara dengan banyak {{user}}, setiap pesan dari pengguna selalu diawali dengan "@628XXXXXXXXXX", harap balas dengan menyebut nama mereka ("@628XXXXXXXXXX") agar jelas kepada siapa kamu menjawab.]

[Kamu sedang memerankan karakter ini seakurat mungkin, jadi buat percakapan seolah kau adalah mereka:]

${character.id[charName]}

[GUNAKAN BAHASA INDONESIA YANG BAIK DAN BENAR MULAI DARI SEKARANG]`

  if (keys) {
    for (const key of keys) {
      const ky = key.slice(0, 16) + '***' + key.slice(-8)
      try {
        console.log('Used key:', ky)
        const openai = new OpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: key,
        })
        const memoryKey = getMemoryKey(room, lang, charName)
        const history = memorySlots.get(memoryKey) || []
        const options: OpenAI.ChatCompletionCreateParams = {
          ...modelOptions,
          messages: [
            { role: 'system', content: content },
            ...history, // ← Tambahkan seluruh memori sebelumnya
            { role: 'user', content: `@${user}: ${msg}` }, // ← Tambahkan pesan terbaru
          ],
          stream: false,
        }
        console.log('OpenAI:', options)
        const completion = await openai.chat.completions.create(options)
        const ctn = completion.choices[0].message.content

        // Update memori dengan pesan baru dan balasan dari AI
        updateMemory(room, lang, charName, 'user', msg)
        updateMemory(room, lang, charName, 'assistant', ctn || '')

        return modelResponseFix(user, ctn || '')
      } catch (error) {
        console.error(`Error using key ${ky}:`, error)
      }
    }
    throw new Error('All keys are exhausted or failed')
  } else {
    throw new Error('No key provided')
  }
}
