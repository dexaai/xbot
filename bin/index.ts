import delay from 'delay'

import * as config from '../src/config.js'
import * as db from '../src/db.js'
import type * as types from '../src/types.js'
import { createAnswerEngine } from '../src/answer-engine-utils.js'
import { openaiClient } from '../src/openai-client.js'
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
  const debug = !!process.env.DEBUG
  const dryRun = !!process.env.DRY_RUN
  const noCache = !!process.env.NO_CACHE
  const earlyExit = !!process.env.EARLY_EXIT
  const forceReply = !!process.env.FORCE_REPLY
  const resolveAllMentions = !!process.env.RESOLVE_ALL_MENTIONS
  const debugTweetIds = process.env.DEBUG_TWEET_IDS?.split(',').map((id) =>
    id.trim()
  )
  const overrideSinceMentionId = process.env.SINCE_MENTION_ID
  const overrideMaxNumMentionsToProcess = parseInt(
    process.env.MAX_NUM_MENTIONS_TO_PROCESS ?? '',
    10
  )
  const answerEngineType: types.AnswerEngineType =
    (process.env.ANSWER_ENGINE as types.AnswerEngineType) ?? 'openai'
  const answerEngine = createAnswerEngine(answerEngineType)

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

  const maxNumMentionsToProcess = isNaN(overrideMaxNumMentionsToProcess)
    ? config.defaultMaxNumMentionsToProcessPerBatch
    : overrideMaxNumMentionsToProcess

  let initialSinceMentionId =
    (resolveAllMentions
      ? undefined
      : overrideSinceMentionId ||
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
    debug,
    debugAnswerEngine: false,
    dryRun,
    noCache,
    earlyExit,
    forceReply,
    resolveAllMentions,
    maxNumMentionsToProcess,
    debugTweetIds,
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

        if (!overrideMaxNumMentionsToProcess && !resolveAllMentions) {
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

      if (debugTweetIds?.length) {
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
