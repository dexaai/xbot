import defaultKy, { type KyInstance } from 'ky'

export type ScrapeResult = {
  author: string
  byline: string
  /** The HTML for the main content of the page. */
  content: string
  description: string
  imageUrl: string
  lang: string
  length: number
  logoUrl: string
  /** The text for the main content of the page in markdown format. */
  markdownContent: string
  publishedTime: string
  /** The raw HTML response from the server. */
  rawHtml: string
  siteName: string
  /** The text for the main content of the page. */
  textContent: string
  title: string
}

export class ScraperClient {
  readonly apiBaseUrl: string
  readonly ky: KyInstance

  constructor({
    apiBaseUrl = process.env.SCRAPER_API_BASE_URL,
    ky = defaultKy
  }: {
    apiKey?: string
    apiBaseUrl?: string
    ky?: KyInstance
  } = {}) {
    if (!apiBaseUrl) {
      throw new Error('SCRAPER_API_BASE_URL is required')
    }

    this.apiBaseUrl = apiBaseUrl
    this.ky = ky.extend({ prefixUrl: this.apiBaseUrl })
  }

  async scrapeUrl(
    url: string,
    {
      timeout = 60000
    }: {
      timeout?: number
    } = {}
  ): Promise<ScrapeResult> {
    return this.ky
      .post('scrape', {
        json: { url },
        timeout
      })
      .json()
  }
}
