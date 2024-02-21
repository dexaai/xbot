import KeyvRedis from '@keyv/redis'
import { type Redis } from 'ioredis'
import Keyv from 'keyv'
import pMap from 'p-map'
import QuickLRU from 'quick-lru'

import * as config from './config.js'
import * as twitter from './twitter.js'
import type * as types from './types.js'
import {
  handleKnownTwitterErrors,
  maxTwitterId,
  tweetIdComparator
} from './twitter-utils.js'

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
  const store = new KeyvRedis(config.redisUrl)
  redis = store.redis as Redis

  tweets = new Keyv({ store, namespace: config.redisNamespaceTweets })
  users = new Keyv({ store, namespace: config.redisNamespaceUsers })
  messages = new Keyv({ store, namespace: config.redisNamespaceMessages })
  state = new Keyv({ store, namespace: config.redisNamespaceState })
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

export async function getSinceMentionId(): Promise<string | undefined> {
  return state.get('sinceMentionId')
}

export async function setSinceMentionId(sinceMentionId: string | undefined) {
  return state.set('sinceMentionId', sinceMentionId)
}

export function getTweetMentionDbForUserId(userId: string) {
  if (!userIdToMentionDbMap[userId]) {
    userIdToMentionDbMap[userId] = new Keyv({
      store: redis ? new KeyvRedis(redis) : undefined,
      namespace: `${config.redisNamespaceMentionsPrefix}:${userId}`
    })
  }

  return userIdToMentionDbMap[userId]!
}

export async function upsertTweets(
  t: types.Tweet[],
  { concurrency = DEFAULT_CONCURRENCY }: { concurrency?: number } = {}
) {
  return pMap(
    t,
    (tweet) => {
      tweetsCache.set(tweet.id, tweet)
      return tweets.set(tweet.id, tweet)
    },
    { concurrency }
  )
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
  return pMap(
    u,
    (user) => {
      usersCache.set(user.id, user)
      return users.set(user.id, user)
    },
    { concurrency }
  )
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

  // TODO: Do this the right way using some redis magic instead of naively
  // iterating across all keys. This is going to get very slow over time.
  for await (const tweet of mentionDb.iterator()) {
    if (tweetIdComparator(tweet, originalSinceMentionId) > 0) {
      result.mentions.push(tweet)
      result.sinceMentionId = maxTwitterId(result.sinceMentionId, tweet.id)
    }
  }

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
  ctx: types.Context,
  {
    // If true, will force a fetch from the twitter API
    force = false
  }: {
    force?: boolean
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

  if (force) {
    try {
      tweet = await twitter.findTweetById(tweetId, ctx)

      if (tweet) {
        tweetsCache.set(tweetId, tweet)
        await tweets.set(tweetId, tweet)
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

export { tweets, users, messages, state }
