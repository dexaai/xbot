import './config.js'

import { getTweetUrl } from 'twitter-utils'
import { assert, describe, test } from 'vitest'

import { DexaAnswerEngine } from './answer-engines/dexa-answer-engine.js'
import { OpenAIAnswerEngine } from './answer-engines/openai-answer-engine.js'
import fixturesData from './fixtures.json'
import { getTwitterClient } from './services/twitter-client.js'
import type * as types from './types.js'
import { rUrl } from './utils.js'

const fixtures = fixturesData as unknown as types.AnswerEngineQuery[]
const answerEngines = [new OpenAIAnswerEngine(), new DexaAnswerEngine()]
// const answerEngines = [new OpenAIAnswerEngine()]

for (const answerEngine of answerEngines) {
  describe(`${answerEngine.type} answer engine`, async () => {
    const ctx: types.AnswerEngineContext = {
      twitterClient: await getTwitterClient(),
      twitterBotHandle: '@AskDexa',
      twitterBotUserId: '1757989045383106560',
      answerEngine
    }

    for (const fixture of fixtures) {
      const tweetUrl = getTweetUrl({
        id: fixture.message.promptTweetId,
        username: fixture.message.promptUsername
      })

      test(
        `tweet ${tweetUrl}`,
        {
          timeout: 60000,
          concurrent: false
        },
        async () => {
          const response = await answerEngine.generateResponseForQuery(
            fixture,
            ctx
          )

          console.log(
            `\n**QUESTION** ${tweetUrl}\n\n**ANSWER**\n\n${response}\n\n`
          )

          assert(response.length > 0, 'response should not be empty')
          assert(response.trim() === response, 'response should be trimmed')

          if (answerEngine.type === 'dexa') {
            const url = response.match(rUrl)
            assert(url, 'dexa responses should contain at least one url')
          }
        }
      )
    }
  })
}
