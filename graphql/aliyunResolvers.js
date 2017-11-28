let fetch = require('isomorphic-fetch')
require('dotenv').config()
const debug = require('debug')('aliyun-resolvers')
const crypto = require('crypto')
const date = new Date().toUTCString()

// 这里填写AK和请求
const AccessKeyId = process.env.ACCESS_KEY_ID
const AccessKeySecret = process.env.ACCESS_KEY_SECRET

function _addAuthSignitureToOption (options) {
  // 这里填写AK和请求
  const md5 = function (buffer) {
    let hash
    hash = crypto.createHash('md5')
    hash.update(buffer)
    return hash.digest('base64')
  }
  const sha1 = function (stringToSign, secret) {
    let signature = crypto.createHmac('sha1', secret).update(stringToSign).digest().toString('base64')
    return signature
  }

  // step1: 组stringToSign [StringToSign = #{method}\\n#{accept}\\n#{data}\\n#{contentType}\\n#{date}\\n#{action}]
  let body = options.body || ''
  let bodymd5
  if (body === void 0 || body === '') {
    bodymd5 = body
  } else {
    bodymd5 = md5(new Buffer(body))
  }
  // debug('bodymd5', bodymd5)
  // let stringToSign = options.method + '\n' + options.headers.accept + '\n' + bodymd5 + '\n' + options.headers['content-type'] + '\n' + options.headers.date + '\n' + url.parse(options.url).path
  let stringToSign = options.method + '\n' + options.headers.accept + '\n' + bodymd5 + '\n' + options.headers['content-type'] + '\n' + options.headers.date
  debug('step1-Sign string:', stringToSign)

  // step2: 加密 [Signature = Base64( HMAC-SHA1( AccessSecret, UTF-8-Encoding-Of(StringToSign) ) )]
  let signature = sha1(stringToSign, AccessKeySecret)
  // debug("step2-signature:", signature)

  // step3: 组authorization header [Authorization =  Dataplus AccessKeyId + ":" + Signature]
  let authHeader = 'Dataplus ' + AccessKeyId + ':' + signature
  console.log('step3-authorization Header:', authHeader)
  options.headers.Authorization = authHeader
  console.log('authHeader', authHeader)

  return options
}

async function transcriptionCreate (args) {
  // provider, fileURL, options
  debug('transcriptionCreate args', args)
  let options = {
    url: 'https://nlsapi.aliyun.com/transcriptions',
    method: 'POST',
    body: JSON.stringify({
      'app_key': 'nls-service-telephone8khz',
      'oss_link': args.fileURL,
      'auto_split': args.autoSplit,
      'callback_url': args.callbackURL,
      'enable_callback': !!args.callbackURL,
      'vocabulary_id': args.vocabularyId,
      'customization_id': args.customizationId
    }),
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'date': date,
      'Authorization': ''
    }
  }
  options = _addAuthSignitureToOption(options)

  // debug('options', options)

  try {
    let response = await fetch('https://nlsapi.aliyun.com/transcriptions', options)
    if (response.status >= 400) {
      debug('error result', await response.json())
      throw new Error('Bad response from server')
    }
    let createdTranscription = await response.json()
    debug('createdTranscription', createdTranscription)

    if (args.callbackURL) {
      debug(`Transcription result of ${JSON.stringify(createdTranscription)} will be sent to ${args.callbackURL}`)
      return createdTranscription
    } else {
      debug('start fetching')
      // fetching transcription with interval
      while (true) {
        // fetch transcription
        const { id } = createdTranscription
        let fetchedTranscription = await transcriptionById({ id, provider: 'aliyun' })

        if (fetchedTranscription.status === 'completed') {
          return fetchedTranscription
        } else if (fetchedTranscription.status === 'failed') {
          debug('fetchedTranscription', fetchedTranscription)
          throw new Error('fetchedTranscription failed')
        } else {
          let waitSec = 30
          debug(`wait for ${waitSec} seconds...`)
          await new Promise((resolve, reject) => {
            setTimeout(() => resolve(), waitSec * 1000)
          })
        }
      }
    }
  } catch (err) {
    console.error(err)
  }
}

function formatTranscriptionToGraphqlType (trancription) {
  if (trancription.status === 'FAILED') trancription.status = 'failed'
  else if (trancription.status === 'SUCCEED') trancription.status = 'completed'
  else trancription.status = 'processing'

  trancription.result = JSON.stringify(trancription.result)

  return trancription
}

async function transcriptionById (args) {
  debug('transcriptionById args', args)
  let options = {
    method: 'GET',
    body: '',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'date': date,
      'Authorization': ''
    }
  }
  options = _addAuthSignitureToOption(options)

  // debug('options', options)

  try {
    let response = await fetch(`https://nlsapi.aliyun.com/transcriptions/${args.id}`, options)
    if (response.status >= 400) {
      debug('error result', await response.json())
      throw new Error('Bad response from server')
    }
    let fetchedTranscription = await response.json()
    debug('fetchedTranscription', fetchedTranscription)
    fetchedTranscription = formatTranscriptionToGraphqlType(fetchedTranscription)
    return fetchedTranscription
  } catch (error) {
    console.error(error)
  }
}

module.exports = {transcriptionCreate, transcriptionById}
