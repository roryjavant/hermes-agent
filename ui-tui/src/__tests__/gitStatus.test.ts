import { describe, expect, it } from 'vitest'

import { parseGitStatus } from '../hooks/useGitBranch.js'

describe('parseGitStatus', () => {
  it('parses a clean branch', () => {
    expect(parseGitStatus('## main\n')).toEqual({ ahead: 0, behind: 0, branch: 'main', changed: 0 })
  })

  it('parses dirty files and ahead/behind counts', () => {
    expect(parseGitStatus('## main...origin/main [ahead 2, behind 1]\n M src/app.ts\n?? notes.md\n')).toEqual({
      ahead: 2,
      behind: 1,
      branch: 'main',
      changed: 2
    })
  })

  it('hides detached HEAD labels', () => {
    expect(parseGitStatus('## HEAD (no branch)\n')).toEqual({ ahead: 0, behind: 0, branch: null, changed: 0 })
  })

  it('keeps dotted branch names intact', () => {
    expect(parseGitStatus('## release/1.2...origin/release/1.2\n')).toEqual({
      ahead: 0,
      behind: 0,
      branch: 'release/1.2',
      changed: 0
    })
  })
})
