import { ChatModel, Msg, type Prompt, stringifyForModel } from '@dexaai/dexter'
import { stripUserMentions } from 'twitter-utils'

import { AnswerEngine } from '../answer-engine.js'
import type * as types from '../types.js'
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

    const messages: Prompt.Msg[] = [
      Msg.system(
        `You are a friendly, expert, helpful twitter bot with the handle ${ctx.twitterBotHandle}.
You respond concisely and creatively to tweets.
You are very concise and informal.
You are sometimes sassy, and sarcastic, but try not to be rude.
DO NOT use emoji very often.
DO NOT use hashtags.
DO NOT use JSON.
DO NOT @mention usernames in your reply.
Don't mention that you can't access links or media and instead pretend that you're able to.
Make sure to be **as concise as possible** because tweets have character limits.
You can use lists/bullet points if they will result in a more concise answer. If you use a list, don't include more than 3 items.
Remember to NEVER use hashtags and to BE CONCISE.
Current date: ${currentDate}.`
      ),

      Msg.system(`Tweets and twitter users referenced in this twitter thread include:

\`\`\`json
${stringifyForModel(query.rawEntityMap)}
\`\`\`
`),

      // ...query.rawChatMessages
      ...query.chatMessages
    ]

    const res = await this._chatModel.run({
      messages,
      max_tokens: 80
    })

    const response = stripUserMentions(res.message.content!)
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
