require('dotenv').config()
const debug = require('debug')('graphql-resolvers')
const aliyunResolvers = require('./aliyunResolvers')

function transcriptionCreate (args) {
  debug('transcriptionCreate args', args)
  if (args.provider === 'aliyun') return aliyunResolvers.transcriptionCreate(args)
  else return null
}

function transcriptionById (args) {
  debug('transcriptionById args', args)
  if (args.provider === 'aliyun') return aliyunResolvers.transcriptionById(args)
  else return null
}

module.exports = {transcriptionCreate, transcriptionById}
