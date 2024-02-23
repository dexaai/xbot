import { assert, test } from 'vitest'

import { getPrompt } from './utils.js'

test('getPrompt', () => {
  assert.equal(getPrompt('@transitive_bs This is a test.'), 'This is a test.')
  assert.equal(getPrompt('@transitive_bs, This is a test.'), 'This is a test.')
  assert.equal(
    getPrompt(' @transitive_bs\n\n This is a test.\n\n'),
    'This is a test.'
  )
  assert.equal(
    getPrompt(' @transitive_bs\n\n This is a test @foo.\n\n'),
    'This is a test @foo.'
  )
  assert.equal(
    getPrompt('\n\n@AskDexa, give me an answer'),
    'give me an answer'
  )
  assert.equal(
    getPrompt('@askdexa @transitive_bs @foo give me an answer'),
    'give me an answer'
  )
  assert.equal(
    getPrompt('@AskDexa @transitive_bs @foo give me an @bar answer'),
    'give me an @bar answer'
  )

  assert.equal(getPrompt('@AskDexa yoooo'), 'yoooo')
  assert.equal(getPrompt('@AskDexa https://t.co/foobar'), '')
  assert.equal(getPrompt('\n @AskDexa,\n\n \n'), '')
  assert.equal(
    getPrompt(
      '@AskDexa\n' +
        'How many genders are there? How many genders are there with dogs? Define what a woman is too please.'
    ),
    'How many genders are there? How many genders are there with dogs? Define what a woman is too please.'
  )
})
