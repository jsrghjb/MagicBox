/**
 * ADB UI Tree (UIAutomator Dump) Helper
 * Parses Android XML hierarchy into structured nodes and provides query/locator utilities.
 */

const BOUNDS_REGEX = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/

/**
 * Parse bounds string "[left,top][right,bottom]" into rectangle object.
 */
export function parseBounds(boundsStr = '') {
  const match = String(boundsStr).match(BOUNDS_REGEX)
  if (!match) {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, centerX: 0, centerY: 0 }
  }

  const left = Number.parseInt(match[1], 10)
  const top = Number.parseInt(match[2], 10)
  const right = Number.parseInt(match[3], 10)
  const bottom = Number.parseInt(match[4], 10)
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  const centerX = Math.round(left + width / 2)
  const centerY = Math.round(top + height / 2)

  return { left, top, right, bottom, width, height, centerX, centerY }
}

/**
 * Fast XML parser for UIAutomator dump format.
 * Returns a flat array of nodes with parsed attributes and bounds.
 */
export function parseUiHierarchy(xmlString = '') {
  if (!xmlString || typeof xmlString !== 'string') {
    return []
  }

  const nodes = []
  // Matches all <node ... /> or <node ... >
  const nodeTagRegex = /<node\s+([^>]+?)\s*\/?>/gi
  let match

  while ((match = nodeTagRegex.exec(xmlString)) !== null) {
    const attrStr = match[1]
    const node = parseNodeAttributes(attrStr)
    if (node) {
      nodes.push(node)
    }
  }

  return nodes
}

function parseNodeAttributes(attrStr) {
  const attrRegex = /([\w-]+)="([^"]*)"/g
  const attrs = {}
  let match

  while ((match = attrRegex.exec(attrStr)) !== null) {
    attrs[match[1]] = match[2]
  }

  const bounds = parseBounds(attrs.bounds || '')

  return {
    index: Number.parseInt(attrs.index || '0', 10),
    text: attrs.text || '',
    resourceId: attrs['resource-id'] || '',
    className: attrs.class || '',
    package: attrs.package || '',
    contentDesc: attrs['content-desc'] || '',
    checkable: attrs.checkable === 'true',
    checked: attrs.checked === 'true',
    clickable: attrs.clickable === 'true',
    enabled: attrs.enabled === 'true',
    focusable: attrs.focusable === 'true',
    focused: attrs.focused === 'true',
    scrollable: attrs.scrollable === 'true',
    longClickable: attrs['long-clickable'] === 'true',
    bounds,
    rawAttrs: attrs,
  }
}

/**
 * Filter nodes by multiple criteria.
 */
export function findUiElements(nodes = [], query = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return []
  }

  const {
    text,
    textContains,
    textMatches,
    desc,
    descContains,
    descMatches,
    resourceId,
    resourceIdContains,
    className,
    package: pkgName,
    clickable,
    checked,
    minArea = 10,
  } = query

  const results = nodes.filter((node) => {
    // Filter out zero-sized or invisible nodes
    if (node.bounds.width * node.bounds.height < minArea) {
      return false
    }

    if (text !== undefined && text !== '') {
      const matchText = node.text.trim() === text.trim() || node.contentDesc.trim() === text.trim()
      if (!matchText) {
        return false
      }
    }

    if (textContains !== undefined && textContains !== '') {
      const target = textContains.toLowerCase()
      const matchText = node.text.toLowerCase().includes(target) || node.contentDesc.toLowerCase().includes(target)
      if (!matchText) {
        return false
      }
    }

    if (textMatches) {
      const reg = typeof textMatches === 'string' ? new RegExp(textMatches, 'i') : textMatches
      if (!reg.test(node.text) && !reg.test(node.contentDesc)) {
        return false
      }
    }

    if (desc !== undefined && desc !== '') {
      const matchDesc = node.contentDesc.trim() === desc.trim() || node.text.trim() === desc.trim()
      if (!matchDesc) {
        return false
      }
    }

    if (descContains !== undefined && descContains !== '') {
      const target = descContains.toLowerCase()
      const matchDesc = node.contentDesc.toLowerCase().includes(target) || node.text.toLowerCase().includes(target)
      if (!matchDesc) {
        return false
      }
    }

    if (descMatches) {
      const reg = typeof descMatches === 'string' ? new RegExp(descMatches, 'i') : descMatches
      if (!reg.test(node.contentDesc) && !reg.test(node.text)) {
        return false
      }
    }

    if (resourceId !== undefined && resourceId !== '') {
      if (node.resourceId !== resourceId && !node.resourceId.endsWith(`:id/${resourceId}`)) {
        return false
      }
    }

    if (resourceIdContains !== undefined && resourceIdContains !== '') {
      if (!node.resourceId.toLowerCase().includes(resourceIdContains.toLowerCase())) {
        return false
      }
    }

    if (className !== undefined && className !== '') {
      if (node.className !== className && !node.className.endsWith(className)) {
        return false
      }
    }

    if (pkgName !== undefined && pkgName !== '') {
      if (node.package !== pkgName) {
        return false
      }
    }

    if (clickable !== undefined && node.clickable !== clickable) {
      return false
    }

    if (checked !== undefined && node.checked !== checked) {
      return false
    }

    return true
  })

  if (results.length > 0) {
    return results
  }

  // Fallback: If searching for bottom bar publish / add button ("发布" or "➕" or "+")
  const searchKeyword = (text || textContains || desc || descContains || '').trim()
  if (searchKeyword.includes('发布') || searchKeyword.includes('➕') || searchKeyword.includes('+') || searchKeyword.includes('发笔记')) {
    // 1. Look for button containing 发笔记 / 发布
    const pubButtons = nodes.filter(n => (
      (n.text.includes('发笔记') || n.text.includes('发布') || n.contentDesc.includes('发笔记') || n.contentDesc.includes('发布'))
      && n.bounds.top > 1500
    ))
    if (pubButtons.length > 0) {
      return pubButtons
    }

    const bottomTabs = nodes.filter(n => (
      n.clickable
      && n.bounds.top >= 1800
      && n.bounds.height > 20
      && n.bounds.width > 50
    ))
    if (bottomTabs.length >= 3) {
      const sorted = [...bottomTabs].sort((a, b) => a.bounds.left - b.bounds.left)
      const centerIdx = Math.floor(sorted.length / 2)
      return [sorted[centerIdx]]
    }
  }

  // Fallback: If searching for title input field ("标题")
  if (searchKeyword.includes('标题')) {
    const editTexts = nodes.filter(n => (
      n.className.toLowerCase().includes('edittext')
      && n.bounds.top < 850
      && n.bounds.width > 200
    ))
    if (editTexts.length > 0) {
      return [editTexts[0]]
    }
  }

  // Fallback: If searching for content input field ("正文" or "描述")
  if (searchKeyword.includes('正文') || searchKeyword.includes('描述')) {
    const editTexts = nodes.filter(n => (
      n.className.toLowerCase().includes('edittext')
      && n.bounds.top >= 600
      && n.bounds.width > 200
    ))
    if (editTexts.length > 0) {
      return [editTexts[editTexts.length - 1]]
    }
  }

  return []
}

