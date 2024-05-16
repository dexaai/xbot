import KeyvRedis from '@keyv/redis'
import { type Redis } from 'ioredis'
import Keyv from 'keyv'
import pMap from 'p-map'
import pMemoize from 'p-memoize'
import QuickLRU from 'quick-lru'

import * as config from './config.js'
import * as twitter from './twitter.js'
import {
  handleKnownTwitterErrors,
  maxTwitterId,
  tweetIdComparator
} from './twitter-utils.js'
import type * as types from './types.js'

const DEFAULT_CONCURRENCY = 16

// Used for caching twitter tweet objects
let tweets: Keyv<types.Tweet>
const tweetsCache = new QuickLRU<string, types.Tweet>({ maxSize: 10000 })

// Used for caching twitter user objects
let users: Keyv<types.TwitterUser>
const usersCache = new QuickLRU<string, types.TwitterUser>({ maxSize: 10000 })

// Used for storing bot response messages
let messages: Keyv<types.Message>

// Used for storing general bot state (e.g. most recent tweet id processed)
let state: Keyv

// NOTE: this should be a global to ensure it persists across serverless
// function invocations (if deployed in a serverless setting)
let redis: Redis

const userIdToMentionDbMap: Record<string, Keyv<types.Tweet>> = {}

if (config.redisUrl) {
  const store = new KeyvRedis(config.redisUrl, {
    options: {
      tls: {
        rejectUnauthorized: false
      }
    }
  })
  redis = store.redis as Redis

  tweets = new Keyv({ store, namespace: config.redisNamespaceTweets })
  users = new Keyv({ store, namespace: config.redisNamespaceUsers })
  messages = new Keyv({ store, namespace: config.redisNamespaceMessages })
  state = new Keyv({ store, namespace: config.redisNamespaceState })

  function errorHandler(err: any) {
    if (err.code === 'ECONNRESET') {
      console.warn('redis connection timed out', err.code, err.message)
    } else if (err.code === 'ECONNREFUSED') {
      console.warn('redis connection refused', err.code, err.message)
    } else {
      console.error('error', err.code ?? 'unknown', err.message, err.stack)
      process.exit(1)
    }
  }

  process.on('uncaughtException', errorHandler)
} else {
  if (config.requireRedis) {
    console.error('Error: missing required REDIS_URL since REQUIRE_REDIS=true')
    process.exit(1)
  }

  console.warn('Redis is disabled. All state will be stored in memory.')
  tweets = new Keyv({ namespace: config.redisNamespaceTweets })
  users = new Keyv({ namespace: config.redisNamespaceUsers })
  messages = new Keyv({ namespace: config.redisNamespaceMessages })
  state = new Keyv({ namespace: config.redisNamespaceState })
}

export { messages, redis, state, tweets, users }

export async function clearAllDataForUserId(twitterBotUserId: string) {
  console.warn('WARNING: clearing all data for user', twitterBotUserId)

  // const keys = await redis.keys('*')
  // if (keys.length) { await redis.del(keys) }

  const mentionDb = getTweetMentionDbForUserId(twitterBotUserId)
  await mentionDb.clear()

  await tweets.clear()
  tweetsCache.clear()

  await users.clear()
  usersCache.clear()

  await messages.clear()
  await setSinceMentionId('0', { twitterBotUserId })
}

export async function getSinceMentionId(
  ctx: Pick<types.Context, 'twitterBotUserId'>
): Promise<string | undefined> {
  const key = `${ctx.twitterBotUserId}:sinceMentionId`
  return state.get(key)
}

export async function setSinceMentionId(
  sinceMentionId: string | undefined,
  ctx: Pick<types.Context, 'twitterBotUserId'>
) {
  const key = `${ctx.twitterBotUserId}:sinceMentionId`
  return state.set(key, sinceMentionId)
}

export function getTweetMentionDbNamespaceForUserId(userId: string) {
  return `${config.redisNamespaceMentionsPrefix}:${userId}`
}

export function getTweetMentionDbForUserId(userId: string) {
  if (!userIdToMentionDbMap[userId]) {
    userIdToMentionDbMap[userId] = new Keyv({
      store: redis ? new KeyvRedis(redis) : undefined,
      namespace: getTweetMentionDbNamespaceForUserId(userId)
    })
  }

  return userIdToMentionDbMap[userId]!
}

async function cacheTweet(tweet: types.Tweet) {
  pruneTweet(tweet)
  // console.log('caching tweet', tweet)
  tweetsCache.set(tweet.id, tweet)
  return tweets.set(tweet.id, tweet)
}

async function cacheTwitterUser(user: types.TwitterUser) {
  pruneTwitterUser(user)
  // console.log('caching user', user)
  usersCache.set(user.id, user)
  return users.set(user.id, user)
}

export async function upsertTweets(
  t: types.Tweet[],
  { concurrency = DEFAULT_CONCURRENCY }: { concurrency?: number } = {}
) {
  return pMap(t, cacheTweet, { concurrency })
}

export async function upsertTweetMentionsForUserId(
  userId: string,
  m: types.Tweet[],
  { concurrency = DEFAULT_CONCURRENCY }: { concurrency?: number } = {}
) {
  const mentionsDb = getTweetMentionDbForUserId(userId)
  return pMap(
    m,
    (tweet) => {
      // We're not using `cacheTweet` here because we want to use a diff mentionsDb
      pruneTweet(tweet)
      tweetsCache.set(tweet.id, tweet)
      return mentionsDb.set(tweet.id, tweet)
    },
    {
      concurrency
    }
  )
}

export async function upsertTwitterUsers(
  u: types.TwitterUser[],
  { concurrency = DEFAULT_CONCURRENCY }: { concurrency?: number } = {}
) {
  return pMap(u, cacheTwitterUser, { concurrency })
}

