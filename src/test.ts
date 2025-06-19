function main() {
  for (const a of ['a', 'b', 'c', 'd']) {
    try {
      // Possibly faulty function
      if (a === 'b') return 'foo'
      console.log(a)
    } catch (error) {
      // Handle error
      console.error(error)
    }
  }
}

console.log(main())
