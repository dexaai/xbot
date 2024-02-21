import pThrottle from 'p-throttle'
import type { Simplify } from 'type-fest'

import type * as types from './types.js'
import { BotError } from './bot-error.js'
import { assert } from './utils.js'

// TODO: verify updated twitter rate limits
const throttle = pThrottle({
  limit: 1,
  interval: 1000
})

export type CreateTweetParams = Simplify<
  Parameters<types.TwitterClient['tweets']['createTweet']>[0]
>

export const createTweet = throttle(createTweetImpl)

async function createTweetImpl(
  params: CreateTweetParams,
  ctx: types.Context
): Promise<types.CreatedTweet> {
  assert(!ctx.dryRun)

  try {
    const res = await ctx.twitterClient.tweets.createTweet(params)
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
