import { Msg, type Prompt } from '@dexaai/dexter'

import * as db from './db.js'
import type * as types from './types.js'

/**
 * Resolves all of the bot-related messages from a twitter thread, starting
 * from a leaf tweet, and traversing its parents – including any previous bot
 * mentions and responses. Returns the thread in an format compatible with the
 * OpenAI chat-completions API.
 */
export async function resolveMessageThread(
  message: types.Message
): Promise<Prompt.Msg[]> {
  let messages: types.Message[] = []

  do {
    messages.push(message)

    if (message.parentMessageId) {
      const parentMessage = await db.messages.get(message.parentMessageId)
      if (parentMessage) {
        message = parentMessage
        continue
      }
    }
  } while (false)

  // Reverse the messages so the oldest ones are first
  messages.reverse()

  // Filter any messages which have errors, unless it's the latest message we're
  // currently trying to resolve (which may have previously encountered an error
  // that we're now trying to resolve)
  messages = messages.filter((m) => !m.error || m === message)

  return messages.flatMap((message) =>
    [
      Msg.user(message.prompt),
      message.response ? Msg.assistant(message.response!) : null
    ].filter(Boolean)
  )
}
