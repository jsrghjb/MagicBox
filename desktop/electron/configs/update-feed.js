export const UPDATE_OWNER = 'jsrghjb'
export const UPDATE_REPO = 'MagicBox'

export const UPDATE_FEED = {
  provider: 'github',
  owner: UPDATE_OWNER,
  repo: UPDATE_REPO,
  private: false,
  releaseType: 'release',
  vPrefixedTagName: true,
  updaterCacheDirName: 'magicbox-updater',
}

export const DOWNLOAD_PAGE = `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/latest`
