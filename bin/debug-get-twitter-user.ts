import { getTwitterClient } from '../src/twitter-client.js'

async function main() {
  const twitterClient = await getTwitterClient()
  const { data: user } = await twitterClient.users.findUserByUsername(
    'dustyplaylist'
  )
  console.log(user)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
