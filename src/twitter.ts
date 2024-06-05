import pThrottle from 'p-throttle'
import type { SetOptional, Simplify } from 'type-fest'

import * as config from './config.js'
import { handleKnownTwitterErrors } from './twitter-utils.js'
import type * as types from './types.js'
import { assert } from './utils.js'

/**
 * This file contains rate-limited wrappers around all of the core Twitter API
 * methods that this project uses.
 *
 * NOTE: Twitter has different API rate limits and quotas per plan, so in order
 * to rate-limit effectively, our throttles need to either use the lowest common
 * denominator OR vary based on the twitter developer plan you're using. We
 * chose to go with the latter.
 *
 * @see https://developer.twitter.com/en/docs/twitter-api/rate-limits
 */

type TwitterApiMethod =
  | 'createTweet'
  | 'usersIdMentions'
  | 'findTweetById'
  | 'findTweetsById'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

const twitterApiRateLimitsByPlan: Record<
  types.TwitterApiPlan,
  Record<
    TwitterApiMethod,
    {
      readonly limit: number
      readonly interval: number
    }
  >
> = {
  free: {
    // 50 per 24h per user
    // 50 per 24h per app
    createTweet: { limit: 50, interval: TWENTY_FOUR_HOURS_MS },

    // TODO: according to the twitter docs, this shouldn't be allowed on the
    // free plan, but it seems to work...
    usersIdMentions: { limit: 1, interval: FIFTEEN_MINUTES_MS },

    // TODO: according to the twitter docs, this shouldn't be allowed on the
    // free plan, but it seems to work...
    findTweetById: { limit: 1, interval: FIFTEEN_MINUTES_MS },

    // TODO: according to the twitter docs, this shouldn't be allowed on the
    // free plan, but it seems to work...
    findTweetsById: { limit: 1, interval: FIFTEEN_MINUTES_MS }
  },

  basic: {
    // 100 per 24h per user
    // 1667 per 24h per app
    createTweet: { limit: 100, interval: TWENTY_FOUR_HOURS_MS },

    // https://developer.twitter.com/en/docs/twitter-api/tweets/timelines/api-reference/get-users-id-mentions
    // TODO: undocumented
    // 180 per 15m per user
    // 450 per 15m per app
    usersIdMentions: { limit: 180, interval: FIFTEEN_MINUTES_MS },

    // 15 per 15m per user
    // 15 per 15m per app
    findTweetById: { limit: 15, interval: FIFTEEN_MINUTES_MS },
    findTweetsById: { limit: 15, interval: FIFTEEN_MINUTES_MS }
  },

  pro: {
    // 100 per 15m per user
    // 10k per 24h per app
    createTweet: { limit: 100, interval: FIFTEEN_MINUTES_MS },

    // 180 per 15m per user
    // 450 per 15m per app
    usersIdMentions: { limit: 180, interval: FIFTEEN_MINUTES_MS },

    // TODO: why would the per-user rate-limit be less than the per-app one?!
    // 900 per 15m per user
    // 450 per 15m per app
    findTweetById: { limit: 450, interval: FIFTEEN_MINUTES_MS },
    findTweetsById: { limit: 450, interval: FIFTEEN_MINUTES_MS }
  },

  enterprise: {
    // NOTE: these are just placeholders; the enterprise plan seems to be
    // completely customizable, but it's still useful to define rate limits
    // for robustness. These values just 10x those of the pro plan.
    createTweet: { limit: 1000, interval: FIFTEEN_MINUTES_MS },
    usersIdMentions: { limit: 1800, interval: FIFTEEN_MINUTES_MS },
    findTweetById: { limit: 4500, interval: FIFTEEN_MINUTES_MS },
    findTweetsById: { limit: 4500, interval: FIFTEEN_MINUTES_MS }
  }
}

const createTweetThrottle = pThrottle(
  twitterApiRateLimitsByPlan[config.twitterApiPlan].createTweet
)

const usersIdMentionsThrottle = pThrottle(
  twitterApiRateLimitsByPlan[config.twitterApiPlan].usersIdMentions
)

const findTweetByIdThrottle = pThrottle(
  twitterApiRateLimitsByPlan[config.twitterApiPlan].findTweetById
)

const findTweetsByIdThrottle = pThrottle(
  twitterApiRateLimitsByPlan[config.twitterApiPlan].findTweetsById
)

export const createTweet = createTweetThrottle(createTweetImpl)
export const usersIdMentionsThrottleWorkaround = usersIdMentionsThrottle(
  async () => {}
)
export const findTweetById = findTweetByIdThrottle(findTweetByIdImpl)
export const findTweetsById = findTweetsByIdThrottle(findTweetsByIdImpl)

