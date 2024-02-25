import { Msg, stringifyForModel } from '@dexaai/dexter'
import pMap from 'p-map'

import * as config from '../src/config.js'
import * as db from './db.js'
import type * as types from './types.js'
import { BotError } from './bot-error.js'
import {
  type EntityMap,
  convertTweetToEntityMap,
  mergeEntityMaps
} from './entities.js'
import {
  getPrunedTweet,
  getPrunedTwitterUser,
  sanitizeTweetText,
  stripUserMentions
} from './twitter-utils.js'
import { assert } from './utils.js'

export abstract class AnswerEngine {
  readonly type: types.AnswerEngineType

  constructor({ type }: { type: types.AnswerEngineType }) {
    this.type = type
  }

  async populateMessageResponse(
    message: types.Message,
    ctx: types.AnswerEngineContext
  ) {
    const query = await this.resolveMessageThread(message, ctx)
    console.log(`>>> ${this.type} answer engine`, query)

    message.response = await this.generateResponseForQuery(query, ctx)

    console.log(
      `<<< ${this.type} answer engine response for message ${message.id}`,
      message.response
    )
  }

  async generateResponseForQuery(
    query: types.AnswerEngineQuery,
    ctx: types.AnswerEngineContext
  ): Promise<string> {
    let response = await this._generateResponseForQuery(query, ctx)

    if (config.disallowMentionsInBotReplies) {
      response = stripUserMentions(response).trim()
    }

    try {
      response = sanitizeTweetText(response, {
        label: `generated by answer engine "${this.type}"`
      })
    } catch (err: any) {
      throw new BotError(err.message, {
        type: 'answer-engine:invalid-response',
        isFinal: true,
        cause: err
      })
    }

    return response
  }

  /**
   * Takes in a source bot `message`, a converted array of AnswerEngineMessage
   * objects representing the source twitter thread, and uses the underlying
   * answer engine to generate a response as a plaintext string.
   */
  protected abstract _generateResponseForQuery(
    query: types.AnswerEngineQuery,
    ctx: types.AnswerEngineContext
  ): Promise<string>

