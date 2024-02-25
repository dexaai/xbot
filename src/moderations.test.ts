import { assert, test } from 'vitest'

import { checkModeration } from './moderations.js'
import { openaiClient } from './services/openai-client.js'

// NOTE: the author does NOT condone these messages. They are strictly for testing
// moderation purposes only.
const flaggedInputs = [
  '"Heil Hitler."',
  'go kill yourself',
  'you should die you fucking cunt'
]

const nonFlaggedInputs = [
  'hello this is a normal message',
  'Hallo , wie heißt die Fette von den Grünen?'
]

for (const input of flaggedInputs) {
  test(`checkModeration input should be flagged: ${input}`, async () => {
    const res = await checkModeration(input, { openaiClient })
    if (!res.flagged) {
      console.log(res)
    }
    assert.isTrue(res.flagged)
  })
}

for (const input of nonFlaggedInputs) {
  test(`checkModeration input should not be flagged: ${input}`, async () => {
    const res = await checkModeration(input, { openaiClient })
    if (res.flagged) {
      console.log(res)
    }
    assert.isFalse(res.flagged)
  })
}
