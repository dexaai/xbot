import { Msg, type Prompt } from '@dexaai/dexter'

import * as db from './db.js'
import type * as types from './types.js'

/**
 * Resolves all of the bot messages in a single twitter thread, starting from
 * a leaf tweet, and traversing it's parents – including any previous bot
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

  messages.reverse()
  messages = messages.filter((m) => !m.error)

  return messages.flatMap((message) =>
    [
      Msg.user(message.prompt),
      message.response ? Msg.assistant(message.response!) : null
    ].filter(Boolean)
  )
}
