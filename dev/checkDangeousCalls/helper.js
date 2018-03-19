const debug = require('debug')('localScript - checkForWords - helper')
const json2csv = require('json2csv')
const fs = require('fs')

function writeToCSV (data, fields = ['url', 'words'], path = 'riskyCalls.csv') {
  try {
    var result = json2csv({ data, fields })
    // debug(result)

    fs.writeFile(path, result, function (err) {
      if (err) throw err
      debug(`file saved to ${path}`)
    })
  } catch (err) {
    // Errors are thrown for bad options, or if the data is empty and no fields are provided.
    // Be sure to provide fields if it is possible that your data array will be empty.
    console.error(err)
  }
}

function preprocessTranscripts (callTranscripts, transcriptProvider) {
  if (transcriptProvider === 'aliyun') {
    return callTranscripts.map(transcript => {
      let transcriptText = transcript.breakdowns.map(breakdown => {
        return breakdown.transcript
      }).join('|')

      // debug('transcriptText', transcriptText)
      return {
        url: transcript.source,
        transcript: transcriptText
      }
    })
  } else return callTranscripts
}

function getAppearedKeywords (transcript, words) {
  let result = {}
  words.forEach(word => {
    let re = new RegExp(word, 'g')
    let count = (transcript.match(re) || []).length
    if (count > 0) result[word] = count
  })
  console.log('getAppearedKeywords result', result)
  return result
}

module.exports = { preprocessTranscripts, getAppearedKeywords, writeToCSV }
