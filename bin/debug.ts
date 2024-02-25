// import { OpenAIClient } from 'openai-fetch'
import * as db from '../src/db.js'
import { getTwitterClient } from '../src/services/twitter-client.js'

// import { findTweetById } from '../src/twitter.js'

/**
 * This is just a scratchpad / playground for running quick tests.
 */
async function main() {
  const twitterClient = await getTwitterClient()

  // const namespace = db.getTweetMentionDbNamespaceForUserId(
  //   '1757989045383106560' // AskDexa
  // )
  // const keys = await db.redis.keys(`${namespace}:*`)
  // console.log(keys)
  // return

  // if (keys.length) {
  //   await redis.del(keys)
  // }

  // const perplexity = new OpenAIClient({
  //   apiKey: process.env.PERPLEXITY_API_KEY,
  //   baseUrl: 'https://api.perplexity.ai'
  // })

  // const res = await perplexity.createChatCompletion({
  //   model: 'pplx-7b-online',
  //   messages: [
  //     {
  //       role: 'user',
  //       content: 'Who won the super bowl this year?'
  //     }
  //   ]
  // })
  // console.log(JSON.stringify(res, null, 2))

  // const { data: user } = await twitterClient.users.findUserByUsername(
  //   'dustyplaylist'
  // )
  // console.log(user)

  // const lofiGrindTwitterUserId = '1235525929335689217'
  // await db.clearAllDataForUserId(lofiGrindTwitterUserId)

  const id = '1628578692707532800'
  const res = await db.tryGetTweetById(id, { twitterClient })
  console.log(JSON.stringify(res, null, 2))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