  /**
   * Resolves all of the bot-related messages from a twitter thread, starting
   * from a leaf tweet, and traversing its parents – including any previous bot
   * mentions and responses. Returns the thread in a format compatible with the
   * OpenAI chat-completions API.
   */
  async resolveMessageThread(
    message: types.Message,
    ctx: types.AnswerEngineContext,
    {
      resolvePrevTweetsInThread = true,
      maxChatMessages = 30
    }: {
      resolvePrevTweetsInThread?: boolean
      maxChatMessages?: number
    } = {}
  ): Promise<types.AnswerEngineQuery> {
    const prevTweetsInThread: types.Tweet[] = []
    const leafMessage = message
    let messages: types.Message[] = [message]

    // Resolve all previous bot-related messages in the thread
    do {
      if (!message.parentMessageId) break

      const parentMessage = await db.messages.get(message.parentMessageId)
      if (!parentMessage) break

      message = parentMessage
      messages.push(message)
    } while (true)

    // Resolve any previous non-bot-related tweets in the thread
    if (resolvePrevTweetsInThread) {
      let tweet = await db.tryGetTweetById(message.promptTweetId, ctx, {
        fetchFromTwitter: true
      })

      while (tweet) {
        const repliedToTweetRef = tweet.referenced_tweets?.find(
          (t) => t.type === 'replied_to'
        )
        if (!repliedToTweetRef) break

        const repliedToTweet = await db.tryGetTweetById(
          repliedToTweetRef.id,
          ctx,
          {
            fetchFromTwitter: true
          }
        )
        if (!repliedToTweet) break

        tweet = repliedToTweet
        prevTweetsInThread.push(tweet)
      }
    }

    // Reverse the messages so the oldest ones are first
    messages.reverse()
    prevTweetsInThread.reverse()

    // console.log('messages', messages)
    // console.log('prevTweetsInThread', prevTweetsInThread)

    // Filter any messages which have errors, unless it's the latest message we're
    // currently trying to resolve (which may have previously encountered an error
    // that we're currently retrying to process)
    messages = messages.filter((m) => !m.error || m === leafMessage)

    const userIdToUsernameMap: Record<string, string | undefined> = {}
    for (const m of messages) {
      userIdToUsernameMap[m.promptUserId] = m.promptUsername
    }

    for (const tweet of prevTweetsInThread) {
      if (!userIdToUsernameMap[tweet.author_id!]) {
        userIdToUsernameMap[tweet.author_id!] =
          await db.tryGetTwitterUsernameByUserId(tweet.author_id)
      }
    }

    const answerEngineMessagesForPrevTweets =
      prevTweetsInThread.map<types.AnswerEngineMessage>((tweet) =>
        // TODO: sanitize this tweet text to handle t.co links and @mentions
        // TODO: unfurl quote tweets and retweets which likely have valuable
        // context
        ({
          ...Msg.user(tweet.text, {
            name: userIdToUsernameMap[tweet.author_id!]
          }),
          tweetId: tweet.id
        })
      )

    const answerEngineMessagesForBotMessages =
      messages.flatMap<types.AnswerEngineMessage>((message) =>
        [
          {
            ...Msg.user(message.prompt, {
              name: userIdToUsernameMap[message.promptUserId]
            }),
            tweetId: message.promptTweetId
          },

          message.response && message !== leafMessage
            ? {
                ...Msg.assistant(message.response!, {
                  name: userIdToUsernameMap[ctx.twitterBotUserId]
                }),
                tweetId: message.responseTweetId!
              }
            : null
        ].filter(Boolean)
      )

    let answerEngineMessages = answerEngineMessagesForPrevTweets.concat(
      answerEngineMessagesForBotMessages
    )

    if (maxChatMessages > 0) {
      // TODO: more intelligent compression / truncation of the input thread if it's
      // too long
      answerEngineMessages = answerEngineMessages
        .reverse()
        .slice(0, maxChatMessages)
        .reverse()
    }

    const chatMessages = answerEngineMessages.map(
      ({ tweetId, ...message }) => message
    )

    // Resolve all entity maps for the tweets and messages in the thread and then
    // condense them into a single, normalized enitity map
    let entityMap: EntityMap = {}

    // Construct a raw array of tweets to pass to the answer engine, which may
    // be easier to work with than our AnswerEngineMessage format
    const tweets = (
      await pMap(
        answerEngineMessages,
        async (message) => {
          const { tweetId } = message
          assert(tweetId)

          const tweet = await db.tryGetTweetById(tweetId, ctx, {
            fetchFromTwitter: true
          })
          if (!tweet) return

          const tweetEntityMap = await convertTweetToEntityMap(tweet, ctx, {
            fetchMissingEntities: true
          })

          entityMap = mergeEntityMaps(entityMap, tweetEntityMap)

          return getPrunedTweet(tweet)
        },
        {
          concurrency: 8
        }
      )
    ).filter(Boolean)

    const rawChatMessages = tweets.map((tweet) =>
      tweet.author_id === ctx.twitterBotUserId
        ? Msg.assistant(stringifyForModel(tweet), {
            name: userIdToUsernameMap[tweet.author_id!]
          })
        : Msg.user(stringifyForModel(tweet), {
            name: userIdToUsernameMap[tweet.author_id!]
          })
    )

    const rawEntityMap: types.RawEntityMap = {
      users: {},
      tweets: {}
    }

    if (entityMap?.users) {
      for (const user of Object.values(entityMap.users)) {
        assert(user.twitterId)
        const twitterUser = await db.tryGetUserById(user.twitterId)
        if (!twitterUser) continue
        rawEntityMap.users[user.twitterId] = getPrunedTwitterUser(twitterUser)
      }
    }

    if (entityMap?.tweets) {
      for (const tweet of Object.values(entityMap.tweets)) {
        assert(tweet.id)
        const twittertweet = await db.tryGetTweetById(tweet.id, ctx)
        if (!twittertweet) continue
        rawEntityMap.tweets[tweet.id] = getPrunedTweet(twittertweet)
      }
    }

    return {
      message,
      chatMessages,
      rawChatMessages,
      tweets,
      entityMap,
      rawEntityMap
    }
  }
}
