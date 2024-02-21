import delay from 'delay'

import * as config from '../src/config.js'
import * as db from '../src/db.js'
import type * as types from '../src/types.js'
import { respondToNewMentions } from '../src/respond-to-new-mentions.js'
import { getTwitterClient, refreshTwitterAuth } from '../src/twitter-client.js'

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
    // Dynamic a state which gets persisted to the db
    sinceMentionId,

    // Services
    twitterClient,

    // Constant app runtime config
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

  let messages: types.Message[] = []
  let loopNum = 0

  do {
    try {
      console.log()
      const batch = await respondToNewMentions(ctx)

      if (session.sinceMentionId && !debugTweet) {
        sinceMentionId = maxTwitterId(sinceMentionId, session.sinceMentionId)

        if (!defaultSinceMentionId && !resolveAllMentions) {
          // Make sure it's in sync in case other processes are writing to the store
          // as well. Note: this still has a classic potential as a race condition,
          // but it's not enough to worry about for our use case.
          const recentSinceMentionId = config.get('sinceMentionId')
          sinceMentionId = maxTwitterId(sinceMentionId, recentSinceMentionId)

          if (sinceMentionId && !dryRun) {
            config.set('sinceMentionId', sinceMentionId)
          }
        }
      }

      if (earlyExit) {
        break
      }

      console.log(
        `processed ${session.messages?.length ?? 0} messages`,
        session.messages
      )
      if (session.messages?.length) {
        messages = messages.concat(session.messages)
      }

      // TODO: make this incremental
      await db.upsertTweets(session.tweets)
      await db.upsertTwitterUsers(session.users)
      // TODO: upsert mentions and messages

      if (debugTweetIds?.length) {
        break
      }
    } catch (err) {
      console.error('top-level error', err)
      await delay(5000)
      await refreshTwitterAuth()
    }
  } while (true)

  return messages
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
