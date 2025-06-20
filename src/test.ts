function modelResponseFix(user: string, content: string) {
  const boldFix = content.replaceAll('**', '<b>')
  const italicFix = boldFix.replaceAll('*', '<i>')

  const userMentionFix = (() => {
    // Escape user string for RegExp
    const escapedUser = user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<!@)${escapedUser}\\b`);
    if (pattern.test(italicFix)) {
      console.warn('User mention fix has been made.');
      return italicFix.replace(pattern, `@${user}`);
    }
    return italicFix;
  })();

  const parenthesis = (() => {
    const pattern = /^\(/g,
      pattern2 = /\)$/g;
    let result = userMentionFix;
    let changed = false;
    if (pattern.test(result)) {
      changed = true;
      result = result.replace(pattern, `\`@${user}\``);
    }
    if (pattern2.test(result)) {
      changed = true;
      result = result.replace(pattern2, `\`@${user}\``);
    }
    if (changed) {
      console.warn('Parenthesis fix has been made.');
    }
    return result;
  })();

  return parenthesis.replaceAll('<b>', '*').replaceAll('<i>', '_')
}
const test = "*Wanderer mengangkat alisnya, terdengar sedikit terhibur oleh pertanyaan aneh itu.*\n\n@6285194776882: \"Heh... 'Anak senja'? Aku lebih mirip anak abadi sebenarnya,\" *jawabnya dengan nada datar tapi ada sedikit geli.* \"Tapi kalau kamu bertanya apakah aku suka sore hari, cuaca di Serenitea Pot selalu sama - cerah dengan angin sepoi-sepoi.\" \n\n*Diam-diam berpikir pertanyaan itu agak konyol tapi lumayan kreatif.*"
console.log(modelResponseFix('6285194776882', test))