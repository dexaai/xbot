import pMap from 'p-map'
import pMemoize from 'p-memoize'
import { z } from 'zod'

import * as db from './db.js'
import { ScraperClient } from './services/scraper-client.js'
import type * as types from './types.js'

export const URLEntitySchema = z.object({
  type: z.literal('url'),
  // Expanded URL
  url: z.string(),
  // Twitter's short url which will be included in the tweet text
  shortUrl: z.string().optional(),
  // Will only exist if this URL references a known media entity
  mediaId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  markdownContent: z.string().optional(),
  siteName: z.string().optional(),
  author: z.string().optional()
})
export type URLEntity = z.infer<typeof URLEntitySchema>

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
  twitterNumLikes: z.number().optional(),
  urls: z.array(URLEntitySchema).optional()
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
  numImpressions: z.number().optional(),
  mediaIds: z.array(z.string()).optional(),
  urls: z.array(URLEntitySchema).optional()
})
export type TweetEntity = z.infer<typeof TweetEntitySchema>

export const MediaEntitySchema = z.object({
  type: z.literal('media'),
  id: z.string(),
  url: z.string(),
  subtype: z.enum(['image', 'video', 'gif', 'audio', 'other']).optional(),
  title: z.string().optional(),
  description: z.string().optional()
})
export type MediaEntity = z.infer<typeof MediaEntitySchema>

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
 *
 * Entity references include string IDs which can be used to look up the full
 * entity in this entities map. This is intended to reduce duplicate entities in
 * cases where multiple messages reference the same entity.
 */
export const EntityMapSchema = z.object({
  users: z.record(UserEntitySchema).optional(),
  tweets: z.record(TweetEntitySchema).optional(),
  media: z.record(MediaEntitySchema).optional(),
  urls: z.record(URLEntitySchema).optional()
})
export type EntityMap = z.infer<typeof EntityMapSchema>

/**
 * References to specific entities (users, tweets, and media objects) which may
 * be attached to a Message in order to provide additional, structured context.
 *
 * These entity referencers may be looked up in an accompanying `EntityMap`.
 *
 * URLs are handled as local-only because they generally don't have platform-
 * specific IDs.
 */
