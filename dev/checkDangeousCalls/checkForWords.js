(async () => {
  require('dotenv').config()
  const debug = require('debug')('localScript - checkForWords')
  const { createApolloFetch } = require('apollo-fetch')

  const { preprocessTranscripts, getAppearedKeywords, writeToCSV } = require('./helper')
  const BATCH_SIZE = 50

  async function filterCallsByWords (callTranscripts, words, transcriptProvider) {
    let transcriptObjs = preprocessTranscripts(callTranscripts, transcriptProvider)
    // debug('transcriptObjs', transcriptObjs)
    let dangerousCalls = []

    for (let {url, transcript} of transcriptObjs) {
      let keywords = getAppearedKeywords(transcript, words)
      if (keywords.length > 0) {
        let dangerousCall = {
          url,
          keywords,
          transcript
        }
        debug(`found dangerous call`, dangerousCall)
        dangerousCalls.push(dangerousCall)
      }
    }

    return dangerousCalls
  }

  async function getCallsByBatch (currentIndex, BATCH_SIZE) {
    const fetch = createApolloFetch({
      uri: process.env.YOUYIN_SERVER_ENDPOINT || `http://localhost:3030/graphql`
    })
    const query = `
      query getCalls($callLimit: Int, $callSkip: Int) {
          calls(limit: $callLimit, skip: $callSkip){
          source
          breakdowns {
              begin
              end
              transcript
              intent
              speaker
              _id
          }
          }
      }
    `
    return fetch({
      query,
      variables: {
        callLimit: BATCH_SIZE,
        callSkip: currentIndex
      }
    })
      .then(result => {
        return result.data.calls
      })
  }

  async function checkAllCalls (transcriptProvider, words) {
    let currentIndex = 0
    let dangerousCalls = []

    let batchCalls = []
    do {
      batchCalls = await getCallsByBatch(currentIndex, BATCH_SIZE)
      // debug('getCallsByBatch batchCalls', batchCalls)
      currentIndex += batchCalls.length

      let dangerousCallsInBatch = await filterCallsByWords(batchCalls, words, transcriptProvider)
      dangerousCalls = dangerousCalls.concat(dangerousCallsInBatch)

      // break
    } while (batchCalls.length > 0)

    return dangerousCalls
  }

  let sensitiveWords = require('./sentitiveWords')
  debug('checking for sensitiveWords', sensitiveWords)
  let dangerousCalls = await checkAllCalls('aliyun', sensitiveWords)

  const path = require('path')
  dangerousCalls.map(call => {
    return Object.assign(call, {filename: path.basename(call.url)})
  })
  debug('dangerousCalls', dangerousCalls)

  writeToCSV(dangerousCalls, ['filename', 'keywords', 'transcript'], 'riskyCalls.csv')
})()