export async function upsertMessages(
  m: types.Message[],
  { concurrency = DEFAULT_CONCURRENCY }: { concurrency?: number } = {}
) {
  return pMap(m, (message) => messages.set(message.id, message), {
    concurrency
  })
}

export async function upsertMessage(message: types.Message) {
  const result = await messages.set(message.id, message)

  if (message.responseTweetId) {
    await messages.set(message.responseTweetId!, {
      ...message,
      id: message.responseTweetId!,
      role: 'assistant'
    })
  }

  return result
}

export async function tryGetTwitterUsersByIds(
  userIds: string[],
  // ctx: Pick<types.Context, 'twitterClient'>,
  { concurrency = DEFAULT_CONCURRENCY }: { concurrency?: number } = {}
): Promise<Record<string, types.TwitterUser>> {
  const resolvedUsers = (
    await pMap(userIds, (userId) => tryGetUserById(userId), {
      concurrency
    })
  ).filter(Boolean)

  return Object.fromEntries(resolvedUsers.map((user) => [user.id, user]))
}

export async function getCachedUserMentionsForUserSince({
  userId,
  sinceMentionId
}: {
  userId: string
  sinceMentionId: string
}): Promise<types.TweetMentionFetchResult> {
  const originalSinceMentionId = sinceMentionId
  const result: types.TweetMentionFetchResult = {
    mentions: [],
    users: {},
    tweets: {},
    sinceMentionId
  }

  const mentionDb = getTweetMentionDbForUserId(userId)
  const userIds = new Set<string>()

  // TODO: get the batch version working
  // const namespace = getTweetMentionDbNamespaceForUserId(userId)
  // const keys = await redis.keys(`${namespace}:*`)
  // console.log(keys)

  // TODO: Do this the right way using some redis magic instead of naively
  // iterating across all keys. This is going to get very slow over time.
  for await (const [, tweet] of mentionDb.iterator()) {
    if (tweetIdComparator(tweet.id, originalSinceMentionId) > 0) {
      result.mentions.push(tweet)
      result.sinceMentionId = maxTwitterId(result.sinceMentionId, tweet.id)
      userIds.add(tweet.author_id)
    }
  }

  result.users = await tryGetTwitterUsersByIds(Array.from(userIds))
  result.tweets = Object.fromEntries(
    result.mentions.map((tweet) => [tweet.id, tweet])
  )

  return result
}

/** Attempts to retrieve a twitter user from the cache */
export async function tryGetUserById(
  userId?: string
): Promise<types.TwitterUser | undefined> {
  if (!userId) return

  let user = usersCache.get(userId)
  if (user) return user

  user = await users.get(userId)
  if (user) {
    usersCache.set(userId, user)
    return user
  }

  return undefined
}

/** Attempts to retrieve a tweet from the cache */
export async function tryGetTweetById(
  tweetId: string,
  ctx: Pick<types.Context, 'twitterClient'>,
  {
    fetchFromTwitter = false
  }: {
    // Whether or not to fetch tweets from twitter if they're missing from the cache
    fetchFromTwitter?: boolean
  } = {}
): Promise<types.Tweet | undefined> {
  if (!tweetId) return

  let tweet = tweetsCache.get(tweetId)
  if (tweet) return tweet

  tweet = await tweets.get(tweetId)
  if (tweet) {
    tweetsCache.set(tweetId, tweet)
    return tweet
  }

  if (fetchFromTwitter) {
    try {
      const { data, includes } = await twitter.findTweetById(tweetId, ctx)
      tweet = data

      if (tweet) {
        if (includes?.users) {
          await upsertTwitterUsers(Object.values(includes.users))
        }

        if (includes?.tweets) {
          await upsertTweets(Object.values(includes.tweets))
        }

        await cacheTweet(tweet)
        return tweet
      }
    } catch (err: any) {
      try {
        handleKnownTwitterErrors(err, { label: `fetching tweet ${tweetId}` })

        // Silently ignore
        console.warn(
          'ignoring error',
          [err.status, err.type, err.toString()].filter(Boolean).join(' ')
        )
      } catch (err2: any) {
        // Silently ignore
        console.warn(
          'ignoring error',
          [err.status, err.type, err.toString()].filter(Boolean).join(' ')
        )
      }
    }
  }

  return tweet
}

/**
 * Prune most tweet entities since they're verbose and can be recomputed easily.
 *
 * We still want to fetch `entities` because some of them are useful, but the
 * twitter api doesn't allow us to only fetch certain entities.
 */
function pruneTweet(tweet: types.Tweet) {
  if (tweet.entities) {
    if (tweet.entities.urls) {
      tweet.entities = { urls: tweet.entities?.urls }
    } else {
      delete tweet.entities
    }
  }

  delete (tweet as any).edit_history_tweet_ids
}

/**
 * Prune most user entities since they're verbose and can be recomputed easily.
 *
 * We still want to fetch `entities` because some of them are useful, but the
 * twitter api doesn't allow us to only fetch certain entities.
 */
function pruneTwitterUser(user: types.TwitterUser) {
  if (user.entities) {
    if (user.entities.description?.urls) {
      user.entities.description = {
        urls: user.entities.description.urls
      }
    } else {
      delete user.entities.description
    }

    if (!Object.keys(user.entities).length) {
      delete user.entities
    }
  }
}

export const tryGetTwitterUsernameByUserId = pMemoize(
  tryGetTwitterUsernameByUserIdImpl
)

async function tryGetTwitterUsernameByUserIdImpl(
  userId?: string
): Promise<string | undefined> {
  if (!userId) return
  const user = await tryGetUserById(userId)
  return user?.username
}
