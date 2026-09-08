import { execFileSync } from 'node:child_process'

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' }).trim()
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'verify'])
console.log(`\nBranch: ${run('git', ['branch', '--show-current'])}`)
console.log(`SHA: ${run('git', ['rev-parse', 'HEAD'])}`)
console.log('\nWorktree:')
console.log(run('git', ['status', '--short']) || 'clean')
console.log('\nVerification passed. Review and commit this phase, then push through the configured protected workflow.')
