import OpenAI from 'openai'
import { config } from 'dotenv'
import character from './character.js'

config()

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPEN_ROUTER,
})

export async function chat(charId: number, msg: string) {
  const completion = await openai.chat.completions.create({
    model: 'meta-llama/llama-3.3-8b-instruct:free',
    messages: [
      {
        role: 'system',
        content:
          `Peranmu adalah memerankan karakter berikut dengan akurat:
${character[charId].description}

Contoh dialog karakter:
${character[charId].mes_example}
`,
      },
      {
        role: 'user',
        content: msg,
      },
    ],
    temperature: 0.9, // Bikin lebih variatif
    top_p: 0.95, // Sampling untuk kreativitas
    frequency_penalty: 0, // Biasanya 0 untuk roleplay
    presence_penalty: 0.2, // Dorong ide baru sedikit
    max_completion_tokens: 512,
  })
  console.log('Result:', completion)
  return completion.choices[0].message.content
}

// chat('Hai Lumine, apa kabar?')
