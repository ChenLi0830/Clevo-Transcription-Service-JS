const debug = require('debug')('helper')
const { createApolloFetch } = require('apollo-fetch')

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

async function saveTasksToServer (transcriptionTasks, processingAudioURLs) {
  let promises = transcriptionTasks.map((task, i) => {
    task = task.data.transcriptionById || task.data.transcriptionCreate

    if (!task.result) {
      // error
      debug('transcriptionTasks is not processed successfully', task)
      return Promise.resolve()
    }

    let url = processingAudioURLs[i]

    const fetch = createApolloFetch({
      uri: process.env.YOUYIN_SERVER_XF_ENDPOINT || `http://localhost:4000/graphql`
    })

    const query = `
    mutation callCreate (
      $status: EnumCallStatus,
      $transcription: CallTranscriptionInput,
      $breakdowns: [CallCallBreakdownsInput]
      $source: String
    ) { 
      callCreate (record: {
        status: $status,
        transcription: $transcription,
        breakdowns: $breakdowns
        source: $source
      }) {
        recordId
        record {
          _id,
          status,
          format,
          encoding,
          source,
          transcription {
              processor,
              taskId,
              status,
              result
          }
          breakdowns {
              begin
              end
              transcript
              speaker
          }
          createdAt
          updatedAt
        }
      }
    }
    `

    // debug('typeof task.result ', typeof task.result)
    // task.result = JSON.parse(task.result)
    // if (task.result)
    // debug(task.result)

    let breakdowns = JSON.parse(task.result).map(item => {
      return {
        begin: item.bg,
        end: item.ed,
        transcript: item.onebest,
        speaker: item.speaker === 1 || item.speaker === '1' ? 'customer' : 'staff'
      }
    })

    // debug('task.result', task.result)
    // debug('breakdowns', breakdowns)
    // debug('JSON.parse(result.result)', JSON.parse(result.result))
    // debug('JSON.stringify(result.result)', JSON.stringify(result.result))
    return fetch({
      query,
      variables: {
        status: 'active',
        source: url,
        transcription: {
          'processor': 'iflytek',
          'taskId': task.id,
          'status': 'completed',
          'result': task.result
        },
        'breakdowns': breakdowns
      }
    })
  })

  return Promise.all(promises)
    .then(results => {
      // debug('saved results', results)
    })
}

module.exports = {generateCreateTranscriptionPromise, generateGetTranscriptionPromise, saveTasksToServer, removeExistFiles, promiseAllWithTimeout}
