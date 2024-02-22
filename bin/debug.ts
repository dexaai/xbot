import { tryGetTweetById } from '../src/db.js'
import { getTwitterClient } from '../src/twitter-client.js'

// import { findTweetById } from '../src/twitter.js'

/**
 * This is just a scratchpad / playground for running quick tests.
 */
async function main() {
  const twitterClient = await getTwitterClient()
  // const { data: user } = await twitterClient.users.findUserByUsername(
  //   'dustyplaylist'
  // )
  // console.log(user)

  const id = '1628578692707532800'
  const res = await tryGetTweetById(id, { twitterClient })
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
