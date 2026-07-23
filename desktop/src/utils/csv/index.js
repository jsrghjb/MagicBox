/**
 * Tiny RFC-4180-ish CSV parser/serializer.
 * Handles quoted fields, escaped double-quotes, CRLF, and embedded commas.
 * For batch automation variable tables this is plenty.
 */

function parseLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        }
        else {
          inQuotes = false
        }
      }
      else {
        cur += ch
      }
    }
    else if (ch === '"') {
      inQuotes = true
    }
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    }
    else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function parseCsv(text = '') {
  if (!text) {
    return []
  }
  // Drop BOM
  const cleaned = text.replace(/^\uFEFF/, '')
  // Split on newlines, but allow quoted newlines to be merged across lines
  const records = []
  let buffer = ''
  let inQuotes = false

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (ch === '"') {
      // toggle (don't toggle on escaped "" - simple approximation: count)
      inQuotes = !inQuotes
      buffer += ch
    }
    else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (buffer.length) {
        records.push(buffer)
        buffer = ''
      }
      // skip \n after \r
      if (ch === '\r' && cleaned[i + 1] === '\n') {
        i++
      }
    }
    else {
      buffer += ch
    }
  }
  if (buffer.length) {
    records.push(buffer)
  }
  return records.filter(Boolean).map(parseLine)
}

export function stringifyCsv(rows = []) {
  if (!rows.length) {
    return ''
  }
  return rows.map((cells) => {
    return cells.map((cell) => {
      const value = cell == null ? '' : String(cell)
      if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  }).join('\r\n')
}
