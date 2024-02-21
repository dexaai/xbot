import type { Client as TwitterClient } from 'twitter-api-sdk'
import type { AsyncReturnType, Simplify } from 'type-fest'

export type { TwitterClient }

export type Config = {
  accessToken?: string
  refreshToken?: string
  sinceMentionId?: string
}

export type InteractionType = 'tweet' | 'dm'
export type Role = 'user' | 'assistant'

export interface Interaction {
  // id: string // TODO

  role?: Role
  type?: InteractionType

  prompt: string
  promptTweetId: string
  promptUserId: string
  promptUsername: string
  promptUrl?: string
  promptLikes?: number
  promptRetweets?: number
  promptReplies?: number
  promptDate?: string
  promptLanguage?: string
  promptLanguageScore?: number

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

export interface Session {
  interactions: Interaction[]
  isRateLimitedTwitter: boolean
  isExpiredAuthTwitter: boolean
  sinceMentionId?: string
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

export type TwitterUserIdMentionsQueryOptions = Parameters<
  TwitterClient['tweets']['usersIdMentions']
>[1]

export type TweetMention = Tweet & {
  prompt?: string
  numMentions?: number
  priorityScore?: number
  numFollowers?: number
  promptUrl?: string
  isReply?: boolean
}

export type TweetMentionBatch = {
  mentions: TweetMention[]
  users: Record<string, Partial<TwitterUser>>
  tweets: Record<string, TweetMention>
  minSinceMentionId?: string
  sinceMentionId?: string
  numMentionsPostponed: number
}

export type TweetMentionResult = {
  mentions: TweetMention[]
  users: Record<string, Partial<TwitterUser>>
  tweets: Record<string, TweetMention>
  sinceMentionId: string
}
