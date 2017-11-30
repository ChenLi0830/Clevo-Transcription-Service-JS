(async () => {
  require('dotenv').config()
  const debug = require('debug')('localScript - transcribeCalls')
  let queue = require('../fileNames')
  let { generateCreateTranscriptionPromise, generateGetTranscriptionPromise, saveTasksToServer, removeExistFiles } = require('./helperAliyun')

  let CONCURRENCY = 10
  let CHECK_TRANSCRIPTION_INTERVAL = 5

  let processedFileCount = 0

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
    // debug('createdTranscriptionTasks', JSON.stringify(createdTranscriptionTasks))
  //  处理创建失败的

    while (true) {
      debug('waiting for ASR tasks to be finished')
      let getTranscriptionPromises = []
      // get getTranscriptionPromises
      createdTranscriptionTasks.forEach(result => {
        let task = result.data.transcriptionCreate
        if (task && task.id) {
          debug('task.id', task.id, 'task.status', task.status)
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
        processedFileCount += getTranscriptionPromises.length
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
  try {
    debug('Removing transcribed audios...')
    queue = await removeExistFiles(queue)
    debug('transcribeAllCalls starts...', startTime)
    await transcribeAllCalls(queue)
  } catch (error) {
    debug('error', error)
  }
  let endTime = new Date().getTime()
  debug('transcribeAllCalls finished at', endTime)
  debug(`Processing ${processedFileCount} files took ${(endTime - startTime) / 1000} seconds`)
})()
