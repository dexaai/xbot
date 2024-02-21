import { Nango } from '@nangohq/node'
import { Client as TwitterClient, auth } from 'twitter-api-sdk'

import * as config from './config.js'
import { assert } from './utils.js'

// The Twitter+Nango client auth connection key
const NANGO_TWITTER_PROVIDER_CONFIG_KEY = 'twitter-v2'

// NOTE: this should be a global to ensure it persists across serverless
// function invocations (if deployed in a serverless setting)
let _nango: Nango | null = null

let _twitterAuth: auth.OAuth2User | null = null

function getNango(): Nango {
  if (!_nango) {
    const secretKey = process.env.NANGO_SECRET_KEY?.trim()
    if (!secretKey) {
      throw new Error(`Missing required process.env.NANGO_SECRET_KEY`)
    }

    _nango = new Nango({ secretKey })
  }

  return _nango
}

async function getTwitterAuth(): Promise<auth.OAuth2User> {
  const nango = getNango()
  const connection = await nango.getConnection(
    NANGO_TWITTER_PROVIDER_CONFIG_KEY,
    config.nangoConnectionId
  )

  // connection.credentials.raw
  // {
  //   token_type: 'bearer',
  //   expires_in: number,
  //   access_token: string
  //   scope: string
  //   expires_at: string
  // }

  if (!_twitterAuth) {
    _twitterAuth = new auth.OAuth2User({
      client_id: config.twitterClientId,
      client_secret: config.twitterClientSecret,
      callback: config.nangoCallbackURL,
      scopes: ['tweet.read', 'users.read', 'offline.access', 'tweet.write'],
      token: connection.credentials.raw.access_token
    })
  } else {
    refreshTwitterAuth()
  }

  return _twitterAuth
}

/** Get an authenticated TWitterClient */
export async function getTwitterClient(): Promise<TwitterClient> {
  const twitterAuth = await getTwitterAuth()

  // Twitter API v2 using OAuth 2.0
  return new TwitterClient(twitterAuth)
}

async function refreshTwitterAuth() {
  assert(_twitterAuth)

  console.log('refreshing twitter access token')
  try {
    const { token } = await _twitterAuth!.refreshAccessToken()
    return token
  } catch (err) {
    console.error('error refreshing twitter access token', err)
    return null
  }
}
