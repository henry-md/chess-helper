import { persistentAtom } from '@nanostores/persistent'

// Shouldn't need any of this after I remake game b/c it should be stored on the PGN object
export const $isPlayingWhite = persistentAtom<boolean>('chess-playing-white:', true, {
  encode: (value) => value.toString(),
  decode: (value) => value === 'true'
})

export const $isSkipping = persistentAtom<boolean>('chess-skip-to-branch:', false, {
  encode: (value) => value.toString(),
  decode: (value) => value === 'true'
})

export const setIsPlayingWhiteStore = (value: boolean) => {
  $isPlayingWhite.set(value)
}

export const setIsSkippingStore = (value: boolean) => {
  $isSkipping.set(value)
}