import { Nango } from '@nangohq/node';
import { TwitterApi } from 'twitter-api-v2';

/** The Twitter+Nango client auth connection key */
const NANGO_TWITTER_PROVIDER_CONFIG_KEY = 'twitter-v2';

/**
 * Conntection ID for the Twitter account that is authed with Nango.
 * Auth new accounts here: https://app.nango.dev/connections
 */
const TEST_ACCOUNT_CONNECTION_ID = 'samrcharles';

let nango: Nango | null = null;

function getNango(): Nango {
  if (!nango) {
    const secretKey = process.env.NANGO_SECRET_KEY;
    if (!secretKey || secretKey.trim() === '') {
      throw new Error(`Missing required process.env.NANGO_SECRET_KEY`);
    }
    nango = new Nango({ secretKey });
  }
  return nango;
}

/** Get an authenticated TwitterApi client */
export async function getTwitterClient(): Promise<TwitterApi> {
  const nango = getNango();
  const connection = await nango.getConnection(
    NANGO_TWITTER_PROVIDER_CONFIG_KEY,
    TEST_ACCOUNT_CONNECTION_ID
  );
  const twitterClient = new TwitterApi(connection.credentials.raw.access_token);
  return twitterClient;
}
