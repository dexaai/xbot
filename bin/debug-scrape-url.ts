import '../src/config.js'
import { ScraperClient } from '../src/services/scraper-client.js'
import { omit } from '../src/utils.js'

/**
 * Scratchpad / playground for testing the ScraperClient.
 */
async function main() {
  const scraperClient = new ScraperClient()

  const res = await scraperClient.scrapeUrl(
    'https://www.nytimes.com/2023/05/31/magazine/ai-start-up-accelerator-san-francisco.html'
  )
  console.log(JSON.stringify(omit(res, 'content', 'rawHtml'), null, 2))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
