import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const iconifyJsonDir = join(require.resolve('@iconify/json/package.json'), '../json')

const collectionNames = [
  'bi',
  'cil',
  'famicons',
  'iconoir',
  'proicons',
  'qlementine-icons',
  'simple-line-icons',
  'solar',
  'uiw',
]

function loadIconifyCollection(name) {
  return JSON.parse(readFileSync(join(iconifyJsonDir, `${name}.json`), 'utf8'))
}

export const iconCollections = Object.fromEntries(
  collectionNames.map(name => [name, () => loadIconifyCollection(name)]),
)