/**
 * Dump UI hierarchy XML from device via ADB.
 */
export async function dumpUiHierarchy(deviceId, adb) {
  const dumpRemotePath = '/sdcard/window_dump.xml'
  try {
    // Run uiautomator dump command (with --compressed for high speed) and cat the XML
    const xml = await adb.deviceShell(
      deviceId,
      `uiautomator dump --compressed ${dumpRemotePath} >/dev/null 2>&1 || uiautomator dump ${dumpRemotePath} >/dev/null 2>&1; cat ${dumpRemotePath}`,
    )

    return xml || ''
  }
  catch (err) {
    console.warn(`Failed to dump UI hierarchy for device ${deviceId}:`, err)
    return ''
  }
}

/**
 * Wait for a UI element matching query to appear on screen.
 */
export async function waitForUiElement(deviceId, adb, query, {
  timeout = 8000,
  interval = 600,
  signal = null,
  onLog = null,
} = {}) {
  const startTime = Date.now()

  while (!signal?.aborted && Date.now() - startTime <= timeout) {
    const xml = await dumpUiHierarchy(deviceId, adb)
    if (xml) {
      const nodes = parseUiHierarchy(xml)
      const matched = findUiElements(nodes, query)
      if (matched.length > 0) {
        return matched[0]
      }
    }

    if (signal?.aborted || Date.now() - startTime >= timeout) {
      break
    }

    await new Promise(resolve => setTimeout(resolve, interval))
  }

  return null
}

/**
 * Detect image items in media/album picker grid.
 * Sorts items top-to-bottom, left-to-right to accurately pick first N media items.
 */
export function findMediaPickerGrid(nodes = [], { maxCount = 1 } = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return []
  }

  // 1. Look for checkbox / select indicators in photo pickers (e.g. CheckBox, iv_select, check_view)
  const checkBoxes = nodes.filter((n) => {
    const id = n.resourceId.toLowerCase()
    const desc = n.contentDesc.toLowerCase()
    const cls = n.className.toLowerCase()
    return (
      (cls.includes('checkbox') || id.includes('check') || id.includes('select') || id.includes('indicator') || desc.includes('未选中') || desc.includes('选中') || desc.includes('选择'))
      && n.bounds.width > 20
      && n.bounds.height > 20
      && n.bounds.top > 150 // Exclude top action bar
    )
  })

  if (checkBoxes.length >= maxCount) {
    return sortGridNodes(checkBoxes).slice(0, maxCount)
  }

  // 2. Look for clickable ImageView / item layout nodes in album grid
  const imageViews = nodes.filter((n) => {
    const cls = n.className.toLowerCase()
    const id = n.resourceId.toLowerCase()
    const desc = n.contentDesc.toLowerCase()
    const isImageLike = cls.includes('imageview') || id.includes('thumb') || id.includes('photo') || id.includes('image') || id.includes('item') || desc.includes('图片') || desc.includes('照片')
    return (
      isImageLike
      && n.bounds.width >= 80
      && n.bounds.height >= 80
      && n.bounds.top > 250 // Exclude top action bar & filter tabs
    )
  })

  if (imageViews.length > 0) {
    const sorted = sortGridNodes(imageViews).slice(0, maxCount)
    return sorted.map((item) => {
      // Calculate top-right quadrant checkbox point
      const cornerOffsetX = Math.min(item.bounds.width * 0.22, 50)
      const cornerOffsetY = Math.min(item.bounds.height * 0.22, 50)
      return {
        ...item,
        selectPoint: {
          x: Math.round(item.bounds.right - cornerOffsetX),
          y: Math.round(item.bounds.top + cornerOffsetY),
        },
      }
    })
  }

  return []
}

function sortGridNodes(nodes = []) {
  return [...nodes].sort((a, b) => {
    // Top-to-bottom within roughly same row threshold (40px)
    if (Math.abs(a.bounds.top - b.bounds.top) > 40) {
      return a.bounds.top - b.bounds.top
    }
    // Left-to-right
    return a.bounds.left - b.bounds.left
  })
}
