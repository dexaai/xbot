import delay from 'delay'
import ms from 'ms'
import random from 'random'

import { BotError } from '../src/bot-error.js'
import { createAnswerEngine } from '../src/create-answer-engine.js'
import * as db from '../src/db.js'
import { parseCLIArgs } from '../src/parse-cli-args.js'
import { respondToNewMentions } from '../src/respond-to-new-mentions.js'
import { openaiClient } from '../src/services/openai-client.js'
import { getTwitterClient } from '../src/services/twitter-client.js'
import { maxTwitterId } from '../src/twitter-utils.js'
import type * as types from '../src/types.js'
import { pick } from '../src/utils.js'

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

  const twitterClient = await getTwitterClient()
  const { data: twitterBotUser } = await twitterClient.users.findMyUser()
  const twitterBotUserId = twitterBotUser?.id

  if (!twitterBotUserId) {
    throw new Error('twitter error unable to fetch current user')
  }

  const dbSinceMentionId = await db.getSinceMentionId({ twitterBotUserId })
  const initialSinceMentionId =
    (argv.flags.resolveAllMentions
      ? undefined
      : argv.flags.sinceMentionId || dbSinceMentionId) ?? '0'

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

  console.log('automating user', {
    username: twitterBotUser.username,
    name: twitterBotUser.name,
    id: twitterBotUser.id,
    sinceMentionId: ctx.sinceMentionId,
    ...(dbSinceMentionId === ctx.sinceMentionId
      ? undefined
      : { dbSinceMentionId })
  })

  async function refreshTwitterAuth() {
    ctx.twitterClient = await getTwitterClient()
  }

  const batches: types.TweetMentionBatch[] = []
  let numConsecutiveBatchesWithoutMentions = 0
  let numConsecutiveBatchesWithErrors = 0

  do {
    try {
      console.log()
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

      const isEmptyBatch = !batch.mentions.length

      if (!isEmptyBatch) {
        console.log(
          `processed ${batch.messages?.length ?? 0} messages`,
          batch.messages
        )
      }

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

      if (isEmptyBatch) {
        numConsecutiveBatchesWithoutMentions++
      } else {
        numConsecutiveBatchesWithoutMentions = 0
      }

      if (batchHasError) {
        if (batch.hasNetworkError) {
          console.warn('\nnetwork error; sleeping for 10s...')
          await delay(10_000)
        }

        if (batch.hasTwitterRateLimitError) {
          console.warn('\ntwitter rate limit error; sleeping for 30s...')
          await delay(30_000)
        }

        if (batch.hasTwitterAuthError) {
          console.warn('\ntwitter auth error; refreshing after 5s...')
          await delay(5_000)
          await refreshTwitterAuth()
        }
      } else if (isEmptyBatch) {
        const delayMs = calculateRetryDelay(
          numConsecutiveBatchesWithoutMentions
        )
        console.warn(
          `\nno tweet mentions found; sleeping for ${ms(delayMs)}...`
        )
        await delay(delayMs)
      }
    } catch (err: any) {
      numConsecutiveBatchesWithErrors++
      numConsecutiveBatchesWithoutMentions = 0

      const delayMs = calculateRetryDelay(numConsecutiveBatchesWithErrors, {
        jitter: true
      })
      console.error(
        `\ntop-level error; pausing for ${ms(delayMs)}...`,
        err.message,
        ...[err instanceof BotError ? pick(err as any, 'type', 'status') : err]
      )
      await delay(delayMs)
      await refreshTwitterAuth()
    }
  } while (true)
}

function calculateRetryDelay(
  numRetries: number,
  {
    delayMs = 5_000, // 5 seconds
    maxDelayMs = 1_000 * 60 * 5, // 5 minutes
    jitter = false
  }: { delayMs?: number; maxDelayMs?: number; jitter?: boolean } = {}
) {
  const delay =
    delayMs *
    2 **
      (Math.max(1, Math.min(numRetries, 10)) +
        (jitter ? random.float(0, 0.5) : 0))

  return Math.max(Math.min(delay, maxDelayMs), 0)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
