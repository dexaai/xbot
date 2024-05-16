import pMap from 'p-map'

import * as db from '../src/db.js'
import { BotError } from './bot-error.js'
import { getTweetMentionsBatch } from './mentions.js'
import { checkModeration } from './moderations.js'
import { createTweet } from './twitter.js'
import { getTweetUrl, maxTwitterId, minTwitterId } from './twitter-utils.js'
import type * as types from './types.js'
import { assert, getDebugMention, pick } from './utils.js'

/**
 * Fetches a batch of unanswered mentions, generates response messages to each
 * of them via the answer engine, and tweets the responses.
 */
export async function respondToNewMentions(ctx: types.Context) {
  console.log(
    'responding to new mentions since',
    ctx.sinceMentionId || 'forever'
  )

  // Fetch the mentions to process in this batch
  const batch = await getTweetMentionsBatch(ctx)

  if (!batch.mentions.length) {
    return batch
  }

  console.log(
    `processing ${batch.mentions.length} tweet mentions`,
    { numMentionsPostponed: batch.numMentionsPostponed },
    batch.mentions.map(getDebugMention)
  )
  console.log()

  if (ctx.earlyExit) {
    if (batch.mentions.length > 0) {
      console.log('mentions', JSON.stringify(batch.mentions, null, 2))
      // console.log('users', JSON.stringify(batch.users, null, 2))
      // console.log('tweets', JSON.stringify(batch.tweets, null, 2))
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
        const promptUsername =
          promptUser?.username ??
          (await db.tryGetTwitterUsernameByUserId(promptUserId))

        assert(promptTweetId, 'missing promptTweetId')
        assert(promptUsername, 'missing promptUsername')

        let message: types.Message = {
          id: promptTweetId,
          type: 'tweet',
          role: 'user',
          answerEngine: ctx.answerEngine.type,
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

        function setResponseTweet(tweet: types.CreatedTweet) {
          message.responseTweetId = tweet.id
          message.responseUrl = getTweetUrl({
            username: ctx.twitterBotHandle.replace('@', ''),
            id: message.responseTweetId
          })
        }

        if (!prompt) {
          message.error = 'empty prompt'
          message.isErrorFinal = true
          return message
        }

        if (batch.hasNetworkError) {
          message.error = 'network error'
          return message
        }

        if (batch.hasTwitterRateLimitError) {
          message.error = 'Twitter rate limited'
          return message
        }

        if (batch.hasTwitterAuthError) {
          message.error = 'Twitter auth expired'
          return message
        }

        try {
          // NOTE: Disabling this check for now because the GET tweets endpoint
          // is severely rate-limited.
          // Double-check that the tweet still exists before resolving it
          // const promptTweet = await twitter.findTweetById(promptTweetId, ctx)
          // if (!promptTweet) {
          //   throw new BotError(
          //     `Tweet not found (possibly deleted): ${promptTweetId}`,
          //     {
          //       type: 'twitter:forbidden',
          //       isFinal: true
          //     }
          //   )
          // }

          const prevPartialMessage = await db.messages.get(promptTweetId)
          const hasPrevMessageResponse = !!prevPartialMessage?.response
          const bypassMessageResponseGeneration =
            hasPrevMessageResponse && !ctx.forceReply

          if (hasPrevMessageResponse) {
            message = {
              ...prevPartialMessage,
              ...message
            }

            console.log('resuming', {
              ...getDebugMention(mention),
              ...pick(message as any, 'response', 'error')
            })
          }

          if (!bypassMessageResponseGeneration) {
            console.log('processing', getDebugMention(mention))

            const promptModerationResult = await checkModeration(prompt, ctx)
            if (promptModerationResult.flagged) {
              const reason = Object.keys(promptModerationResult.categories)
                .filter(
                  (key: any) => (promptModerationResult.categories as any)[key]
                )
                .join(', ')
              const error = new BotError(
                `Error prompt flagged for moderation: ${reason}`,
                {
                  type: 'moderation',
                  isFinal: true
                }
              )
              console.error(error.toString(), prompt, promptModerationResult)
              throw error
            }

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

            if (ctx.debugAnswerEngine) {
              return message
            }

            await ctx.answerEngine.populateMessageResponse(message, ctx)

            const responseModerationResult = await checkModeration(
              message.response,
              ctx
            )
            if (responseModerationResult.flagged) {
              const reason = Object.keys(responseModerationResult.categories)
                .filter(
                  (key) => (responseModerationResult.categories as any)[key]
                )
                .join(', ')
              const error = new BotError(
                `Error ${ctx.answerEngine.type} response flagged for moderation: ${reason}`,
                {
                  type: 'moderation',
                  isFinal: true
                }
              )
              console.error(
                error.toString(),
                message.response,
                responseModerationResult
              )
              throw error
            }
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

            setResponseTweet(tweet)
          }

          // Remove any previous error state from processing this message
          delete message.error
          delete message.errorType
          delete message.errorStatus
          delete message.isErrorFinal

          console.log()
          console.log('message', message)
          console.log()

          return message
        } catch (err: any) {
          message.error = err.toString()

          if (err instanceof BotError) {
            console.warn('bot error', err.toString(), {
              type: err.type,
              isFinal: err.isFinal,
              status: err.status
            })

            message.errorType = err.type
            message.errorStatus = err.status
            message.isErrorFinal = !!err.isFinal

            if (err.type === 'network') {
              batch.hasNetworkError = true
            } else if (err.type === 'twitter:auth') {
              batch.hasTwitterAuthError = true
            } else if (err.type === 'twitter:rate-limit') {
              batch.hasTwitterRateLimitError = true
            } else if (err.type === 'moderation') {
              try {
                if (!ctx.dryRun) {
                  const tweet = await createTweet(
                    {
                      // NOTE: We're including the tweet id here, because the twitter API doesn't allow us to create multiple tweets with the same content, and this allows us to bypass that restriction.
                      text: `Your tweet may violate our usage policy. ${err.toString()}\n\nRef: ${promptTweetId}`,
                      reply: {
                        in_reply_to_tweet_id: promptTweetId
                      }
                    },
                    ctx
                  )

                  setResponseTweet(tweet)
                  await db.upsertMessage(message)
                }
              } catch (err2: any) {
                console.warn(
                  `warning: twitter error responding to tweet after ${err.type} error`,
                  err2.toString()
                )
              }
            }

            return message
          }

          // Unknown application error; bail out
          throw err
        } finally {
          try {
            if (!ctx.dryRun) {
              // Ensure that updates to this message are persisted to the db
              await db.upsertMessage(message)
            }
          } catch (err: any) {
            console.warn('ignoring message upsert error', err.toString())
          }
        }
      },
      {
        concurrency: 2
      }
    )
  ).filter(Boolean)

  // Update sinceMentionId to the most recent tweet mention processed
  for (const message of batch.messages) {
    if (!message.error || message.isErrorFinal) {
      batch.sinceMentionId = maxTwitterId(
        batch.sinceMentionId,
        message.promptTweetId
      )
    } else {
      batch.minSinceMentionId = minTwitterId(
        batch.minSinceMentionId,
        message.promptTweetId
      )
    }
  }

  if (batch.minSinceMentionId) {
    // Rollback to the earliest tweet which wasn't processed successfully.
    // We want to make sure that we don't skip past any tweets which were
    // either skipped over or which failed to process.
    batch.sinceMentionId = minTwitterId(
      batch.minSinceMentionId,
      batch.sinceMentionId
    )
  }

  return batch
}
