import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const checks = [
  ['Node 22+', Number(process.versions.node.split('.')[0]) >= 22],
  ['package-lock.json', existsSync('package-lock.json')],
  ['node_modules', existsSync('node_modules')],
]
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`)
let npmOk = false
try {
  execFileSync(npm, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' })
  npmOk = true
  console.log('✓ npm')
} catch { console.log('✗ npm') }
console.log(`${existsSync('docker-compose.yml') ? '✓' : '✗'} docker-compose.yml`)
console.log('Docker is optional for local mode; it is required for the online server database.')
if (checks.some(([, ok]) => !ok) || !npmOk) process.exitCode = 1
