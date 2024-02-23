import { ChatModel, Msg } from '@dexaai/dexter'
import { OpenAIClient } from 'openai-fetch'

import type * as types from '../types.js'
import { AnswerEngine } from '../answer-engine.js'
import { getCurrentDate } from '../utils.js'

export class PerplexityAnswerEngine extends AnswerEngine {
  protected readonly _chatModel: ChatModel

  constructor({ chatModel }: { chatModel?: ChatModel } = {}) {
    super({ type: 'perplexity' })

    if (!chatModel) {
      if (!process.env.PERPLEXITY_API_KEY) {
        throw new Error(
          'PerplexityAnswerEngine missing required "PERPLEXITY_API_KEY"'
        )
      }

      chatModel = new ChatModel({
        client: new OpenAIClient({
          apiKey: process.env.PERPLEXITY_API_KEY,
          baseUrl: 'https://api.perplexity.ai'
        }),
        params: {
          model: 'pplx-70b-chat'
        }
      })
    }

    this._chatModel = chatModel
  }

  protected override async _generateMessageResponse(
    query: types.AnswerEngineQuery,
    ctx: types.Context
  ): Promise<string> {
    const currentDate = getCurrentDate()

    const response = await this._chatModel.run({
      messages: [
        Msg.system(
          `You are a friendly, helpful twitter bot with the handle ${ctx.twitterBotHandle}.
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
        ...query.answerEngineMessages.map(({ entities, ...msg }) => msg)
      ],
      max_tokens: 50
      // model: query.answerEngineMessages.length > 1
      //   ? 'pplx-70b-chat'
      //   : 'pplx-70b-online'
    })

    return response.message.content!
  }
}
