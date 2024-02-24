import delay from 'delay'
import ms from 'ms'
import random from 'random'

import * as db from '../src/db.js'
import type * as types from '../src/types.js'
import { createAnswerEngine } from '../src/create-answer-engine.js'
import { openaiClient } from '../src/openai-client.js'
import { parseCLIArgs } from '../src/parse-cli-args.js'
import { respondToNewMentions } from '../src/respond-to-new-mentions.js'
import { getTwitterClient } from '../src/twitter-client.js'
import { maxTwitterId } from '../src/twitter-utils.js'

/**
 * This is the main bot entrypoint. The bot boils down to a big while loop,
 * where for each iteration, it fetches a batch of new mentions, processes them,
 * generates responses using the configured answer engine, and then tweets the
 * responses to twitter.
 */
async function main() {
  const argv = parseCLIArgs()
  const answerEngine = createAnswerEngine(
    argv.flags.answerEngine as types.AnswerEngineType
  )

  let twitterClient = await getTwitterClient()
  const { data: twitterBotUser } = await twitterClient.users.findMyUser()
  const twitterBotUserId = twitterBotUser?.id

  if (!twitterBotUserId) {
    throw new Error('twitter error unable to fetch current user')
  }

  async function refreshTwitterAuth() {
    twitterClient = await getTwitterClient()
  }

  console.log('automating user', twitterBotUser.username, twitterBotUser.id)

  let initialSinceMentionId =
    (argv.flags.resolveAllMentions
      ? undefined
      : argv.flags.sinceMentionId ||
        (await db.getSinceMentionId({
          twitterBotUserId
        }))) ?? '0'

  const ctx: types.Context = {
    // Dynamic a state which gets persisted to the db
    sinceMentionId: initialSinceMentionId,

    // Services
    twitterClient,
    openaiClient,

    // Constant app runtime config
    debug: argv.flags.debug,
    debugAnswerEngine: false,
    dryRun: argv.flags.dryRun,
    noMentionsCache: argv.flags.noMentionsCache,
    earlyExit: argv.flags.earlyExit,
    forceReply: argv.flags.forceReply,
    resolveAllMentions: argv.flags.resolveAllMentions,
    maxNumMentionsToProcess: argv.flags.maxNumMentionsToProcess,
    debugTweetIds: argv.flags.debugTweetIds,
    twitterBotHandle: `@${twitterBotUser.username}`,
    twitterBotHandleL: `@${twitterBotUser.username.toLowerCase()}`,
    twitterBotUserId,
    answerEngine
  }

  const batches: types.TweetMentionBatch[] = []
  let numConsecutiveBatchesWithoutMentions = 0
  let numConsecutiveBatchesWithErrors = 0

  do {
    try {
      const batch = await respondToNewMentions(ctx)
      batches.push(batch)

      if (batch.sinceMentionId && !ctx.debugTweetIds?.length) {
        ctx.sinceMentionId = maxTwitterId(
          ctx.sinceMentionId,
          batch.sinceMentionId
        )

        if (!ctx.resolveAllMentions) {
          // Make sure it's in sync in case other processes are writing to the store
          // as well. Note: this still has the potential for a race condition, but
          // it's not enough to worry about for our use case.
          const recentSinceMentionId = await db.getSinceMentionId(ctx)
          ctx.sinceMentionId = maxTwitterId(
            ctx.sinceMentionId,
            recentSinceMentionId
          )

          if (ctx.sinceMentionId && !ctx.dryRun) {
            await db.setSinceMentionId(ctx.sinceMentionId, ctx)
          }
        }
      }

      if (ctx.earlyExit) {
        break
      }

      console.log(
        `processed ${batch.messages?.length ?? 0} messages`,
        batch.messages
      )

      if (ctx.debugTweetIds?.length) {
        break
      }

      const batchHasError =
        batch.hasNetworkError ||
        batch.hasTwitterRateLimitError ||
        batch.hasTwitterAuthError

      if (!batchHasError) {
        numConsecutiveBatchesWithErrors = 0
      }

      if (!batch.mentions.length) {
        numConsecutiveBatchesWithoutMentions++
      } else {
        numConsecutiveBatchesWithoutMentions = 0
      }

      if (batchHasError) {
        if (batch.hasNetworkError) {
          console.warn('network error; sleeping for 10s...')
          await delay(10_000)
        }

        if (batch.hasTwitterRateLimitError) {
          console.warn('twitter rate limit error; sleeping for 30s...')
          await delay(30_000)
        }

        if (batch.hasTwitterAuthError) {
          console.warn('twitter auth error; refreshing after 5s...')
          await delay(5_000)
          await refreshTwitterAuth()
        }
      } else if (!batch.mentions.length) {
        const delayMs = calculateRetryDelay(
          numConsecutiveBatchesWithoutMentions
        )
        console.warn(`no tweet mentions found; sleeping for ${ms(delayMs)}...`)
        await delay(delayMs)
      }
    } catch (err: any) {
      numConsecutiveBatchesWithErrors++
      numConsecutiveBatchesWithoutMentions = 0

      const delayMs = calculateRetryDelay(numConsecutiveBatchesWithErrors, {
        jitter: true
      })
      console.error(
        `top-level error; pausing for ${ms(delayMs)}...`,
        err.toString(),
        err
      )
      await delay(delayMs)
      await refreshTwitterAuth()
    }
  } while (true)
}

function calculateRetryDelay(
  numRetries: number,
  { jitter = false }: { jitter?: boolean } = {}
) {
  return (
    5_000 *
    2 **
      (Math.max(1, Math.min(numRetries, 4)) +
        (jitter ? random.float(0, 0.5) : 0))
  )
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
