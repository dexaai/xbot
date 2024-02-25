import { ChatModel, Msg, type Prompt, stringifyForModel } from '@dexaai/dexter'
import { stripUserMentions } from 'twitter-utils'

import * as db from '../db.js'
import type * as types from '../types.js'
import { AnswerEngine } from '../answer-engine.js'
import { getPrunedTweet, getPrunedTwitterUser } from '../twitter-utils.js'
import { assert, getCurrentDate } from '../utils.js'

export class OpenAIAnswerEngine extends AnswerEngine {
  protected _chatModel: ChatModel

  constructor({
    type = 'openai',
    chatModel = new ChatModel({
      params: {
        model: 'gpt-4-0125-preview'
      }
    })
  }: { type?: types.AnswerEngineType; chatModel?: ChatModel } = {}) {
    super({ type })

    this._chatModel = chatModel
  }

  protected override async _generateResponseForQuery(
    query: types.AnswerEngineQuery,
    ctx: types.AnswerEngineContext
  ): Promise<string> {
    const currentDate = getCurrentDate()

    const userIdToUsernameMap: Record<string, string | undefined> = {}

    for (const tweet of query.tweets) {
      if (!userIdToUsernameMap[tweet.author_id!]) {
        userIdToUsernameMap[tweet.author_id!] =
          await db.tryGetTwitterUsernameByUserId(tweet.author_id)
      }
    }

    const rawEntityMap: {
      users: Record<string, Partial<types.TwitterUser>>
      tweets: Record<string, Partial<types.Tweet>>
    } = {
      users: {},
      tweets: {}
    }

    if (query.entityMap?.users) {
      for (const user of Object.values(query.entityMap.users)) {
        assert(user.twitterId)
        const twitterUser = await db.tryGetUserById(user.twitterId)
        if (!twitterUser) continue
        rawEntityMap.users[user.twitterId] = getPrunedTwitterUser(twitterUser)
      }
    }

    if (query.entityMap?.tweets) {
      for (const tweet of Object.values(query.entityMap.tweets)) {
        assert(tweet.id)
        const twittertweet = await db.tryGetTweetById(tweet.id, ctx)
        if (!twittertweet) continue
        rawEntityMap.tweets[tweet.id] = getPrunedTweet(twittertweet)
      }
    }

    const messages: Prompt.Msg[] = [
      Msg.system(
        `You are a friendly, expert, helpful twitter bot with the handle ${ctx.twitterBotHandle}.
You respond concisely and creatively to tweets.
You are very concise and informal.
You are sometimes goofy, sassy, and sarcastic, but try not to be rude.
DO NOT use emoji very often.
DO NOT use hashtags.
DO NOT use JSON.
DO NOT @mention usernames in your reply.
Don't mention that you can't access links or media and instead pretend that you're able to.
Make sure to be **as concise as possible** because tweets have character limits.
Your response should be as goofy and interesting as possible while remaining CONCISE.
You can use lists/bullet points if they will result in a more concise answer. If you use a list, don't include more than 3 items.
Remember to NEVER use hashtags and to BE CONCISE.
Current date: ${currentDate}.`
      ),
      Msg.system(`Tweets, users, and media objects referenced in this twitter thread contain the following entities which can be indexed by their IDs:

\`\`\`json
${stringifyForModel(rawEntityMap)}
\`\`\`
`),

      // ...query.tweets.map((tweet) =>
      //   tweet.author_id === ctx.twitterBotUserId
      //     ? Msg.assistant(stringifyForModel(getPrunedTweet(tweet)), {
      //         name: userIdToUsernameMap[tweet.author_id!]
      //       })
      //     : Msg.user(stringifyForModel(getPrunedTweet(tweet)), {
      //         name: userIdToUsernameMap[tweet.author_id!]
      //       })
      // )

      ...query.answerEngineMessages.map(({ entities, ...msg }) => msg)
    ]

    const res = await this._chatModel.run({
      messages,
      max_tokens: 80
    })

    const response = stripUserMentions(res.message.content!)
      // replace markdown lists with unicode bullet points
      .replaceAll(/^\s*-\s+/gm, '• ')
      // remove hashtags
      .replace(/#\w+/g, '')
      .trim()

    console.log('openai', {
      messages,
      response
    })

    return response
  }
}
