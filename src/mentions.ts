import pMap from 'p-map'

import * as config from './config.js'
import * as db from './db.js'
import type * as types from './types.js'
import { getTwitterUserIdMentions } from './twitter-mentions.js'
import {
  getTweetUrl,
  maxTwitterId,
  minTwitterId,
  tweetComparator
} from './twitter-utils.js'
import { getPrompt } from './utils.js'

/**
 * Fetches new unanswered mentions, preprocesses them, and sorts them by a
 * priority heuristic.
 */
export async function getTweetMentionsBatch(
  ctx: types.Context
): Promise<types.TweetMentionBatch> {
  const batch: types.PartialTweetMentionBatch = {
    mentions: [],
    numMentionsPostponed: 0,

    users: {},
    tweets: {},

    minSinceMentionId: undefined,
    sinceMentionId: ctx.sinceMentionId,

    messages: [],
    hasTwitterAuthError: false,
    hasTwitterRateLimitError: false,
    hasNetworkError: false,

    /** Updates the max twitter id processed this batch */
    updateSinceMentionId(tweetId: string) {
      batch.sinceMentionId = maxTwitterId(batch.sinceMentionId, tweetId)
    },

    /** Attempts to retrieve a twitter user from the cache */
    async tryGetUserById(userId?: string) {
      if (!userId) return

      let user = batch.users[userId]
      if (user) return user

      user = await db.users.get(userId)
      if (user) batch.users[userId] = user

      return user
    },

    /** Attempts to retrieve a tweet from the cache */
    async tryGetTweetById(tweetId?: string) {
      if (!tweetId) return

      let tweet = batch.tweets[tweetId]
      if (tweet) return tweet

      tweet = await db.tweets.get(tweetId)
      if (tweet) return (batch.tweets[tweetId] = tweet)

      return tweet
    }
  }

  await populateTweetMentionsBatch(batch, ctx)
  const numMentionsFetched = batch.mentions.length

  // Filter out invalid mentions
  batch.mentions = (
    await pMap(batch.mentions, async (mention) =>
      (await isValidMention(mention, batch, ctx)) ? mention : null
    )
  ).filter(Boolean)

  const numMentionsValid = batch.mentions.length

  // Sort the oldest mentions first
  batch.mentions = batch.mentions.sort(tweetComparator)
  const prevMessages: Record<string, types.Message> = {}

  // Filter any mentions which we've already replied to
  if (!ctx.forceReply) {
    batch.mentions = (
      await pMap(
        batch.mentions,
        async (mention) => {
          const message = await db.messages.get(mention.id)

          if (message && (!message.error || message.isErrorFinal)) {
            batch.updateSinceMentionId(mention.id)
            return undefined
          } else {
            const repliedToTweetRef = mention.referenced_tweets?.find(
              (t) => t.type === 'replied_to'
            )

            if (repliedToTweetRef?.id) {
              try {
                const repliedToMessage = await db.messages.get(
                  repliedToTweetRef.id
                )
                if (repliedToMessage) {
                  prevMessages[repliedToTweetRef.id] = repliedToMessage
                }
              } catch (err) {}
            }

            return mention
          }
        },
        {
          concurrency: 8
        }
      )
    ).filter(Boolean)
  }

  const numMentionsCandidates = batch.mentions.length

  // Score every valid mention candidate according to a heuristic depending on
  // how important it is to respond to. Some factors taken into consideration:
  //    - top-level tweets are ranked higher than replies
  //    - accounts with lots of followers are prioritized because they have a
  //      larger surface area for exposure
  //    - a fixed set of "priority users" are prioritized highest for testing
  //      purposes; this includes me and my test accounts
  //    - older tweets that we haven't responded to yet get a small boost
  for (let i = 0; i < numMentionsCandidates; ++i) {
    const mention = batch.mentions[i]!
    let score = (0.5 * (numMentionsCandidates - i)) / numMentionsCandidates

    const repliedToTweetRef = mention.referenced_tweets?.find(
      (t) => t.type === 'replied_to'
    )
    const isReply = !!repliedToTweetRef
    mention.isReply = isReply

    if (isReply) {
      let penalty = 10

      const prevMessage = prevMessages[repliedToTweetRef.id]
      const repliedToTweet = await batch.tryGetTweetById(repliedToTweetRef.id)

      if (repliedToTweet?.author_id === ctx.twitterBotUserId) {
        // continuing the conversation
        penalty /= 3
      } else if (!prevMessage) {
        penalty *= 5
      }

      if (prevMessage) {
        if (prevMessage.promptUserId === mention.author_id) {
          // continuing the conversation
          penalty /= 2
        } else {
          penalty *= 10
        }

        if (prevMessage.responseUrl && !prevMessage.error) {
          // continuing the conversation normally
        } else if (prevMessage.error && !prevMessage.isErrorFinal) {
          penalty *= 1000
        } else {
          penalty *= 10
        }
      } else if (!repliedToTweet) {
        // possibly deleted
        penalty *= 100
      }

      score -= penalty
    }

    if (config.priorityUsersList.has(mention.author_id!)) {
      score += 10000
    }

    const mentionUser = await batch.tryGetUserById(mention.author_id)
    if (mentionUser) {
      mention.promptUrl = getTweetUrl({
        username: mentionUser.username,
        id: mention.id
      })

      const numFollowers = mentionUser?.public_metrics?.followers_count
      if (numFollowers) {
        mention.numFollowers = numFollowers
        score += numFollowers / 1000
      }
    }

    mention.priorityScore = score
  }

  // Sort mentions by relative priority, with the highest priority tweets first
  batch.mentions.sort(
    (a, b) => (b.priorityScore as number) - (a.priorityScore as number)
  )

  // console.log('SORTED (first 50)', batch.mentions.slice(0, 50))

  // Loop through all of the mentions we won't be processing in this batch
  for (let i = ctx.maxNumMentionsToProcess; i < numMentionsCandidates; ++i) {
    const mention = batch.mentions[i]!

    // make sure we don't skip past these mentions on the next batch
    batch.minSinceMentionId = minTwitterId(batch.minSinceMentionId, mention.id)
  }

  batch.numMentionsPostponed = Math.max(
    0,
    numMentionsCandidates - ctx.maxNumMentionsToProcess
  )

  // Limit the number of mentions to process in this batch
  batch.mentions = batch.mentions.slice(0, ctx.maxNumMentionsToProcess)

  const numMentionsInBatch = batch.mentions.length

  console.log(`fetched mentions batch`, {
    numMentionsFetched,
    numMentionsValid,
    numMentionsCandidates,
    numMentionsInBatch,
    numMentionsPostponed: batch.numMentionsPostponed
  })

  return batch as types.TweetMentionBatch
}

