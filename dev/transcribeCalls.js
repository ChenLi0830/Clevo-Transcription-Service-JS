(async () => {
  require('dotenv').config()
  const debug = require('debug')('localScript - transcribeCalls')
  // let promises = []
  // put 10 files into promises
  let CONCURRENCY = 8
  let CHECK_TRANSCRIPTION_INTERVAL = 20

  let fileNames = [
    '4000000928_13099934990_13263227560_234300355662_20171101112442.wav.mp3',
    '4000001542_13621121850_15910888331_234300344732_20171101085839.wav.mp3',
    '4000001786_15335160619_02154336693_236350300822_20171101112250.wav.mp3',
    '4000001958_13928686312_075718024187402_234300344744_20171101085849.wav.mp3',
    '4000002772_13890920380_02883387146_457420579653_20171101110329.wav.mp3',
    '4000003335_15827312160_02866779476_533240311577_20171101011826.wav.mp3',
    '4000005989_13431900608_085134893359_234300358448_20171101121538.wav.mp3',
    '4000006808_13403692279_13593114829_843780682467_20171101112142.wav.mp3',
    '4000006808_13800138000_18801113000_843780675084_20171101082739.wav.mp3',
    '4000006808_18636122877_18801113000_843780675084_20171101082739.wav.mp3',
    '4000007075_03153253874_15331940960_236350291623_20171101092606.wav.mp3',
    '4000007117_13023252675_15000333716_234300356223_20171101113407.wav.mp3',
    '4000007117_13124871911_15000333717_234300344849_20171101090050.wav.mp3',
    '4000007117_18621886553_15000333717_457420581608_20171101113719.wav.mp3',
    '4000007130_15346135258_13693372723_457420577271_20171101102408.wav.mp3',
    '4000007878_15112600823_02022098360_494010601862_20171101081429.wav.mp3',
    '4000007936_13681629738_15021366726_234300347902_20171101094112.wav.mp3',
    '4000008178_13834838568_17681783674_234300352241_20171101103603.wav.mp3',
    '4000008658_18225226772_02367346666_457420578932_20171101104959.wav.mp3',
    '4000008685_13168051961_01083035277_234300349771_20171101100539.wav.mp3',
    '4000008685_13315182920_01083035277_234300356349_20171101113611.wav.mp3',
    '4000008685_13505040646_01083035277_457420578892_20171101104925.wav.mp3',
    '4000008685_13551063727_01083035277_234300360690_20171101130721.wav.mp3',
    '4000008685_13588589972_01083035277_234300352312_20171101103657.wav.mp3',
    '4000008685_13810695426_01083035277_457420577190_20171101102309.wav.mp3',
    '4000008685_13815106664_01083035277_457420576121_20171101100634.wav.mp3',
    '4000008685_13828629297_01083035277_234300345736_20171101091256.wav.mp3',
    '4000008685_13830819461_01083035277_457420572704_20171101090346.wav.mp3',
    '4000008685_13836242202_01083035277_457420574271_20171101093358.wav.mp3',
    '4000008685_13958717919_01083035277_457420574339_20171101093517.wav.mp3',
    '4000008685_13984897796_01083035277_457420574057_20171101092939.wav.mp3',
    '4000008685_15048005469_01083035277_234300355616_20171101112357.wav.mp3',
    '4000008685_15121193855_01083035277_234300359261_20171101123352.wav.mp3',
    '4000008685_15238748601_01083035277_234300345331_20171101090727.wav.mp3',
    '4000008685_15279280222_01083035277_234300346628_20171101092500.wav.mp3',
    '4000008685_15601721077_01083035277_457420578841_20171101104836.wav.mp3',
    '4000008685_15873195033_01083035277_457420577425_20171101102627.wav.mp3',
    '4000008685_15874306839_01083035277_234300346878_20171101092819.wav.mp3',
    '4000008685_15960286168_01083035277_234300346536_20171101092341.wav.mp3',
    '4000008685_15985731102_01083035277_457420582458_20171101115431.wav.mp3',
  ]

  let queue = fileNames.map(fileName => `http://processed-wav-dev-uswest.oss-us-west-1.aliyuncs.com/Nov28-5/${fileName}`)

  let { generateCreateTranscriptionPromise, generateGetTranscriptionPromise } = require('./helper')

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

  async function transcribeCallBatch (createTranscriptionPromises) {
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
        debug('task', JSON.stringify(task))
        if (task && task.id) {
          let getTranscriptionPromise = generateGetTranscriptionPromise(task.id)
          getTranscriptionPromises.push(getTranscriptionPromise)
        } else {
          debug('Error when creating TranscriptionTasks - TranscriptionTasks:', task)
        }
      })

      let transcriptionTasks = await Promise.all(getTranscriptionPromises)
      debug('transcriptionTasks', JSON.stringify(transcriptionTasks))
      debug('getTranscriptionPromises.length', getTranscriptionPromises.length)
      if (countFinishedTasks(transcriptionTasks) === getTranscriptionPromises.length) {
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

      await transcribeCallBatch(createTranscriptionPromises)

      debug('audios have been processed: ', processingAudios)
    }
  //   transcribedCalls
  }

  debug('transcribeAllCalls starts...', new Date().toUTCString())
  await transcribeAllCalls(queue)
  debug('transcribeAllCalls finished', new Date().toUTCString())
})()
