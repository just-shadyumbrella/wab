function parseMsgArgs(msg: string) {
  const commandRegex = /^\/(\w+)\s+(\w+)\s+(.+?)\s+"(.+)"$/
  return msg.match(commandRegex)
}

const obj = { foo: 1, bar: 2 }
const arr = ['foo', 'bar']

const bigObj = {}
const bigArr = []
for (let i = 0; i < 1_000_000; i++) {
  bigObj['key' + i] = i
  bigArr.push('key' + i)
}

console.time('object')
let foundObj = bigObj['key999999']
console.timeEnd('object')

console.time('array')
let foundArr = bigArr.indexOf('key999999')
console.timeEnd('array')
