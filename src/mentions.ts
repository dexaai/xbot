import pMap from 'p-map'
import urlRegex from 'url-regex'

import * as db from './db.js'
import type * as types from './types.js'
import {
  defaultMaxNumMentionsToProcessPerBatch,
  priorityUsersList,
  tweetIgnoreList,
  twitterBotHandle,
  twitterBotHandleL,
  twitterBotUserId,
  twitterUsersIgnoreList
} from './config.js'
import { getTwitterUserIdMentions } from './twitter-mentions.js'
import {
  getTweetUrl,
  maxTwitterId,
  minTwitterId,
  tweetComparator
} from './twitter-utils.js'

const rUrl = urlRegex()

/**
 * Fetches new unanswered mentions, preprocesses them, and sorts them by a
 * priority heuristic.
 */
export async function getTweetMentionsBatch({
  twitter,
  noCache = false,
  forceReply = false,
  resolveAllMentions = false,
  debugTweet,
  sinceMentionId,
  maxNumMentionsToProcess = defaultMaxNumMentionsToProcessPerBatch
}: {
  twitter: types.TwitterClient
  noCache?: boolean
  forceReply?: boolean
  resolveAllMentions?: boolean
  debugTweet?: string
  sinceMentionId?: string
  maxNumMentionsToProcess?: number
}): Promise<types.TweetMentionBatch> {
  const batch: types.TweetMentionBatch = {
    mentions: [],
    users: {},
    tweets: {},
    minSinceMentionId: undefined,
    sinceMentionId,
    numMentionsPostponed: 0
  }

  function updateSinceMentionId(tweetId: string) {
    batch.sinceMentionId = maxTwitterId(batch.sinceMentionId, tweetId)
  }

  await populateTweetMentionsBatch({
    batch,
    noCache,
    debugTweet,
    resolveAllMentions,
    twitter
  })

  const numMentionsFetched = batch.mentions.length

  // Filter out invalid mentions
  batch.mentions = batch.mentions.filter((mention) =>
    isValidMention(mention, {
      batch,
      forceReply,
      updateSinceMentionId
    })
  )

  const numMentionsValid = batch.mentions.length

  // Sort the oldest mentions first
  batch.mentions = batch.mentions.sort(tweetComparator)
  const prevInteractions: Record<string, types.Interaction> = {}

  // Filter any mentions which we've already replied to
  if (!forceReply) {
    batch.mentions = (
      await pMap(
        batch.mentions,
        async (mention) => {
          const res: types.Interaction = await db.messages.get(mention.id)
          if (res && (!res.error || res.isErrorFinal)) {
            updateSinceMentionId(mention.id)
            return undefined
          } else {
            const repliedToTweetRef = mention.referenced_tweets?.find(
              (t) => t.type === 'replied_to'
            )
            if (repliedToTweetRef?.id) {
              try {
                const repliedToInteraction: types.Interaction =
                  await db.messages.get(repliedToTweetRef.id)
                prevInteractions[repliedToTweetRef.id] = repliedToInteraction
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
  //    - a fixed set of "priority users" is prioritized highest for testing
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

      const prevInteraction = prevInteractions[repliedToTweetRef.id]
      const repliedToTweet = batch.tweets[repliedToTweetRef.id]

      if (repliedToTweet?.author_id === twitterBotUserId) {
        // continuing the conversation
        penalty /= 3
      } else if (!prevInteraction) {
        penalty *= 5
      }

      if (prevInteraction) {
        if (prevInteraction.promptUserId === mention.author_id) {
          // continuing the conversation
          penalty /= 2
        } else {
          penalty *= 10
        }

        if (prevInteraction.responseUrl && !prevInteraction.error) {
          // continuing the conversation normally
        } else if (prevInteraction.error && !prevInteraction.isErrorFinal) {
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

    if (priorityUsersList.has(mention.author_id!)) {
      score += 10000
    }

    const mentionUser = batch.users[mention.author_id!]
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
  for (let i = maxNumMentionsToProcess; i < numMentionsCandidates; ++i) {
    const mention = batch.mentions[i]!

    // make sure we don't skip past these mentions on the next batch
    batch.minSinceMentionId = minTwitterId(batch.minSinceMentionId, mention.id)
  }

  batch.numMentionsPostponed = Math.max(
    0,
    numMentionsCandidates - maxNumMentionsToProcess
  )

  // Limit the number of mentions to process in this batch
  batch.mentions = batch.mentions.slice(0, maxNumMentionsToProcess)

  const numMentionsInBatch = batch.mentions.length

  console.log(`fetched mentions batch`, {
    numMentionsFetched,
    numMentionsValid,
    numMentionsCandidates,
    numMentionsInBatch,
    numMentionsPostponed: batch.numMentionsPostponed
  })

  return batch
}

export async function populateTweetMentionsBatch({
  batch,
  twitter,
  noCache,
  resolveAllMentions,
  debugTweet
}: {
  batch: types.TweetMentionBatch
  twitter: types.TwitterClient
  noCache?: boolean
  resolveAllMentions?: boolean
  debugTweet?: string
}) {
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

  if (debugTweet) {
    // Debug specific tweets instead of fetching mentions
    const ids = debugTweet.split(',').map((id) => id.trim())
    const res = await twitter.tweets.findTweetsById({
      ...tweetQueryOptions,
      ids: ids
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
      twitterBotUserId,
      {
        ...tweetQueryOptions,
        max_results: 100,
        since_id: batch.sinceMentionId
      },
      {
        twitter,
        noCache,
        resolveAllMentions
      }
    )

    batch.mentions = result.mentions
    batch.users = result.users
    batch.tweets = result.tweets
  }
}

/**
 * Converts a Tweet text string to a prompt ready for input to the answer engine.
 *
 * Strips usernames at the front of a tweet and URLs (like for embedding images).
 */
export function getPrompt(text: string = ''): string {
  // strip usernames
  let prompt = text
    .replace(twitterBotHandleL, '')
    .replace(twitterBotHandle, '')
    .trim()
    .replace(/^\s*@[a-zA-Z0-9_]+/g, '')
    .replace(/^\s*@[a-zA-Z0-9_]+/g, '')
    .replace(/^\s*@[a-zA-Z0-9_]+/g, '')
    .replace(/^\s*@[a-zA-Z0-9_]+/g, '')
    .replace(rUrl, '')
    .trim()
    .replace(/^,\s*/, '')
    .trim()

  return prompt
}

/**
 * Returns info on the mentions at the start of a tweet.
 *
 * @TODO Add unit tests for this
 */
export function getNumMentionsInText(
  text: string = '',
  { isReply }: { isReply?: boolean } = {}
) {
  const prefixText = isReply
    ? (text.match(/^(\@[a-zA-Z0-9_]+\b\s*)+/g) || [])[0]
    : text
  if (!prefixText) {
    return {
      usernames: [],
      numMentions: 0
    }
  }

  const usernames = (prefixText.match(/\@[a-zA-Z0-9_]+\b/g) || []).map(
    (u: string) => u.trim().toLowerCase().replace(',', '')
  )
  let numMentions = 0

  for (const username of usernames) {
    if (username === twitterBotHandleL) {
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
export function isValidMention(
  mention: types.TweetMention,
  {
    batch,
    forceReply,
    updateSinceMentionId
  }: {
    batch: types.TweetMentionBatch
    forceReply?: boolean
    updateSinceMentionId: (tweetId: string) => void
  }
): boolean {
  if (!mention) {
    return false
  }

  if (tweetIgnoreList.has(mention.id!)) {
    return false
  }

  if (twitterUsersIgnoreList.has(mention.author_id!)) {
    return false
  }

  const repliedToTweetRef = mention.referenced_tweets?.find(
    (t) => t.type === 'replied_to'
  )
  const repliedToTweet = repliedToTweetRef
    ? batch.tweets[repliedToTweetRef.id]
    : null
  const isReply = !!repliedToTweetRef
  if (repliedToTweet) {
    repliedToTweet.prompt = getPrompt(repliedToTweet.text)
    const subMentions = getNumMentionsInText(repliedToTweet.text, {
      isReply: !!repliedToTweet.referenced_tweets?.find(
        (t) => t.type === 'replied_to'
      )
    })
    repliedToTweet.numMentions = subMentions.numMentions
  }

  if (isReply && !repliedToTweet) {
    return false
  }

  let text = mention.text
  mention.prompt = getPrompt(text)

  if (
    mention.prompt.startsWith('(human) ') &&
    priorityUsersList.has(mention.author_id!)
  ) {
    // ignore tweets where I'm responding to people
    return false
  }

  const { numMentions, usernames } = getNumMentionsInText(text)

  if (!mention.prompt) {
    if (isReply) {
      text = repliedToTweet!.text
      mention.prompt = repliedToTweet!.prompt
    }

    if (!mention.prompt) {
      return false
    }
  }

  if (
    numMentions > 0 &&
    (usernames[usernames.length - 1] === twitterBotHandleL ||
      (numMentions === 1 && !isReply))
  ) {
    if (
      isReply &&
      !forceReply &&
      (repliedToTweet?.numMentions! > numMentions ||
        (repliedToTweet?.numMentions === numMentions &&
          repliedToTweet?.isReply))
    ) {
      // console.log('ignoring mention 0', mention, {
      //   repliedToTweet,
      //   numMentions
      // })

      updateSinceMentionId?.(mention.id!)
      return false
    } else if (numMentions === 1) {
      // TODO: I don't think this is necessary anymore
      // if (isReply && mention.in_reply_to_user_id !== twitterBotUserId) {
      //   console.log('ignoring mention 1', mention, {
      //     numMentions
      //   })
      //   updateSinceMentionId?.(mention.id)
      //   return false
      // }
    }
  } else {
    // console.log('ignoring mention 2', pick(mention, 'text', 'id'), {
    //   numMentions
    // })

    updateSinceMentionId?.(mention.id!)
    return false
  }

  // console.log(JSON.stringify(mention, null, 2), {
  //   numMentions,
  //   repliedToTweet
  // })
  // console.log(pick(mention, 'id', 'text', 'prompt'), { numMentions })
  return true
}
