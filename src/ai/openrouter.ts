import OpenAI from 'openai'
import { config } from 'dotenv'
import character from './character.js'

config()

export enum Models {
  V3 = 'deepseek/deepseek-chat-v3-0324:free',
  Chimera = 'tngtech/deepseek-r1t-chimera:free',
  R1 = 'deepseek/deepseek-r1-0528:free',
  Nemo = 'mistralai/mistral-nemo:free',
  DeepHermes = 'nousresearch/deephermes-3-mistral-24b-preview:free',
  Dolphin = 'cognitivecomputations/dolphin3.0-mistral-24b:free',
  Gemma = 'google/gemma-3-27b-it:free',
  Flash = 'google/gemini-2.0-flash-exp:free',
  Nemotron = 'nvidia/llama-3.3-nemotron-super-49b-v1:free',
  Instruct = 'meta-llama/llama-3.3-70b-instruct:free',
  Scout = 'meta-llama/llama-4-scout:free',
  Maverick = 'meta-llama/llama-4-maverick:free',
}

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPEN_ROUTER,
})

export async function chat(charName: keyof typeof character, model: Models, msg: string) {
  const completion = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'system',
        content: `Roleplay to this character as accurate as possible:

${character[charName]}`,
      },
      {
        role: 'user',
        content: msg,
      },
    ],
    temperature: 0.9, // Bikin lebih variatif
    // top_p: 0.95, // Sampling untuk kreativitas
    frequency_penalty: 0, // Biasanya 0 untuk roleplay
    presence_penalty: 0.2, // Dorong ide baru sedikit
    max_completion_tokens: 768,
  })
  console.log('Result:', completion)
  return completion.choices[0].message.content
}

// chat('Hai, apa kabar?')
