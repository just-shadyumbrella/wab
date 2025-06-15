import { create, all } from 'mathjs'

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


const math = create(all)

// ...existing code...
const param = parseCommand('/math 1 GiB to MiB')
param.shift()
console.log(math.evaluate(param.join(' ')))
// ...existing code...