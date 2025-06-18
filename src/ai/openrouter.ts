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

export async function chat(charName: keyof typeof character, msg: string, modelOptions: OpenAI.ChatCompletionCreateParams) {
  const completion = await openai.chat.completions.create({
    ...modelOptions,
    messages: [
      {
        role: 'system',
        content: `You're roleplaying to this character as accurate as possible so make the conversation as you're them:

${character[charName]}`,
      },
      {
        role: 'user',
        content: msg,
      },
    ],
    stream: false
  })
  console.log('Result:', completion)
  return (completion as OpenAI.ChatCompletion).choices[0].message.content
}
// chat('Hai, apa kabar?')
