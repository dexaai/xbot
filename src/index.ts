import * as config from './config.js'
import * as db from './db.js'
import type * as types from './types.js'
import { getTwitterClient } from './twitter-client.js'

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

  const twitterClient = await getTwitterClient()
  const { data: user } = await twitterClient.users.findMyUser()

  if (!user?.id) {
    throw new Error('twitter error unable to fetch current user')
  }

  console.log('automating user', user.username)

  const maxNumMentionsToProcess = isNaN(overrideMaxNumMentionsToProcess)
    ? config.defaultMaxNumMentionsToProcessPerBatch
    : overrideMaxNumMentionsToProcess

  let sinceMentionId =
    (resolveAllMentions
      ? undefined
      : overrideSinceMentionId || (await db.getSinceMentionId())) ?? '0'

  const ctx: types.Context = {
    sinceMentionId,
    twitterClient,
    debug,
    dryRun,
    noCache,
    earlyExit,
    forceReply,
    resolveAllMentions,
    maxNumMentionsToProcess,
    debugTweetIds,
    twitterBotHandle: `@${user.username}`,
    twitterBotHandleL: `@${user.username.toLowerCase()}`,
    twitterBotUserId: user.id
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
