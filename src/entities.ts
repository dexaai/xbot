import { z } from 'zod'

import * as db from './db.js'
import type * as types from './types.js'
import type { AnswerEngine } from './answer-engine.js'
import { DexaAnswerEngine } from './answer-engines/dexa-answer-engine.js'
import { OpenAIAnswerEngine } from './answer-engines/openai-answer-engine.js'

export function createAnswerEngine(
  answerEngineType: types.AnswerEngineType
): AnswerEngine {
  switch (answerEngineType) {
    case 'openai':
      return new OpenAIAnswerEngine()

    case 'dexa':
      return new DexaAnswerEngine()

    default:
      throw new Error(`Unknown answer engine: ${answerEngineType}`)
  }
}

export const UserEntitySchema = z.object({
  type: z.literal('user'),
  name: z.string().optional(),
  twitterId: z.string().optional(),
  twitterUsername: z.string().optional(),
  twitterBio: z.string().optional(),
  twitterUrl: z.string().optional(),
  twitterPinnedTweetId: z.string().optional(),
  twitterLocation: z.string().optional(),
  twitterProfileImageUrl: z.string().optional(),
  twitterNumFollowers: z.number().optional(),
  twitterNumFollowing: z.number().optional(),
  twitterNumTweets: z.number().optional(),
  twitterNumLikes: z.number().optional()
})
export type UserEntity = z.infer<typeof UserEntitySchema>

export const TweetEntitySchema = z.object({
  type: z.literal('tweet'),
  id: z.string(),
  authorId: z.string().optional(),
  text: z.string().describe('tweet body text'),
  lang: z.string().optional(),
  repliedToTweetId: z.string().optional(),
  repliedToUserId: z.string().optional(),
  quotedTweetId: z.string().optional(),
  retweetedTweetId: z.string().optional(),
  numLikes: z.number().optional(),
  numRetweets: z.number().optional(),
  numQuoteTweets: z.number().optional(),
  numReplies: z.number().optional(),
  numImpressions: z.number().optional()
})
export type TweetEntity = z.infer<typeof TweetEntitySchema>

export const MediaEntitySchema = z.object({
  type: z.literal('media'),
  id: z.string(),
  subtype: z.enum(['image', 'video', 'gif', 'audio', 'other']).optional(),
  url: z.string()
})
export type MediaEntity = z.infer<typeof MediaEntitySchema>

export const URLEntitySchema = z.object({
  type: z.literal('url'),
  // Expanded URL
  url: z.string(),
  // Twitter's short url which will be included in the tweet text
  shortUrl: z.string().optional(),
  // Will only exist if this URL references a known media entity
  mediaId: z.string().optional()
})
export type URLEntity = z.infer<typeof URLEntitySchema>

/**
 * Map from entity type to a `Record<string, Entity>` where the string key is
 * the unique entity ID. This entity ID may be a platform-specific identifier,
 * but Dexa shouldn't make any assumptions about the format of these IDs, only
 * that they are unique within the context of the request.
 *
 * An entity may currently be a user, tweet, url, or a media object.
 *
 * User, Media, and URL entities should be as platform-agnostic as possible but
 * may include platform-specific fields such as `twitterUrl` for functionality
 * that is specific to a given platform.
 *
 * Tweet entities are necessarily platform-specific, but they are an important
 * enough global, shareable entity that they warrant their own dedicated support.
 */
export const EntitiesSchema = z.object({
  users: z.record(UserEntitySchema).optional(),
  tweets: z.record(TweetEntitySchema).optional(),
  media: z.record(MediaEntitySchema).optional(),
  urls: z.array(URLEntitySchema).optional()
})
export type Entities = z.infer<typeof EntitiesSchema>

/**
 * Converts a tweet and any referenced entities into an entity map, containing
 * as much metadata as possible about related / referenced entities, such as
 * users, other tweets, and media objects.
 *
 * NOTE: Related entity resolving is purposefully not recursive here, and we
 * default to not fetching missing related entities from twitter in order to
 * keep the conversion as simple and predictable as possible.
 */
