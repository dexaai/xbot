import { getTwitterClient } from './client';

async function main() {
  const twitterClient = await getTwitterClient();
  const readOnlyClient = twitterClient.readOnly;
  const user = await readOnlyClient.v2.userByUsername('dexa_ai');
  console.log(user);
}

main()
  .then(() => {
    console.log('done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
