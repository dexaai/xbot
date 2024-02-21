import pThrottle from 'p-throttle'
import type { Simplify } from 'type-fest'

import * as types from './types.js'
import { BotError } from './bot-error.js'
import { assert } from './utils.js'

// TODO: verify updated twitter rate limits
const throttle = pThrottle({
  limit: 1,
  interval: 1000
})

export type CreateTweetBody = Simplify<
  Parameters<types.TwitterClient['tweets']['createTweet']>[0]
>

export const createTweet = throttle(createTweetImpl)

async function createTweetImpl(
  body: CreateTweetBody,
  ctx: types.Context
): Promise<types.CreatedTweet> {
  assert(!ctx.dryRun)

  try {
    const res = await ctx.twitterClient.tweets.createTweet(body)
    const tweet = res?.data

    if (!tweet?.id) {
      throw new Error('invalid createTweet response')
    }

    return tweet
  } catch (err: any) {
    console.error('error creating tweet', JSON.stringify(err, null, 2))

    if (err.status === 403) {
      // user may have deleted the tweet we're trying to respond to
      throw new BotError(
        err.error?.detail || `error creating tweet: 403 forbidden`,
        {
          type: 'twitter:forbidden',
          isFinal: true,
          cause: err
        }
      )
    } else if (err.status === 400) {
      if (
        /value passed for the token was invalid/i.test(
          err.error?.error_description
        )
      ) {
        throw new BotError(`error creating tweet: invalid auth token`, {
          type: 'twitter:auth',
          cause: err
        })
      }
    } else if (err.status === 429) {
      throw new BotError(`error creating tweet: too many requests`, {
        type: 'twitter:rate-limit',
        cause: err
      })
    }

    if (err.status >= 400 && err.status < 500) {
      throw new BotError(
        `error creating tweet: ${err.status} ${
          err.error?.description || err.toString()
        }`,
        {
          type: 'twitter:unknown',
          isFinal: true,
          cause: err
        }
      )
    } else if (err.status >= 500) {
      throw new BotError(
        `error creating tweet: ${err.status} ${
          err.error?.description || err.toString()
        }`,
        {
          type: 'twitter:unknown',
          isFinal: false,
          cause: err
        }
      )
    }

    throw err
  }
}

/**
 * Returns the larger of two Twitter IDs, which is used in several places to
 * keep track of the most recent tweet we've seen or processed.
 */
export function maxTwitterId(
  tweetIdA?: string,
  tweetIdB?: string
): string | undefined {
  if (!tweetIdA && !tweetIdB) {
    return undefined
  }

  if (!tweetIdA) {
    return tweetIdB
  }

  if (!tweetIdB) {
    return tweetIdA
  }

  if (tweetIdA.length < tweetIdB.length) {
    return tweetIdB
  } else if (tweetIdA.length > tweetIdB.length) {
    return tweetIdA
  }

  if (tweetIdA < tweetIdB) {
    return tweetIdB
  }

  return tweetIdA
}

/**
 * Returns the smaller of two Twitter IDs, which is used in several places to
 * keep track of the least recent tweet we've seen or processed.
 */
export function minTwitterId(
  tweetIdA?: string,
  tweetIdB?: string
): string | undefined {
  if (!tweetIdA && !tweetIdB) {
    return undefined
  }

  if (!tweetIdA) {
    return tweetIdB
  }

  if (!tweetIdB) {
    return tweetIdA
  }

  if (tweetIdA.length < tweetIdB.length) {
    return tweetIdA
  } else if (tweetIdA.length > tweetIdB.length) {
    return tweetIdB
  }

  if (tweetIdA < tweetIdB) {
    return tweetIdA
  }

  return tweetIdB
}

/**
 * JS comparator function for comparing two Tweet IDs.
 */
export function tweetIdComparator(a?: string, b?: string): number {
  if (a === b) {
    return 0
  }

  const max = maxTwitterId(a, b)
  if (max === a) {
    return 1
  } else {
    return -1
  }
}

/**
 * JS comparator function for comparing two tweet-like objects.
 */
export function tweetComparator(
  tweetA: { id?: string },
  tweetB: { id?: string }
): number {
  const a = tweetA.id
  const b = tweetB.id
  return tweetIdComparator(a, b)
}

export function getTweetUrl({
  username,
  id
}: {
  username?: string
  id?: string
}): string | undefined {
  if (username && id) {
    return `https://twitter.com/${username}/status/${id}`
  }
}
