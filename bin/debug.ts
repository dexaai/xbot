import type * as types from '../src/types.js'
import { getTwitterClient } from '../src/twitter-client.js'
import { findTweetById } from '../src/twitter.js'

async function main() {
  const twitterClient = await getTwitterClient()
  // const { data: user } = await twitterClient.users.findUserByUsername(
  //   'dustyplaylist'
  // )
  // console.log(user)

  const tweetQueryOptions: types.TweetsQueryOptions = {
    expansions: ['author_id', 'in_reply_to_user_id', 'referenced_tweets.id'],
    'tweet.fields': [
      'created_at',
      'public_metrics',
      'conversation_id',
      'in_reply_to_user_id',
      'referenced_tweets',
      'text'
    ],
    'user.fields': ['profile_image_url', 'public_metrics']
  }

  const id = '1628578692707532800'
  const res = await findTweetById(id, { twitterClient }, tweetQueryOptions)
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
