import pThrottle from 'p-throttle'
import type { Simplify } from 'type-fest'

import type * as types from './types.js'
import { BotError } from './bot-error.js'
import { handleKnownTwitterErrors } from './twitter-utils.js'
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

    handleKnownTwitterErrors(err, { label: 'creating tweet' })
    throw err
  }
}