export const EntitiesSchema = z.object({
  userIds: z.array(z.string()).optional(),
  tweetIds: z.array(z.string()).optional(),
  mediaIds: z.array(z.string()).optional(),
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
export async function convertTweetToEntityMap(
  tweet: types.Tweet,
  ctx: Pick<types.Context, 'twitterClient'>,
  {
    fetchMissingEntities = false
  }: {
    // Whether or not to fetch referenced entities from twitter if they're
    // missing from the cache
    fetchMissingEntities?: boolean
  } = {}
): Promise<EntityMap> {
  const entityMap: Required<EntityMap> = {
    users: {},
    tweets: {},
    // TODO: currently not resolving media entities
    media: {},
    urls: {}
  }
  const tweetEntity = convertTweetToEntity(tweet)
  entityMap.tweets[tweetEntity.id] = tweetEntity

  const urls: Record<string, URLEntity> = {}
  const referencedUserIds = new Set<string>()
  const referencedTweetIds = new Set<string>()

  if (tweetEntity.repliedToUserId) {
    referencedUserIds.add(tweetEntity.repliedToUserId)
  }

  if (tweetEntity.quotedTweetId) {
    referencedTweetIds.add(tweetEntity.quotedTweetId)
  }

  if (tweetEntity.retweetedTweetId) {
    referencedTweetIds.add(tweetEntity.retweetedTweetId)
  }

  // Attempt to resolve any referenced tweets
  for (const tweetId of referencedTweetIds) {
    if (entityMap.tweets[tweetId]) continue

    const referencedTweet = await db.tryGetTweetById(tweetId, ctx, {
      fetchFromTwitter: !!fetchMissingEntities
    })
    if (!referencedTweet) continue

    entityMap.tweets[referencedTweet.id] = convertTweetToEntity(referencedTweet)
  }

  for (const tweet of Object.values(entityMap.tweets)) {
    if (tweet.repliedToUserId) referencedUserIds.add(tweet.repliedToUserId)
    if (tweet.authorId) referencedUserIds.add(tweet.authorId)
  }

  // Attempt to resolve any referenced users
  for (const userId of referencedUserIds) {
    if (entityMap.users[userId]) continue

    const user = await db.tryGetUserById(userId)
    if (!user) continue

    const userEntity = (entityMap.users[user.id] =
      convertTwitterUserToEntity(user))
    if (userEntity.twitterPinnedTweetId) {
      referencedTweetIds.add(userEntity.twitterPinnedTweetId)
    }
  }

  for (const tweetEntity of Object.values(entityMap.tweets)) {
    if (!tweetEntity.urls) continue
    for (const urlEntity of tweetEntity.urls) {
      urls[urlEntity.url] = urlEntity
    }
  }

  for (const userEntity of Object.values(entityMap.users)) {
    if (!userEntity.urls) continue
    for (const urlEntity of userEntity.urls) {
      urls[urlEntity.url] = urlEntity
    }
  }

  entityMap.urls = await enrichEntityUrls(Object.values(urls))
  return entityMap
}

export function mergeEntityMaps(...entityMaps: EntityMap[]): EntityMap {
  const result: Required<EntityMap> = {
    users: {},
    tweets: {},
    media: {},
    urls: {}
  }

  for (const entityMap of entityMaps) {
    Object.assign(result.users, entityMap.users)
    Object.assign(result.tweets, entityMap.tweets)
    Object.assign(result.media, entityMap.media)
    Object.assign(result.urls, entityMap.urls)
  }

  return result
}

export function convertTweetToEntity(tweet: types.Tweet): TweetEntity {
  const urls = tweet.entities?.urls?.map(convertTwitterUrlToEntity)
  let text = tweet.text

  if (text && urls) {
    for (const url of urls) {
      text = text!.replaceAll(url.shortUrl!, url.url)
    }
  }

  return {
    type: 'tweet',
    id: tweet.id,
    authorId: tweet.author_id,
    text,
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
    numImpressions: (tweet.public_metrics as any)?.impression_count,
    urls,
    mediaIds: tweet.attachments?.media_keys
  }
}

export function convertTwitterUserToEntity(
  user: types.TwitterUser
): UserEntity {
  const urls = [
    ...(user.entities?.url?.urls?.map(convertTwitterUrlToEntity) ?? []),
    ...(user.entities?.description?.urls?.map(convertTwitterUrlToEntity) ?? [])
  ].filter(Boolean)

  let twitterBio = user.description
  if (twitterBio) {
    for (const url of urls) {
      twitterBio = twitterBio!.replaceAll(url.shortUrl!, url.url)
    }
  }

  return {
    type: 'user',
    name: user.name,
    twitterId: user.id,
    twitterUsername: user.username,
    twitterBio,
    twitterUrl: user.entities?.url?.urls?.[0]?.expanded_url ?? user.url,
    twitterPinnedTweetId: user.pinned_tweet_id,
    twitterLocation: user.location,
    twitterProfileImageUrl: user.profile_image_url,
    twitterNumFollowers: user.public_metrics?.followers_count,
    twitterNumFollowing: user.public_metrics?.following_count,
    twitterNumTweets: user.public_metrics?.tweet_count,
    twitterNumLikes: user.public_metrics?.followers_count,
    urls
  }
}

export function convertTwitterUrlToEntity(url: types.TwitterUrl): URLEntity {
  return {
    type: 'url',
    url: url.expanded_url ?? url.url,
    shortUrl: url.url,
    mediaId: url.media_key
  }
}

export async function enrichEntityUrls(
  urls: URLEntity[],
  {
    concurrency = 5
  }: {
    concurrency?: number
  } = {}
): Promise<Record<string, URLEntity>> {
  const enrichedUrls: Record<string, URLEntity> = {}

  await pMap(
    urls,
    async (urlEntity) => {
      if (urlEntity.mediaId) return

      const scrapedUrl = await scrapeUrl(urlEntity.url)
      if (!scrapedUrl) return

      urlEntity.title = scrapedUrl.title
      urlEntity.description = scrapedUrl.description
      urlEntity.author = scrapedUrl.author
      urlEntity.siteName = scrapedUrl.siteName
      // urlEntity.markdownContent = scrapedUrl.markdownContent

      enrichedUrls[urlEntity.url] = urlEntity
    },
    {
      concurrency
    }
  )

  return enrichedUrls
}

const scraperClient = new ScraperClient()
export const scrapeUrl = pMemoize(scrapeUrlImpl)

async function scrapeUrlImpl(url: string) {
  try {
    return await scraperClient.scrapeUrl(url)
  } catch (err: any) {
    console.log('error scraping url', url, err.message)
    return null
  }
}
