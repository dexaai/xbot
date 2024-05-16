import pMap from 'p-map'

import { createAnswerEngine } from '../src/create-answer-engine.js'
import { parseCLIArgs } from '../src/parse-cli-args.js'
import { respondToNewMentions } from '../src/respond-to-new-mentions.js'
import { openaiClient } from '../src/services/openai-client.js'
import { getTwitterClient } from '../src/services/twitter-client.js'
import type * as types from '../src/types.js'
import { assert } from '../src/utils.js'

/**
 * Generates input data for testing an answer engine on a given tweet.
 *
 * ```sh
 * tsx bin/debug-answer-engine.ts -t '1760384146004996333'
 * ```
 */
async function main() {
  const argv = parseCLIArgs({
    name: 'debug-answer-engine',
    forceReply: true
  })

  if (!argv.flags.debugTweetIds.length) {
    console.log('Must provide at least one tweet id to debug via -t <tweet-id>')
    argv.showHelp()
    process.exit(1)
  }

  const answerEngine = createAnswerEngine(
    argv.flags.answerEngine as types.AnswerEngineType
  )

  const twitterClient = await getTwitterClient()
  const { data: twitterBotUser } = await twitterClient.users.findMyUser()
  const twitterBotUserId = twitterBotUser?.id

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
    debug: argv.flags.debug,
    dryRun: argv.flags.dryRun,
    noMentionsCache: argv.flags.noMentionsCache,
    earlyExit: argv.flags.earlyExit,
    forceReply: argv.flags.forceReply,
    resolveAllMentions: argv.flags.resolveAllMentions,
    maxNumMentionsToProcess: argv.flags.debugTweetIds.length,
    debugTweetIds: argv.flags.debugTweetIds,
    twitterBotHandle: `@${twitterBotUser.username}`,
    twitterBotHandleL: `@${twitterBotUser.username.toLowerCase()}`,
    twitterBotUserId,
    answerEngine
  }

  const batch = await respondToNewMentions(ctx)
  if (!batch.mentions.length) {
    throw new Error(
      `No valid mentions found for debug tweet ids: ${ctx.debugTweetIds?.join(
        ', '
      )}`
    )
  }

  for (const message of batch.messages) {
    assert(ctx.debugTweetIds!.includes(message.id))
  }

  console.log()
  console.log(`resolving ${batch.messages.length} message threads...`)

  const answerEngineQueries = await pMap(
    batch.messages,
    (message) => answerEngine.resolveMessageThread(message, ctx),
    {
      concurrency: 4
    }
  )

  console.log(`logging ${batch.messages.length} message threads to stderr...`)
  console.log()
  console.warn(JSON.stringify(answerEngineQueries, null, 2))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
