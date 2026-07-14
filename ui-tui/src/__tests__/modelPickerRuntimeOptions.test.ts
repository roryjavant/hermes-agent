import { describe, expect, it } from 'vitest'

import { nextReasoningEffort, REASONING_EFFORTS } from '../components/modelPicker.js'

describe('ModelPicker runtime options', () => {
  it('cycles through every supported reasoning effort and wraps cleanly', () => {
    for (let index = 0; index < REASONING_EFFORTS.length; index += 1) {
      const current = REASONING_EFFORTS[index]!
      const expected = REASONING_EFFORTS[(index + 1) % REASONING_EFFORTS.length]!

      expect(nextReasoningEffort(current)).toBe(expected)
    }
  })

  it('defaults an unknown effort to the first supported option', () => {
    expect(nextReasoningEffort('provider-default')).toBe('none')
  })
})
