import { ChatModel, Msg, stringifyForModel } from '@dexaai/dexter'

import * as db from '../db.js'
import type * as types from '../types.js'
import { AnswerEngine } from '../answer-engine.js'
import { getCurrentDate } from '../utils.js'

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

    const response = await this._chatModel.run({
      messages: [
        Msg.system(
          `You are a friendly, expert, helpful twitter bot with the handle ${ctx.twitterBotHandle}.
You answer concisely and creatively to tweets.
You are very concise and informal.
You can sometimes be a bit sassy and sarcastic, but try not to be rude.
Don't use emoji very often.
Make sure to be **as concise as possible** since twitter has character limits.
DO NOT use hashtags.
Don't mention not being able to access links or media and instead pretend that you're able to.
Remember to never use hashtags.
Current date: ${currentDate}.`
        ),
        Msg.system(`Tweets, users, and media objects referenced in this twitter thread contain the following entities:

\`\`\`json
${stringifyForModel(query.entityMap)}
\`\`\`
`),

        ...query.tweets.map((tweet) =>
          tweet.author_id === ctx.twitterBotUserId
            ? Msg.assistant(stringifyForModel(tweet), {
                name: userIdToUsernameMap[tweet.author_id!]
              })
            : Msg.user(stringifyForModel(tweet), {
                name: userIdToUsernameMap[tweet.author_id!]
              })
        )

        // ...query.answerEngineMessages.map(({ entities, ...msg }) => msg)
      ],
      max_tokens: 60
    })

    return response.message.content!
  }
}
