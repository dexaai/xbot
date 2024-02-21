import { Nango } from '@nangohq/node'
import { Client as TwitterClient, auth } from 'twitter-api-sdk'

import * as config from './config.js'
import { assert } from './utils.js'

// The Twitter+Nango client auth connection key
const nangoTwitterProviderConfigKey = 'twitter-v2'

const defaultRequiredTwitterOAuthScopes = new Set<string>([
  'tweet.read',
  'users.read',
  'offline.access',
  'tweet.write'
])

// NOTE: these should be global to ensure that they persists across serverless
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

async function getTwitterAuth({
  scopes = defaultRequiredTwitterOAuthScopes
}: { scopes?: Set<string> } = {}): Promise<auth.OAuth2User> {
  const nango = getNango()
  const connection = await nango.getConnection(
    nangoTwitterProviderConfigKey,
    config.nangoConnectionId
  )

  console.log(connection)
  // connection.credentials.raw
  // {
  //   token_type: 'bearer',
  //   expires_in: number,
  //   access_token: string
  //   scope: string
  //   expires_at: string
  // }
  const connectionScopes = new Set<string>(
    connection.credentials.raw.scope.split(' ')
  )
  const missingScopes = new Set<string>()

  for (const scope of scopes) {
    if (!connectionScopes.has(scope)) {
      missingScopes.add(scope)
    }
  }

  if (missingScopes.size > 0) {
    throw new Error(
      `Nango connection ${
        config.nangoConnectionId
      } is missing required OAuth scopes: ${[...missingScopes.values()].join(
        ', '
      )}`
    )
  }

  if (!_twitterAuth) {
    _twitterAuth = new auth.OAuth2User({
      client_id: config.twitterClientId,
      client_secret: config.twitterClientSecret,
      callback: config.nangoCallbackUrl,
      scopes: [...scopes.values()] as any,
      token: connection.credentials.raw.access_token
    })
  }

  await refreshTwitterAuth()
  return _twitterAuth
}

export async function getTwitterClient(): Promise<TwitterClient> {
  const twitterAuth = await getTwitterAuth()

  // Twitter API v2 using OAuth 2.0
  return new TwitterClient(twitterAuth)
}

export async function refreshTwitterAuth() {
  assert(_twitterAuth)

  const { token } = await _twitterAuth!.refreshAccessToken()
  console.log('refreshed token', token)
  return token
}
