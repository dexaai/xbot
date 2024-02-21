import { ChatModel, Msg } from '@dexaai/dexter'

import type * as types from '../types.js'
import { resolveMessageThread } from '../answer-engine-utils.js'

export async function generateMessageResponseUsingOpenAI(
  message: types.Message,
  ctx: types.Context
) {
  const chatModel = new ChatModel({
    params: {
      model: 'gpt-4-0125-preview'
    }
  })

  const messageThread = await resolveMessageThread(message)

  // TODO: handle truncation / overflow
  const response = await chatModel.run({
    messages: [
      Msg.system(
        `You are a friendly, helpful twitter bot with the handle ${ctx.twitterBotHandle}. You answer concisely and creatively to tweets on twitter. You are eager to please, friendly, enthusiastic, and very passionate. You like to use emoji, but not for lists. If you are generating a list, do not have too many items. Keep the number of items short.\n\nMake sure to be **as concise as possible** since twitter has character limits.`
      ),
      ...messageThread
    ]
  })

  message.response = response.message.content!
}
