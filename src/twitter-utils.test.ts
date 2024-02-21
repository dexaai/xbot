import test from 'ava'

import {
  getTweetUrl,
  maxTwitterId,
  minTwitterId,
  tweetComparator,
  tweetIdComparator
} from './twitter-utils.js'

test('maxTwitterId', (t) => {
  t.is(maxTwitterId('123', '456'), '456')
  t.is(maxTwitterId('1230', '999'), '1230')
  t.is(maxTwitterId('', '999'), '999')
  t.is(maxTwitterId('999', ''), '999')
  t.is(maxTwitterId('', undefined), undefined)
  t.is(maxTwitterId('948392', '948392'), '948392')
})

test('minTwitterId', (t) => {
  t.is(minTwitterId('123', '456'), '123')
  t.is(minTwitterId('1230', '999'), '999')
  t.is(minTwitterId('', '999'), '999')
  t.is(minTwitterId('999', ''), '999')
  t.is(minTwitterId('', undefined), undefined)
  t.is(minTwitterId('948392', '948392'), '948392')
})

test('tweetIdComparator', (t) => {
  t.is(tweetIdComparator('100', '200'), -1)
  t.is(tweetIdComparator('3000', '999'), 1)
  t.is(tweetIdComparator('3001', '3001'), 0)
})

test('tweetComparator', (t) => {
  t.is(tweetComparator({ id: '100' }, { id: '200' }), -1)
  t.is(tweetComparator({ id: '3000' }, { id: '999' }), 1)
  t.is(tweetComparator({ id: '3001' }, { id: '3001' }), 0)

  t.deepEqual(
    [
      { id: '5' },
      { id: '1000' },
      { id: '9999' },
      { id: '5' },
      { id: '15' },
      { id: '500' }
    ].sort(tweetComparator),
    [
      { id: '5' },
      { id: '5' },
      { id: '15' },
      { id: '500' },
      { id: '1000' },
      { id: '9999' }
    ]
  )
})

test('getTweetUrl', async (t) => {
  t.is(
    getTweetUrl({ username: 'foo', id: '123' }),
    'https://twitter.com/foo/status/123'
  )

  t.is(
    getTweetUrl({ username: 'foo-abc', id: '12345678' }),
    'https://twitter.com/foo-abc/status/12345678'
  )

  t.is(getTweetUrl({ id: '123' }), undefined)
  t.is(getTweetUrl({ username: 'foo', id: '' }), undefined)
  t.is(getTweetUrl({ username: 'foo' }), undefined)
  t.is(getTweetUrl({ username: '', id: '855' }), undefined)
})
