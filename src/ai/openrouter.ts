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

// Map untuk menyimpan percakapan per karakter → key: `${lang}:${charName}`
const memorySlots = new Map<string, { role: 'user' | 'assistant'; content: string }[]>()

type CharName = keyof typeof character.en | keyof typeof character.id

function getMemoryKey(lang: keyof typeof character, charName: CharName) {
  return `${lang}:${charName}`
}

// Tambahkan pesan ke memori karakter (dengan batas maksimal MEMORY_SLOT_LIMIT)
function updateMemory(
  lang: keyof typeof character,
  charName: CharName,
  role: 'user' | 'assistant',
  content: string
) {
  const key = getMemoryKey(lang, charName)
  if (!memorySlots.has(key)) {
    memorySlots.set(key, [])
  }
  const history = memorySlots.get(key)!
  history.push({ role, content })
  if (history.length > MEMORY_SLOT_LIMIT) {
    history.shift() // Buang paling lama (FIFO)
  }
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

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPEN_ROUTER,
})

export async function chat(
  charName: CharName | keyof typeof character.id,
  lang: keyof typeof character,
  msg: string,
  modelOptions: OpenAI.ChatCompletionCreateParams
) {
  const content =
    lang === 'en'
      ? `You're roleplaying to this character as accurate as possible, so make the conversation as you're them:

${character.en[charName]}`
      : `Kamu sedang memerankan karakter ini seakurat mungkin, jadi buat percakapan seolah kau adalah mereka:

${character.id[charName]}`

  const memoryKey = getMemoryKey(lang, charName)
  const history = memorySlots.get(memoryKey) || []

  const completion = await openai.chat.completions.create({
    ...modelOptions,
    messages: [
      { role: 'system', content: content },
      ...history, // ← Tambahkan seluruh memori sebelumnya
      { role: 'user', content: msg }, // ← Tambahkan pesan terbaru
    ],
    stream: false,
  })

  const response = completion.choices[0].message.content

  // Update memori dengan pesan baru dan balasan dari AI
  updateMemory(lang, charName, 'user', msg)
  updateMemory(lang, charName, 'assistant', response || '')

  return response
}

