const debug = require('debug')('helper')
const { createApolloFetch } = require('apollo-fetch')
const path = require('path')
const stringSimilarity = require('string-similarity')
var fs = require('fs')

async function promiseAllWithTimeout (promises, timeout, resolvePartial = true) {
  return new Promise(function (resolve, reject) {
    let results = []
    let finished = 0
    let numPromises = promises.length
    let onFinish = function () {
      if (finished < numPromises) {
        if (resolvePartial) {
          (resolve)(results)
        } else {
          throw new Error('Not all promises completed within the specified time')
        }
      } else {
        (resolve)(results)
      }
      onFinish = null
    }
    for (let i = 0; i < numPromises; i += 1) {
      results[i] = undefined
      promises[i].then(
              function (res) {
                results[i] = res
                finished += 1
                if (finished === numPromises && onFinish) {
                  onFinish()
                }
              },
              reject
          )
    }
    setTimeout(function () {
      if (onFinish) {
        onFinish()
      }
    }, timeout)
  })
}

async function removeExistFiles (queue) {
  let allURLs = []

  let CONCURRENCY = 50
  // 并发
  while (queue.length > 0) {
    let promises = []
    let urlBatch = []
    while (queue.length > 0 && promises.length < CONCURRENCY) {
      let url = queue.pop()
      urlBatch.push(url)
      promises.push(getCallBySourceURL(url))
    }

    let results = await Promise.all(promises)
    debug(`checking ${urlBatch.length} urls`)
    results.forEach((result, i) => {
      // debug('result', result)
      let recordAlreadyExist = !!result
      if (recordAlreadyExist) {
        debug(`file ${urlBatch[i]} already exist`)
      } else {
        // debug(`file ${urlBatch[i]} doesn't exist`)
        allURLs.push(urlBatch[i])
      }
    })
  }

  return allURLs

  // // 串行
  // // Add audio urls which doesn't already exist in db
  // while (queue.length > 0) {
  //   let url = queue.pop()
  //   debug(`checking ${url}`)
  //   let recordAlreadyExist = !!await getCallBySourceURL(url)
  //   if (recordAlreadyExist) {
  //     debug(`file ${url} already exist`)
  //   } else {
  //     urls.push(url)
  //   }
  // }
  // return urls
}

async function getCallBySourceURL (url) {
  const fetch = createApolloFetch({
    uri: process.env.YOUYIN_SERVER_XF_ENDPOINT || `http://localhost:3030/graphql`
  })

  const query = `
    query callBySource (
      $sourceURL: String!
    ) {  callBySource(
      source: $sourceURL
    ) {
      status
      source
      transcription {
        processor
        taskId
        status
      }
    }}
  `
  return fetch({
    query,
    variables: {
      sourceURL: url
    }
  })
    .then(result => {
      return result.data.callBySource
    })
}

function generateCreateTranscriptionPromise (audioURL) {
  const fetch = createApolloFetch({
    uri: process.env.JAVA_TRANSCRIBE_SPEECH_ENDPOINT || `http://localhost:3030/graphql`
  })

  // debug('audioURL', audioURL)

  const query = `
    mutation transcriptionCreate(
      $fileURL:String!, 
    ){
      transcriptionCreate(
        file: $fileURL, 
      ){
        id
        status
        result
      }
    }
  `

  return fetch({
    query,
    variables: {
      fileURL: audioURL
      // provider: 'xunfei',
      // callbackURL: process.env.TRANSCRIBE_CALLBACK_ENDPOINT || 'localhost',
      // autoSplit: true
    }
  })
}

function generateGetTranscriptionPromise (id) {
  const fetch = createApolloFetch({
    uri: process.env.JAVA_TRANSCRIBE_SPEECH_ENDPOINT || `http://localhost:3030/graphql`
  })

  const query = `
    query transcriptionById($transcriptionId: String!){
      transcriptionById(id: $transcriptionId){
        id
        result
        status
      }
    }
  `

  return fetch({
    query,
    variables: {
      // provider: 'xunfei',
      transcriptionId: id
    }
  })
}

async function compareWithDBResult (transcriptionTasks, processingAudioURLs) {
  let promises = transcriptionTasks.map((task, i) => {
    if (!task) {
      // error
      debug('transcriptionTask failed', task, processingAudioURLs[i])
      return Promise.resolve()
    }
    task = task.data.transcriptionById || task.data.transcriptionCreate
    if (!task.result) {
      // error
      debug('transcriptionTask failed', task, processingAudioURLs[i])
      return Promise.resolve()
    }

    let url = processingAudioURLs[i]

    let fileName = path.basename(url)
    let serverSourceURL = `http://processed-wav-dev-uswest.oss-us-west-1.aliyuncs.com/Youyin-test-Nov28/${fileName}`

    const fetch = createApolloFetch({
      uri: process.env.YOUYIN_SERVER_XF_ENDPOINT || `http://localhost:4000/graphql`
    })

    const query = `
      query callBySource (
        $sourceURL: String!
      ) {  callBySource(
        source: $sourceURL
      ) {
        status
        breakdowns{
          transcript
        }
      }}    
    `

    return fetch({
      query,
      variables: {
        sourceURL: serverSourceURL
      }
    })
    .then(result => { // compare xfTranscript with queried transcript
      if (typeof task.result === 'string') task.result = JSON.parse(task.result)
      let xfTranscript = task.result.map(sentence => sentence.onebest).join('|')
      debug('xfTranscript', xfTranscript)

      let queryTranscript = null
      if (result.data && result.data.callBySource && result.data.callBySource.breakdowns) {
        queryTranscript = result.data.callBySource.breakdowns.map(breakdown => breakdown.transcript).join('|')
      }
      debug('queryTranscript', queryTranscript.substr(0, xfTranscript.length))

      let similarity = stringSimilarity.compareTwoStrings(queryTranscript.substr(0, xfTranscript.length), xfTranscript)
      debug('similarity', similarity)

      if (similarity < 0.5) {
        fs.appendFile('unmatchedAudio.txt', `${url}@${similarity}\n`, function (err) {
          if (err) throw err
        })
      }

      return similarity < 0.5 ? url : null
    })
  })

  return Promise.all(promises)
    .then(results => {
      // debug('saved results', results)
    })
}

module.exports = {generateCreateTranscriptionPromise, generateGetTranscriptionPromise, compareWithDBResult, removeExistFiles, promiseAllWithTimeout}