export async function populateTweetMentionsBatch(
  batch: types.PartialTweetMentionBatch,
  ctx: types.Context
) {
  console.log('fetching mentions since', batch.sinceMentionId || 'forever')

  const tweetQueryOptions: types.TweetsQueryOptions = {
    expansions: ['author_id', 'in_reply_to_user_id', 'referenced_tweets.id'],
    'tweet.fields': [
      'created_at',
      'public_metrics',
      'conversation_id',
      'in_reply_to_user_id',
      'referenced_tweets',
      'text'
    ],
    'user.fields': ['profile_image_url', 'public_metrics']
  }

  if (ctx.debugTweetIds?.length) {
    // Debug specific tweets instead of fetching mentions
    const res = await ctx.twitterClient.tweets.findTweetsById({
      ...tweetQueryOptions,
      ids: ctx.debugTweetIds
    })

    // console.log('debugTweet', JSON.stringify(res, null, 2))

    batch.mentions = batch.mentions.concat(res.data!)

    if (res.includes?.users?.length) {
      for (const user of res.includes.users) {
        batch.users[user.id] = user
      }
    }

    if (res.includes?.tweets?.length) {
      for (const tweet of res.includes.tweets) {
        batch.tweets[tweet.id] = tweet
      }
    }
  } else {
    const result = await getTwitterUserIdMentions(
      ctx.twitterBotUserId,
      {
        ...tweetQueryOptions,
        max_results: 100,
        since_id: batch.sinceMentionId
      },
      ctx
    )

    batch.mentions = result.mentions
    batch.users = result.users
    batch.tweets = result.tweets
  }
}

/**
 * Returns info on the mentions at the start of a tweet.
 *
 * @TODO Add unit tests for this
 */
