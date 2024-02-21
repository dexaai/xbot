import type { Client as TwitterClient } from 'twitter-api-sdk'
import type { AsyncReturnType, Simplify } from 'type-fest'

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
  // We use the prompt tweet id as the message id
  readonly id: string

  readonly role: Role
  readonly type: MessageType

  readonly prompt: string
  readonly promptTweetId: string
  readonly promptUserId: string
  readonly promptUsername: string
  promptUrl?: string
  promptLikes?: number
  promptRetweets?: number
  promptReplies?: number
  promptDate?: string
  // promptLanguage?: string
  // promptLanguageScore?: number

  response?: string
  responseTweetIds?: string[]
  responseMediaId?: string
  responseUrl?: string
  responseLikes?: number
  responseRetweets?: number
  responseReplies?: number
  responseDate?: string

  conversationId?: string
  parentMessageId?: string

  error?: string
  isErrorFinal?: boolean

  priorityScore?: number
  numFollowers?: number
  isReply?: boolean
}

export type Session = {
  messages: Message[]
  isRateLimitedTwitter: boolean
  isExpiredAuthTwitter: boolean
  hasNetworkError: boolean
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

export type TweetMention = Simplify<
  Tweet & {
    prompt?: string
    numMentions?: number
    priorityScore?: number
    numFollowers?: number
    promptUrl?: string
    isReply?: boolean
  }
>

export type TweetMentionBatch = {
  mentions: TweetMention[]
  numMentionsPostponed: number

  users: Record<string, Partial<TwitterUser>>
  tweets: Record<string, TweetMention>

  minSinceMentionId?: string
  sinceMentionId?: string

  readonly updateSinceMentionId: (tweetId: string) => void
}

export type TweetMentionResult = {
  mentions: TweetMention[]
  users: Record<string, Partial<TwitterUser>>
  tweets: Record<string, TweetMention>
  sinceMentionId: string
}

export type IDGeneratorFunction = () => string
