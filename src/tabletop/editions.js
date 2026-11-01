import { VERSION } from '../expedition/cards.js'

export const CURRENT_EDITION = VERSION
export function editionForPath(pathname) {
  const page = pathname.split('/')[1]
  return page === 'original' ? 'original-v2' : page === 'expedition-v1' ? 'expedition-v1' : CURRENT_EDITION
}
export const editionPath = edition => edition === 'original-v2' ? '/original' : edition === 'expedition-v1' ? '/expedition-v1' : '/expedition'
export const seatStorageKey = edition => edition === 'original-v2' ? 'apocalypse-tabletop-seat-v1' : 'apocalypse-' + edition + '-seat'
