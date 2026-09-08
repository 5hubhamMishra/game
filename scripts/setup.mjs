import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'

execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--include=dev'], { stdio: 'inherit' })
if (!existsSync('.env') && existsSync('.env.example')) copyFileSync('.env.example', '.env')
console.log('\nDependencies installed. Run `npm run doctor`, then `npm run dev`.')
console.log('For online local play, start PostgreSQL with `docker compose up -d postgres`.')
