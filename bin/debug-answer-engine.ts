import type * as types from '../src/types.js'
import { createAnswerEngine } from '../src/answer-engine-utils.js'
import { openaiClient } from '../src/openai-client.js'
import { respondToNewMentions } from '../src/respond-to-new-mentions.js'
import { getTwitterClient } from '../src/twitter-client.js'
import { assert } from '../src/utils.js'

/**
 * Generates test data for testing an answer engine for a given tweet.
 *
 * ```sh
 * tsx bin/debug-answer-engine.ts <tweet-id>
 * ```
 */
async function main() {
  const debug = !!process.env.DEBUG
  const noMentionsCache = !!process.env.NO_CACHE
  const debugTweetId = process.argv[2]?.trim()

  if (!debugTweetId) {
    throw new Error('Must provide at least one tweet id to debug')
  }

  const answerEngineType: types.AnswerEngineType =
    (process.env.ANSWER_ENGINE as types.AnswerEngineType) ?? 'openai'
  const answerEngine = createAnswerEngine(answerEngineType)

  let twitterClient = await getTwitterClient()
  const { data: twitterBotUsaer } = await twitterClient.users.findMyUser()
  const twitterBotUserId = twitterBotUsaer?.id

  if (!twitterBotUserId) {
    throw new Error('twitter error unable to fetch current user')
  }

  const ctx: types.Context = {
    // Dynamic a state which gets persisted to the db
    sinceMentionId: '0',

    // Services
    twitterClient,
    openaiClient,

    // This is the key field for this script which causes processing to return
    // before having the answer engine generates a response normally
    debugAnswerEngine: true,

    // Constant app runtime config
    debug,
    dryRun: true,
    noMentionsCache,
    earlyExit: false,
    forceReply: true,
    resolveAllMentions: false,
    maxNumMentionsToProcess: 1,
    debugTweetIds: [debugTweetId],
    twitterBotHandle: `@${twitterBotUsaer.username}`,
    twitterBotHandleL: `@${twitterBotUsaer.username.toLowerCase()}`,
    twitterBotUserId,
    answerEngine
  }

  const batch = await respondToNewMentions(ctx)
  if (!batch.mentions.length) {
    throw new Error(`No valid mentions found for tweet id: ${debugTweetId}`)
  }

  const message = batch.messages[0]
  assert(message)
  assert(message.id === debugTweetId)

  return answerEngine.resolveMessageThread(message, ctx)
}

main()
  .then((res) => {
    if (res) {
      console.log(JSON.stringify(res, null, 2))
    }

    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