export type CreateTweetParams = Simplify<
  Parameters<types.TwitterClient['tweets']['createTweet']>[0]
>

export type UsersIdMentionsParams = Simplify<
  Parameters<types.TwitterClient['tweets']['usersIdMentions']>[1]
>

export type FindTweetByIdParams = Simplify<
  Parameters<types.TwitterClient['tweets']['findTweetById']>[1]
>

export type FindTweetsByIdParams = Simplify<
  Parameters<types.TwitterClient['tweets']['findTweetsById']>[0]
>

const defaultTwitterQueryTweetFields: types.TwitterQueryTweetFields = [
  'attachments',
  'author_id',
  'conversation_id',
  'created_at',
  'entities',
  'geo',
  'id',
  'in_reply_to_user_id',
  'lang',
  'public_metrics',
  'possibly_sensitive',
  'referenced_tweets',
  'text'
  // 'context_annotations', // not needed (way too verbose and noisy)
  // 'edit_controls', / not needed
  // 'non_public_metrics', // don't have access to
  // 'organic_metrics', // don't have access to
  // 'promoted_metrics, // don't have access to
  // 'reply_settings', / not needed
  // 'source', // not needed
  // 'withheld' // not needed
]

const defaultTwitterQueryUserFields: types.TwitterQueryUserFields = [
  'created_at',
  'description',
  'entities',
  'id',
  'location',
  'name',
  'pinned_tweet_id',
  'profile_image_url',
  'protected',
  'public_metrics',
  'url',
  'username',
  'verified'
  // 'most_recent_tweet_id',
  // 'verified_type',
  // 'withheld'
]

const defaultTweetQueryParams: types.TweetsQueryOptions = {
  // https://developer.twitter.com/en/docs/twitter-api/expansions
  expansions: [
    'author_id',
    'in_reply_to_user_id',
    'referenced_tweets.id',
    'referenced_tweets.id.author_id',
    'entities.mentions.username',
    // TODO
    'attachments.media_keys',
    'geo.place_id',
    'attachments.poll_ids'
  ],
  'tweet.fields': defaultTwitterQueryTweetFields,
  'user.fields': defaultTwitterQueryUserFields
}

// TODO
// const defaultUserQueryParams: types.TwitterUserQueryOptions = {
//   // https://developer.twitter.com/en/docs/twitter-api/expansions
//   expansions: ['pinned_tweet_id'],
//   'tweet.fields': defaultTwitterQueryTweetFields,
//   'user.fields': defaultTwitterQueryUserFields
// }

async function createTweetImpl(
  params: CreateTweetParams,
  ctx: Simplify<
    SetOptional<Pick<types.Context, 'twitterClient' | 'dryRun'>, 'dryRun'>
  >
): Promise<types.CreatedTweet> {
  assert(!ctx.dryRun)

  try {
    const { data: tweet } = await ctx.twitterClient.tweets.createTweet(params)

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

export function usersIdMentions(
  userId: string,
  ctx: Pick<types.Context, 'twitterClient'>,
  params?: UsersIdMentionsParams
) {
  try {
    const mentionsQuery = ctx.twitterClient.tweets.usersIdMentions(userId, {
      ...defaultTweetQueryParams,
      ...params
    })

    return mentionsQuery
  } catch (err: any) {
    console.error('error fetching user mentions', err)

    handleKnownTwitterErrors(err, {
      label: `fetching user mentions for user "${userId}"`
    })
    throw err
  }
}

async function findTweetByIdImpl(
  tweetId: string,
  ctx: Pick<types.Context, 'twitterClient'>,
  params?: FindTweetByIdParams
) {
  try {
    return await ctx.twitterClient.tweets.findTweetById(tweetId, {
      ...defaultTweetQueryParams,
      ...params
    })
  } catch (err: any) {
    handleKnownTwitterErrors(err, { label: `fetching tweet ${tweetId}` })
    throw err
  }
}

async function findTweetsByIdImpl(
  ids: string[],
  ctx: Pick<types.Context, 'twitterClient'>,
  params?: Omit<FindTweetsByIdParams, 'ids'>
) {
  try {
    return await ctx.twitterClient.tweets.findTweetsById({
      ...defaultTweetQueryParams,
      ...params,
      ids
    })
  } catch (err: any) {
    handleKnownTwitterErrors(err, { label: `fetching ${ids.length} tweets` })
    throw err
  }
}