export function getNumMentionsInText(
  text: string = '',
  ctx: types.Context,
  { isReply }: { isReply?: boolean } = {}
) {
  const prefixText = isReply
    ? (text.match(/^(@[a-zA-Z0-9_]+\b\s*)+/g) || [])[0]
    : text
  if (!prefixText) {
    return {
      usernames: [],
      numMentions: 0
    }
  }

  const usernames = (prefixText.match(/@[a-zA-Z0-9_]+\b/g) || []).map(
    (u: string) => u.trim().toLowerCase().replace(',', '')
  )
  let numMentions = 0

  for (const username of usernames) {
    if (username === ctx.twitterBotHandleL) {
      numMentions++
    }
  }

  return {
    numMentions,
    usernames
  }
}

/**
 * @returns whether or not the mention is valid to respond to.
 *
 * @todo: this would be *a lot* simpler if twitter fixed not including `display_text_range` in tweets returned by the v2 API:
 * - https://twittercommunity.com/t/display-text-range-not-included-in-api-v2-tweet-lookup-or-statuses-user-timeline/161896/4
 * - https://twittercommunity.com/t/is-there-a-way-to-get-something-like-display-text-range-in-api-v2/172689/3
 */
export async function isValidMention(
  mention: types.PartialTweetMention,
  batch: types.PartialTweetMentionBatch,
  ctx: types.Context
): Promise<boolean> {
  if (!mention) {
    return false
  }

  if (config.tweetIgnoreList.has(mention.id!)) {
    return false
  }

  if (config.twitterUsersIgnoreList.has(mention.author_id!)) {
    return false
  }

  const repliedToTweetRef = mention.referenced_tweets?.find(
    (t) => t.type === 'replied_to'
  )
  const repliedToTweet = repliedToTweetRef
    ? await batch.tryGetTweetById(repliedToTweetRef.id)
    : null
  const isReply = !!repliedToTweetRef
  let repliedToMention = repliedToTweet
    ? ({ ...repliedToTweet } as types.PartialTweetMention)
    : undefined

  if (repliedToTweet && repliedToMention) {
    repliedToMention.prompt = getPrompt(repliedToTweet.text, ctx)
    const subMentions = getNumMentionsInText(repliedToTweet.text, ctx, {
      isReply: !!repliedToTweet.referenced_tweets?.find(
        (t) => t.type === 'replied_to'
      )
    })
    repliedToMention.numMentions = subMentions.numMentions
  }

  if (isReply && !repliedToTweet) {
    return false
  }

  let { text } = mention
  mention.prompt = getPrompt(text, ctx)
  if (!mention.prompt) {
    // Ignore tweets where the sanitized prompt is empty
    return false
  }

  if (
    mention.prompt.startsWith('(human) ') &&
    config.priorityUsersList.has(mention.author_id!)
  ) {
    // Ignore tweets where one of the authors is responding to people directly
    // using the bot account
    return false
  }

  const { numMentions, usernames } = getNumMentionsInText(text, ctx)

  if (!mention.prompt) {
    if (isReply) {
      text = repliedToTweet!.text
      mention.prompt = repliedToMention!.prompt
    }

    if (!mention.prompt) {
      return false
    }
  }

  if (
    numMentions > 0 &&
    (usernames[usernames.length - 1] === ctx.twitterBotHandleL ||
      (numMentions === 1 && !isReply))
  ) {
    if (
      isReply &&
      !ctx.forceReply &&
      (repliedToMention?.numMentions! > numMentions ||
        (repliedToMention?.numMentions === numMentions &&
          repliedToMention?.isReply))
    ) {
      // console.log('ignoring mention 0', mention, {
      //   repliedToMention,
      //   numMentions
      // })

      batch.updateSinceMentionId(mention.id!)
      return false
    } else if (numMentions === 1) {
      // TODO: I don't think this is necessary anymore
      // if (isReply && mention.in_reply_to_user_id !== twitterBotUserId) {
      //   console.log('ignoring mention 1', mention, {
      //     numMentions
      //   })
      //   batch.updateSinceMentionId(mention.id)
      //   return false
      // }
    }
  } else {
    // console.log('ignoring mention 2', pick(mention, 'text', 'id'), {
    //   numMentions
    // })

    batch.updateSinceMentionId(mention.id!)
    return false
  }

  // console.log(JSON.stringify(mention, null, 2), {
  //   numMentions,
  //   repliedToMention
  // })
  // console.log(pick(mention, 'id', 'text', 'prompt'), { numMentions })
  return true
}
