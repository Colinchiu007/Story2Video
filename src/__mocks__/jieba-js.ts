export function cut(sentence: string): Promise<string[]> {
  return Promise.resolve(sentence.split(''));
}
