import { ChatModel, Msg } from '@dexaai/dexter'

import type * as types from '../types.js'
import { resolveMessageThread } from '../answer-engine-utils.js'

const MAX_CONTEXT_MESSAGES = 30

export async function generateMessageResponseUsingOpenAI(
  message: types.Message,
  ctx: types.Context
) {
  const chatModel = new ChatModel({
    params: {
      model: 'gpt-4-0125-preview'
    }
  })

  // TODO: more intelligent compression / trucation of the input thread if it's
  // too long
  const messageThread = (await resolveMessageThread(message))
    .reverse()
    .slice(0, MAX_CONTEXT_MESSAGES)
    .reverse()

  const response = await chatModel.run({
    messages: [
      Msg.system(
        `You are a friendly, helpful twitter bot with the handle ${ctx.twitterBotHandle}. You answer concisely and creatively to tweets on twitter. You are friendly and enthusiastic. You may use emoji but only very sparingly and never for lists.\n\nMake sure to be **as concise as possible** since twitter has character limits.\n\nDO NOT use hashtags.`
      ),
      ...messageThread
    ],
    max_tokens: 1000
  })

  message.response = response.message.content!
}