export async function convertTweetToEntitiesMap(
  tweet: types.Tweet,
  ctx: Pick<types.Context, 'twitterClient'>,
  {
    fetchMissingEntities = false
  }: {
    // Whether or not to fetch referenced entities from twitter if they're
    // missing from the cache
    fetchMissingEntities?: boolean
  } = {}
): Promise<Entities> {
  const entities: Required<Entities> = {
    users: {},
    tweets: {},
    media: {},
    urls: []
  }
  const tweetEntity = convertTweetToEntity(tweet)
  entities.tweets[tweetEntity.id] = tweetEntity

  const referencedUserIds = new Set<string>()
  const referencedTweetIds = new Set<string>()

  if (tweetEntity.repliedToUserId)
    referencedUserIds.add(tweetEntity.repliedToUserId)
  if (tweetEntity.quotedTweetId)
    referencedUserIds.add(tweetEntity.quotedTweetId)
  if (tweetEntity.retweetedTweetId)
    referencedUserIds.add(tweetEntity.retweetedTweetId)

  for (const tweet of Object.values(entities.tweets)) {
    if (tweet.repliedToUserId) referencedUserIds.add(tweet.repliedToUserId)
    if (tweet.authorId) referencedUserIds.add(tweet.authorId)
  }

  // Attempt to resolve any referenced users
  for (const userId of referencedUserIds) {
    if (entities.users[userId]) continue

    const user = await db.tryGetUserById(userId)
    if (!user) continue

    const userEntity = (entities.users[user.id] =
      convertTwitterUserToEntity(user))
    if (userEntity.twitterPinnedTweetId) {
      referencedTweetIds.add(userEntity.twitterPinnedTweetId)
    }
  }

  // Attempt to resolve any referenced tweets
  for (const tweetId of referencedTweetIds) {
    if (entities.users[tweetId]) continue

    const referencedTweet = await db.tryGetTweetById(tweetId, ctx, {
      fetchFromTwitter: !!fetchMissingEntities
    })
    if (!referencedTweet) continue

    entities.tweets[referencedTweet.id] = convertTweetToEntity(referencedTweet)
  }

  return entities
}

export function convertTweetToEntity(tweet: types.Tweet): TweetEntity {
  return {
    type: 'tweet',
    id: tweet.id,
    authorId: tweet.author_id,
    text: tweet.text,
    lang: tweet.lang,
    repliedToTweetId: tweet.referenced_tweets?.find(
      (t) => t.type === 'replied_to'
    )?.id,
    repliedToUserId: tweet.in_reply_to_user_id,
    quotedTweetId: tweet.referenced_tweets?.find((t) => t.type === 'quoted')
      ?.id,
    retweetedTweetId: tweet.referenced_tweets?.find(
      (t) => t.type === 'retweeted'
    )?.id,
    numLikes: tweet.public_metrics?.like_count,
    numRetweets: tweet.public_metrics?.retweet_count,
    numQuoteTweets: tweet.public_metrics?.quote_count,
    numReplies: tweet.public_metrics?.reply_count,
    numImpressions: (tweet.public_metrics as any)?.impression_count
  }
}

export function convertTwitterUserToEntity(
  user: types.TwitterUser
): UserEntity {
  return {
    type: 'user',
    name: user.name,
    twitterId: user.id,
    twitterUsername: user.username,
    twitterBio: user.description,
    twitterUrl: user.entities?.url?.urls?.[0]?.expanded_url ?? user.url,
    twitterPinnedTweetId: user.pinned_tweet_id,
    twitterLocation: user.location,
    twitterProfileImageUrl: user.profile_image_url,
    twitterNumFollowers: user.public_metrics?.followers_count,
    twitterNumFollowing: user.public_metrics?.following_count,
    twitterNumTweets: user.public_metrics?.tweet_count,
    twitterNumLikes: user.public_metrics?.followers_count
  }
}
