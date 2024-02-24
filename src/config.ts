import dotenv from 'dotenv-safe'

import type * as types from './types.js'

dotenv.config()

export const defaultMaxNumMentionsToProcessPerBatch = 10

// Conntection ID for the Twitter account that is authed with Nango.
// Auth new accounts here: https://app.nango.dev/connections
export const nangoConnectionId = process.env.NANGO_CONNECTION_ID!
export const nangoCallbackUrl =
  process.env.NANGO_CALLBACK_URL ?? 'https://api.nango.dev/oauth/callback'

export const twitterApiPlan: types.TwitterApiPlan =
  (process.env.TWITTER_API_PLAN as types.TwitterApiPlan) ?? 'free'

if (twitterApiPlan === 'free') {
  throw new Error(
    `This bot does not support the "free" twitter API plan. You'll need to upgrade to at least the "basic" plan in order to run this bot.`
  )
}

export const defaultAnswerEngineType: types.AnswerEngineType =
  (process.env.ANSWER_ENGINE as types.AnswerEngineType) ?? 'openai'

// Twitter really doesn't like bots that tag other users in automatd replies.
// @ChatGPTBot has been suspended a few times for this in previous verisons.
export const disallowMentionsInBotReplies = false

// tweets that try to break the bot...
export const tweetIgnoreList = new Set<string>([
  // empty for now
])

// Used by the author(s) for faster testing and feedback
export const priorityUsersList = new Set<string>([
  '327034465', // transitive_bs
  '2349038684', // rileytomasek
  '1611066692330786819', // dexa_ai
  '1235525929335689217', // LofiGrind (test acct)
  '1386021646906048515', // samrcharles (test acct)
  '1598922281434103808', // ChatGPTBot
  '1757989045383106560' // AskDexa
])

// If Redis is disabled, all state will be stored in memory
export const requireRedis = process.env.REQUIRE_REDIS === 'true'
export const redisUrl = process.env.REDIS_URL
export const redisNamespaceTweets = process.env.REDIS_NAMESPACE_TWEETS ?? 'xt'
export const redisNamespaceUsers = process.env.REDIS_NAMESPACE_USERS ?? 'xu'
export const redisNamespaceMessages =
  process.env.REDIS_NAMESPACE_MESSAGES ?? 'xm'
export const redisNamespaceMentionsPrefix =
  process.env.REDIS_NAMESPACE_MENTIONS_PREFIX ?? 'xmn'
export const redisNamespaceState = process.env.REDIS_NAMESPACE_STATE ?? 'xs'
