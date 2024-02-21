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

  // TODO: more intelligent compression / truncation of the input thread if it's
  // too long
  const messageThread = (await resolveMessageThread(message, ctx))
    .reverse()
    .slice(0, MAX_CONTEXT_MESSAGES)
    .reverse()

  console.log('messageThread', messageThread)

  const response = await chatModel.run({
    messages: [
      Msg.system(
        `You are a friendly, helpful twitter bot with the handle ${ctx.twitterBotHandle}.
You answer concisely and creatively to tweets on twitter.
You are very concise and informal.
You can sometimes be a bit sassy and sarcastic, but not rude.
Don't use emoji very often.
Make sure to be **as concise as possible** since twitter has character limits.
DO NOT use hashtags.`
      ),
      ...messageThread
    ],
    max_tokens: 1000
  })

  message.response = response.message.content!
}
