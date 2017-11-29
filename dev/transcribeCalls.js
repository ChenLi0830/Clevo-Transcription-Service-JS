(async () => {
  require('dotenv').config()
  const debug = require('debug')('localScript - transcribeCalls')

  // let promises = []
  // put 10 files into promises
  let CONCURRENCY = 8
  let CHECK_TRANSCRIPTION_INTERVAL = 5

  let fileNames = require('./fileNames')

  let queue = fileNames.map(fileName => `http://processed-wav-dev-uswest.oss-us-west-1.aliyuncs.com/Youyin-test-Nov28/${fileName}`)

  let { generateCreateTranscriptionPromise, generateGetTranscriptionPromise, saveTasksToServer } = require('./helper')

  async function wait (waitSec) {
    return new Promise(resolve => setTimeout(resolve, waitSec * 1000))
  }

  function countFinishedTasks (transcriptionTasks) {
    let count = 0
    transcriptionTasks.forEach(task => {
      task = task.data.transcriptionById
      if (task && (task.status === 'completed' || task.status === 'failed')) {
        if (task.status === 'failed') debug(`task ${task.id} is failed`)
        count++
      }
    })
    debug('countFinishedTasks count', count)
    return count
  }

  async function transcribeCallBatch (createTranscriptionPromises, processingAudioURLs) {
    debug('createTranscriptionPromises', createTranscriptionPromises)
    let createdTranscriptionTasks = await Promise.all(createTranscriptionPromises)
    debug('createdTranscriptionTasks', JSON.stringify(createdTranscriptionTasks))
  //  处理创建失败的

    while (true) {
      debug('waiting for ASR tasks to be finished')
      let getTranscriptionPromises = []
      // get getTranscriptionPromises
      createdTranscriptionTasks.forEach(result => {
        let task = result.data.transcriptionCreate
        debug('task.id', task.id, 'task.status', task.status)
        if (task && task.id) {
          let getTranscriptionPromise = generateGetTranscriptionPromise(task.id)
          getTranscriptionPromises.push(getTranscriptionPromise)
        } else {
          debug('Error when creating TranscriptionTasks - TranscriptionTasks:', task)
        }
      })

      let transcriptionTasks = await Promise.all(getTranscriptionPromises)
      // debug('transcriptionTasks', JSON.stringify(transcriptionTasks))
      debug('getTranscriptionPromises.length', getTranscriptionPromises.length)
      if (countFinishedTasks(transcriptionTasks) === getTranscriptionPromises.length) {
        await saveTasksToServer(transcriptionTasks, processingAudioURLs)
        break
      }
      await wait(CHECK_TRANSCRIPTION_INTERVAL)
    }
  }

  function getCreateTranscriptionPromises (queue) {
    let urls = queue.splice(0, CONCURRENCY)

    let promises = urls.map(audioURL => {
      return generateCreateTranscriptionPromise(audioURL)
    })

    return {createTranscriptionPromises: promises, processingAudios: urls}
  }

  async function transcribeAllCalls (queue) {
    debug('start processing: ', queue)
    while (queue.length !== 0) {
      //   get CONCURRENCY promises to create transcriptions, remove audio urls from the queue
      let {createTranscriptionPromises, processingAudios} = getCreateTranscriptionPromises(queue)
      debug('createTranscriptionPromises', createTranscriptionPromises)
      debug('processingAudios', processingAudios)

      await transcribeCallBatch(createTranscriptionPromises, processingAudios)

      debug('audios have been processed: ', processingAudios)
    }
  //   transcribedCalls
  }

  let startTime = new Date().getTime()
  debug('transcribeAllCalls starts...', startTime)
  await transcribeAllCalls(queue)
  let endTime = new Date().getTime()
  debug('transcribeAllCalls finished', endTime)
  debug(`Processing ${queue.length} files took ${(endTime - startTime) / 1000}`)
})()
