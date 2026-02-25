import { persistentAtom } from '@nanostores/persistent'

export const $gameOver = persistentAtom<boolean>('game-over', false, {
  encode: (value) => JSON.stringify(value),
  decode: (value) => JSON.parse(value)
});
export const setGameOver = (value: boolean) => {
  $gameOver.set(value);
}

export const $currentPgnId = persistentAtom<string>('current-pgn-id', '');
export const $currentLine = persistentAtom<string[]>('current-line', [], {
  encode: (value) => JSON.stringify(value),
  decode: (value) => JSON.parse(value)
})
export const $currentLineIdx = persistentAtom<number>('current-line-idx', 0, {
  encode: (value) => JSON.stringify(value),
  decode: (value) => JSON.parse(value)
})

export const setCurrentPgnId = (value: string) => {
  $currentPgnId.set(value);
}
export const setCurrentLine = (value: string[]) => {
  $currentLine.set(value);
}
export const addToCurrentLine = (value: string) => {
  $currentLine.set([...$currentLine.get(), value]);
}
export const setCurrentLineIdx = (value: number) => {
  $currentLineIdx.set(value);
}
