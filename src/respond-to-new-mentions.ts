import pMap from 'p-map'

import * as db from '../src/db.js'
import * as types from './types.js'
import { generateMessageResponse } from './answer-engine.js'
import { BotError } from './bot-error.js'
import { getTweetMentionsBatch } from './mentions.js'
import {
  createTweet,
  getTweetUrl,
  maxTwitterId,
  minTwitterId
} from './twitter-utils.js'
import { assert, getDebugMention, pick } from './utils.js'

/**
 * Fetches new unanswered mentions, generates response messages to each of them
 * via the answer engine, and tweets the responses.
 */
export async function respondToNewMentions(ctx: types.Context) {
  console.log('respond to new mentions since', ctx.sinceMentionId || 'forever')

  // Fetch the mentions to process in this batch
  const batch = await getTweetMentionsBatch(ctx)

  console.log(
    `processing ${batch.mentions.length} tweet mentions`,
    { numMentionsPostponed: batch.numMentionsPostponed },
    batch.mentions.map(getDebugMention)
  )
  console.log()

  if (ctx.earlyExit) {
    if (batch.mentions.length > 0) {
      console.log('mentions', JSON.stringify(batch.mentions, null, 2))
    }

    return batch
  }

  batch.messages = (
    await pMap(
      batch.mentions,
      async (mention): Promise<types.Message | undefined> => {
        const { prompt, id: promptTweetId } = mention
        const promptUserId = mention.author_id!
        const promptUser = batch.users[mention.author_id!]
        const promptUsername = promptUser?.username

        let message: types.Message = {
          id: promptTweetId,
          type: 'tweet',
          role: 'user',
          promptTweetId,
          promptUserId,
          promptUsername,
          prompt,
          promptUrl: getTweetUrl({
            username: promptUsername,
            id: promptTweetId
          }),
          priorityScore: mention.priorityScore,
          numFollowers: mention.numFollowers,
          isReply: mention.isReply
        }

        if (batch.hasNetworkError) {
          message.error = 'network error'
          return message
        }

        if (batch.isRateLimitedTwitter) {
          message.error = 'Twitter rate limited'
          return message
        }

        if (batch.isExpiredAuthTwitter) {
          message.error = 'Twitter auth expired'
          return message
        }

        if (!prompt) {
          message.error = 'empty prompt'
          message.isErrorFinal = true
          return message
        }

        try {
          // Double-check that the tweet still exists before resolving it
          try {
            const promptTweet = await ctx.twitterClient.tweets.findTweetById(
              promptTweetId
            )

            if (!promptTweet?.data) {
              const error = new BotError(
                `Tweet not found (possibly deleted): ${promptTweetId}`
              )
              error.type = 'twitter:forbidden'
              error.isFinal = true
              throw error
            }
          } catch (err: any) {
            const reason = err.toString().toLowerCase()
            if (reason.includes('fetcherror') || reason.includes('enotfound')) {
              throw new BotError(err.toString(), { type: 'network' })
            } else {
              throw new BotError(err.toString(), {
                type: 'twitter:forbidden',
                isFinal: true
              })
            }
          }

          const prevPartialMessage = await db.messages.get(promptTweetId)

          if (prevPartialMessage?.response) {
            message = {
              ...prevPartialMessage,
              ...message
            }

            console.log('resuming', {
              ...getDebugMention(mention),
              ...pick(message as any, 'response', 'error')
            })
          } else {
            console.log('processing', getDebugMention(mention))

            // TODO: Re-add moderation support
            // const promptModerationResult = await checkModeration(prompt)
            // if (promptModerationResult.flagged) {
            //   const reason = Object.keys(promptModerationResult.categories)
            //     .filter((key) => promptModerationResult.categories[key])
            //     .join(', ')
            //   const error = new BotError(
            //     `Error prompt flagged for moderation: ${reason}`,
            //     {
            //       type: 'moderation',
            //       isFinal: true
            //     }
            //   )
            //   console.error(error.toString(), prompt, promptModerationResult)
            //   throw error
            // }

            const repliedToTweetRef = mention.referenced_tweets?.find(
              (t) => t.type === 'replied_to'
            )
            const repliedToTweet = repliedToTweetRef
              ? batch.tweets[repliedToTweetRef.id]
              : undefined

            if (
              repliedToTweet &&
              repliedToTweet.author_id === ctx.twitterBotUserId
            ) {
              const prevMessage = await db.messages.get(repliedToTweet.id)

              if (prevMessage && !prevMessage.error) {
                console.log('prevMessage', prevMessage)
                assert(prevMessage.role === 'assistant')
                message.parentMessageId = prevMessage.id
              }
            }

            await generateMessageResponse(message, ctx)

            // TODO: Re-add moderation support
            // const responseModerationResult = await checkModeration(message.response)
            // if (responseModerationResult.flagged) {
            //   const reason = Object.keys(responseModerationResult.categories)
            //     .filter((key) => responseModerationResult.categories[key])
            //     .join(', ')
            //   const error = new BotError(
            //     `Error response flagged for moderation: ${reason}`,
            //     {
            //       type: 'moderation',
            //       isFinal: true
            //     }
            //   )
            //   console.error(error.toString(), message.response, responseModerationResult)
            //   throw error
            // }
          }

          if (!ctx.dryRun) {
            const tweet = await createTweet(
              {
                text: message.response!,
                reply: {
                  in_reply_to_tweet_id: promptTweetId
                }
              },
              ctx
            )

            message.responseTweetId = tweet.id
            message.responseUrl = getTweetUrl({
              username: ctx.twitterBotHandle.replace('@', ''),
              id: message.responseTweetId
            })
          }

          // Remove any previous error processing this message
          delete message.error

          console.log('message', message)
          console.log()

          if (!ctx.dryRun) {
            await db.upsertMessage(message)
          }

          return message
        } catch (err: any) {
          console.warn('error', err)

          if (err instanceof BotError) {
            message.error = err.toString()
            message.isErrorFinal = !!err.isFinal

            if (err.type === 'network') {
              batch.hasNetworkError = true
            }

            return message
          }
        }
      },
      {
        concurrency: 2
      }
    )
  ).filter(Boolean)

  for (const res of batch.messages) {
    if (!res.error || res.isErrorFinal) {
      batch.sinceMentionId = maxTwitterId(
        batch.sinceMentionId,
        res.promptTweetId
      )
    } else {
      batch.minSinceMentionId = minTwitterId(
        batch.minSinceMentionId,
        res.promptTweetId
      )
    }
  }

  if (batch.minSinceMentionId) {
    // Rollback to the earliest tweet which wasn't processed successfully
    batch.sinceMentionId = minTwitterId(
      batch.minSinceMentionId,
      batch.sinceMentionId
    )
  }

  return batch
}
