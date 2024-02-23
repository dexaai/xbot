import delay from 'delay'

import * as db from '../src/db.js'
import type * as types from '../src/types.js'
import { createAnswerEngine } from '../src/answer-engine-utils.js'
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
  const { data: twitterBotUsaer } = await twitterClient.users.findMyUser()
  const twitterBotUserId = twitterBotUsaer?.id

  if (!twitterBotUserId) {
    throw new Error('twitter error unable to fetch current user')
  }

  async function refreshTwitterAuth() {
    twitterClient = await getTwitterClient()
  }

  console.log('automating user', twitterBotUsaer.username)

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
    twitterBotHandle: `@${twitterBotUsaer.username}`,
    twitterBotHandleL: `@${twitterBotUsaer.username.toLowerCase()}`,
    twitterBotUserId,
    answerEngine
  }

  const batches: types.TweetMentionBatch[] = []

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

      if (batch.hasNetworkError) {
        console.warn('network error; sleeping...')
        await delay(10_000)
      }

      if (batch.hasTwitterRateLimitError) {
        console.warn('twitter rate limit error; sleeping...')
        await delay(30_000)
      }

      if (batch.hasTwitterAuthError) {
        console.warn('twitter auth error; refreshing...')
        await refreshTwitterAuth()
      }
    } catch (err) {
      console.error('top-level error', err)
      await delay(5000)
      await refreshTwitterAuth()
    }
  } while (true)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
