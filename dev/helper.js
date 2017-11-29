const debug = require('debug')('helper')
const { createApolloFetch } = require('apollo-fetch')

async function removeExistFiles (queue) {
  let allURLs = []

  let CONCURRENCY = 100
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
    uri: process.env.YOUYIN_SERVER_ENDPOINT || `http://localhost:3030/graphql`
  })

  const query = `
    query callBySource (
      # $organization: MongoID,
      # $start: Date,
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
    uri: process.env.JS_TRANSCRIBE_SPEECH_ENDPOINT || `http://localhost:3030/graphql`
  })

  const query = `
    mutation transcriptionCreate(
      $fileURL:String!, 
      $provider:ASRProvider!, 
      # $callbackURL: String
      $autoSplit: Boolean
    ){
      transcriptionCreate(
        fileURL: $fileURL, 
        provider: $provider, 
        # callbackURL: $callbackURL,
        autoSplit: $autoSplit
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
      fileURL: audioURL,
      provider: 'aliyun',
      callbackURL: process.env.TRANSCRIBE_CALLBACK_ENDPOINT || 'localhost',
      autoSplit: true
    }
  })
}

function generateGetTranscriptionPromise (id) {
  const fetch = createApolloFetch({
    uri: process.env.JS_TRANSCRIBE_SPEECH_ENDPOINT || `http://localhost:3030/graphql`
  })

  const query = `
    query transcriptionById($transcriptionId: String!, $provider:ASRProvider!){
      transcriptionById(id: $transcriptionId, provider: $provider){
        id
        result
        status
      }
    }
  `

  return fetch({
    query,
    variables: {
      provider: 'aliyun',
      transcriptionId: id
    }
  })
}

async function saveTasksToServer (transcriptionTasks, processingAudioURLs) {
  let promises = transcriptionTasks.map((task, i) => {
    task = task.data.transcriptionById
    let url = processingAudioURLs[i]

    const fetch = createApolloFetch({
      uri: process.env.YOUYIN_SERVER_ENDPOINT || `http://localhost:4000/graphql`
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
        begin: item.begin_time,
        end: item.end_time,
        transcript: item.text,
        speaker: item.channel_id === 0 ? 'customer' : 'staff'
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
      debug('saved results', results)
    })
}

module.exports = {generateCreateTranscriptionPromise, generateGetTranscriptionPromise, saveTasksToServer, removeExistFiles}
