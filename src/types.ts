import { type Prompt } from '@dexaai/dexter'
import { type OpenAI } from 'openai'
import { type Client as TwitterClient } from 'twitter-api-sdk'
import {
  type AsyncReturnType,
  type SetOptional,
  type Simplify
} from 'type-fest'

import { type AnswerEngine } from './answer-engine.js'
import { type BotErrorType } from './bot-error.js'
import { type EntityMap, type URLEntity } from './entities.js'

export type { TwitterClient }

export type MessageType = 'tweet' | 'dm'
export type Role = 'user' | 'assistant'
export type AnswerEngineType = 'openai' | 'dexa' | 'perplexity'
export type TwitterApiPlan = 'free' | 'basic' | 'pro' | 'enterprise'

export type Context = {
  // Dynamic a state which gets persisted to the db
  sinceMentionId: string | undefined

  // Services
  twitterClient: TwitterClient
  readonly openaiClient: OpenAI

  // Constant app runtime config
  readonly debug: boolean
  readonly debugAnswerEngine: boolean
  readonly dryRun: boolean
  readonly noMentionsCache: boolean
  readonly earlyExit: boolean
  readonly forceReply: boolean
  readonly resolveAllMentions: boolean
  readonly maxNumMentionsToProcess: number
  readonly debugTweetIds?: string[]
  readonly twitterBotHandle: string
  readonly twitterBotHandleL: string
  readonly twitterBotUserId: string
  readonly answerEngine: AnswerEngine
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

  response?: string
  responseTweetId?: string
  responseMediaId?: string
  responseUrl?: string
  responseLikes?: number
  responseRetweets?: number
  responseReplies?: number
  responseDate?: string
  readonly answerEngine: AnswerEngineType

  // If this message is in response to a tweet which responded to a previous
  // message, then keep track of the parent message id so we can reconstruct
  // the conversation thread.
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

export type TwitterUrl = Simplify<
  Unpacked<NonNullable<NonNullable<Tweet['entities']>['urls']>>
>

export type TweetsQueryOptions = Simplify<
  Pick<
    Parameters<TwitterClient['tweets']['findTweetsById']>[0],
    'expansions' | 'tweet.fields' | 'user.fields'
  >
>

export type TwitterUserQueryOptions = Simplify<
  Pick<
    NonNullable<Parameters<TwitterClient['users']['findUserById']>[1]>,
    'expansions' | 'tweet.fields' | 'user.fields'
  >
>

export type TwitterQueryTweetFields = TweetsQueryOptions['tweet.fields']
export type TwitterQueryUserFields = TweetsQueryOptions['user.fields']

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
}

export type PartialTweetMentionBatch = Omit<TweetMentionBatch, 'mentions'> & {
  /**
   * Partial tweet mentions to process this batch, which get converted to full
   * `TweetMention` objects after population and validation.
   */
  mentions: PartialTweetMention[]

  /** Updates the max twitter id processed this batch */
  updateSinceMentionId: (tweetId: string) => void
}

export type TweetMentionFetchResult = {
  mentions: Tweet[]
  users: Record<string, TwitterUser>
  tweets: Record<string, Tweet>
  sinceMentionId?: string
}

export type IDGeneratorFunction = () => string

export type OpenAIModeration = Simplify<
  NonNullable<
    Unpacked<AsyncReturnType<OpenAI['moderations']['create']>['results']>
  >
>

export type AnswerEngineMessage = Prompt.Msg & {
  tweetId: string
}

export type AnswerEngineQuery = {
  // Source bot message
  message: Message

  // OpenAI chat messages in the thread containing the tweet text
  chatMessages: Prompt.Msg[]

  // OpenAI chat messages containing the raw, pruned tweet JSON
  rawChatMessages: Prompt.Msg[]

  // Raw pruned tweets in the thread
  tweets: Partial<Tweet>[]

  // Entity data mapped by type and ID
  entityMap?: EntityMap

  // Raw, pruned entity data mapped by type and ID
  rawEntityMap?: RawEntityMap
}

export type RawEntityMap = {
  users: Record<string, Partial<TwitterUser>>
  tweets: Record<string, Partial<Tweet>>
  urls: Record<string, URLEntity>
}

export type AnswerEngineContext = Pick<
  Context,
  'twitterClient' | 'twitterBotUserId' | 'twitterBotHandle' | 'answerEngine'
>
