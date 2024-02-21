import { getTwitterClient } from './client.js'

async function main() {
  const twitterClient = await getTwitterClient()
  const user = await twitterClient.users.findMyUser()
  console.log(user)
}

main()
  .then(() => {
    console.log('done')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
