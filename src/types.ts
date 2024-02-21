import type { Client as TwitterClient } from 'twitter-api-sdk'
import type { AsyncReturnType, SetOptional, Simplify } from 'type-fest'

import type { BotErrorType } from './bot-error.js'

export type { TwitterClient }

export type MessageType = 'tweet' | 'dm'
export type Role = 'user' | 'assistant'

export type Context = {
  // Dynamic a state which gets persisted to the db
  sinceMentionId: string | undefined

  // Services
  readonly twitterClient: TwitterClient

  // Constant app runtime config
  readonly debug: boolean
  readonly dryRun: boolean
  readonly noCache: boolean
  readonly earlyExit: boolean
  readonly forceReply: boolean
  readonly resolveAllMentions: boolean
  readonly maxNumMentionsToProcess: number
  readonly debugTweetIds?: string[]
  readonly twitterBotHandle: string
  readonly twitterBotHandleL: string
  readonly twitterBotUserId: string
}

export interface Message {
  // We use the tweet id as the message id
  readonly id: string

  readonly type: MessageType
  readonly role: Role
  readonly prompt: string
  readonly promptTweetId: string
  readonly promptUserId: string
  readonly promptUsername?: string
  promptUrl?: string
  promptLikes?: number
  promptRetweets?: number
  promptReplies?: number
  promptDate?: string
  // promptLanguage?: string
  // promptLanguageScore?: number

  response?: string
  responseTweetId?: string
  responseMediaId?: string
  responseUrl?: string
  responseLikes?: number
  responseRetweets?: number
  responseReplies?: number
  responseDate?: string

  conversationId?: string
  parentMessageId?: string

  error?: string
  errorType?: BotErrorType
  errorStatus?: number
  isErrorFinal?: boolean

  priorityScore?: number
  numFollowers?: number
  isReply?: boolean
}

type Unpacked<T> = T extends (infer U)[] ? U : T

export type Tweet = Simplify<
  NonNullable<
    Unpacked<AsyncReturnType<TwitterClient['tweets']['findTweetsById']>['data']>
  >
>
export type TwitterUser = Simplify<
  NonNullable<AsyncReturnType<TwitterClient['users']['findMyUser']>['data']>
>
export type CreatedTweet = Simplify<
  NonNullable<AsyncReturnType<TwitterClient['tweets']['createTweet']>['data']>
>

export type TweetsQueryOptions = Simplify<
  Pick<
    Parameters<TwitterClient['tweets']['findTweetsById']>[0],
    'expansions' | 'tweet.fields' | 'user.fields'
  >
>

export type TwitterUserIdMentionsQueryOptions = Simplify<
  NonNullable<Parameters<TwitterClient['tweets']['usersIdMentions']>[1]>
>

export type TweetMentionAnnotations = {
  prompt: string
  numMentions: number
  priorityScore: number
  numFollowers: number
  promptUrl: string
  isReply: boolean
}

export type TweetMention = Simplify<Tweet & TweetMentionAnnotations>
export type PartialTweetMention = SetOptional<
  TweetMention,
  keyof TweetMentionAnnotations
>

export type TweetMentionBatch = {
  mentions: TweetMention[]
  numMentionsPostponed: number

  users: Record<string, TwitterUser>
  tweets: Record<string, Tweet>

  minSinceMentionId?: string
  sinceMentionId?: string

  // Messages generated from this batch
  messages: Message[]

  hasTwitterRateLimitError: boolean
  hasTwitterAuthError: boolean
  hasNetworkError: boolean

  readonly updateSinceMentionId: (tweetId: string) => void
}

export type PartialTweetMentionBatch = Omit<TweetMentionBatch, 'mentions'> & {
  mentions: PartialTweetMention[]
}

export type TweetMentionFetchResult = {
  mentions: Tweet[]
  users: Record<string, TwitterUser>
  tweets: Record<string, Tweet>
  sinceMentionId?: string
}

export type IDGeneratorFunction = () => string
