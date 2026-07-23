import { exec } from 'node:child_process'
import crypto from 'node:crypto'

function execCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => {
      if (err) {
        resolve('')
      }
      else {
        resolve(stdout.trim())
      }
    })
  })
}

export async function getMachineId() {
  let rawId = ''
  if (process.platform === 'win32') {
    // 1. Try PowerShell to get ComputerSystemProduct UUID (modern & robust)
    rawId = await execCommand('powershell -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"')
    rawId = rawId.trim()

    // 2. Fallback to registry MachineGuid (extremely stable, generated at Windows install)
    if (!rawId || rawId.includes('FFFFFFFF') || rawId.toLowerCase() === 'to be filled by o.e.m.') {
      const regOut = await execCommand('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid')
      const match = regOut.match(/MachineGuid\s+REG_SZ\s+([A-Fa-f0-9-]+)/)
      if (match) {
        rawId = match[1].trim()
      }
    }

    // 3. Fallback to WMIC csproduct
    if (!rawId || rawId.includes('FFFFFFFF') || rawId.toLowerCase() === 'to be filled by o.e.m.') {
      rawId = await execCommand('wmic csproduct get uuid')
      if (rawId) {
        rawId = rawId.replace(/UUID/i, '').trim()
      }
    }

    // 4. Fallback to WMIC bios serial
    if (!rawId || rawId.includes('FFFFFFFF') || rawId.toLowerCase() === 'to be filled by o.e.m.') {
      rawId = await execCommand('wmic bios get serialnumber')
      if (rawId) {
        rawId = rawId.replace(/SerialNumber/i, '').trim()
      }
    }
  }
  else if (process.platform === 'darwin') {
    const ioreg = await execCommand('ioreg -rd1 -c IOPlatformExpertDevice')
    const match = ioreg.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)
    if (match) {
      rawId = match[1]
    }
  }
  else {
    // Linux
    rawId = await execCommand('cat /etc/machine-id || cat /var/lib/dbus/machine-id')
  }

  // Fallback to username + platform + home dir if everything else fails
  if (!rawId) {
    rawId = `${process.env.USERNAME || process.env.USER || ''}-${process.platform}-${process.arch}`
  }

  // Hash it to generate a clean, fixed-size fingerprint
  const hash = crypto.createHash('sha256').update(rawId).digest('hex').substring(0, 32).toUpperCase()
  // Format as 8-8-8-8
  return `${hash.substring(0, 8)}-${hash.substring(8, 16)}-${hash.substring(16, 24)}-${hash.substring(24, 32)}`
}
