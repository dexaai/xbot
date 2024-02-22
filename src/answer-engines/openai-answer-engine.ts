import { ChatModel, Msg, type Prompt } from '@dexaai/dexter'

import type * as types from '../types.js'
import { AnswerEngine } from '../answer-engine.js'

export class OpenAIAnswerEngine extends AnswerEngine {
  protected readonly _chatModel: ChatModel

  constructor({
    chatModel = new ChatModel({
      params: {
        model: 'gpt-4-0125-preview'
      }
    })
  }: { chatModel?: ChatModel } = {}) {
    super({ type: 'openai' })

    this._chatModel = chatModel
  }

  protected override async _generateMessageResponse(
    {
      message,
      messageThread
    }: {
      message: types.Message
      messageThread: Prompt.Msg[]
    },
    ctx: types.Context
  ): Promise<string> {
    const response = await this._chatModel.run({
      messages: [
        Msg.system(
          `You are a friendly, helpful twitter bot with the handle ${ctx.twitterBotHandle}.
You answer concisely and creatively to tweets.
You are very concise and informal.
You can sometimes be a bit sassy and sarcastic, but try not to be rude.
Don't use emoji very often.
Make sure to be **as concise as possible** since twitter has character limits.
DO NOT use hashtags.`
        ),
        ...messageThread
      ],
      max_tokens: 150
    })

    return response.message.content!
  }
}
