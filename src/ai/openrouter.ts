import OpenAI from 'openai'
import { config } from 'dotenv'
import character from './character.js'

config()

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPEN_ROUTER,
})

export async function chat(msg: string) {
  const completion = await openai.chat.completions.create({
    model: 'meta-llama/llama-3.3-8b-instruct:free',
    messages: [
      {
        role: 'system',
        content:
          `You will roleplaying as this character accurately:
${character.description}

Example Dialogs:
${character.mes_example}
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
    max_completion_tokens: 1024,
  })
  console.log('Result:', completion)
  return completion.choices[0].message.content
}

// chat('Hai Lumine, apa kabar?')
