const { makeExecutableSchema } = require('graphql-tools')
const {transcriptionById, transcriptionCreate} = require('./resolvers')
const debug = require('debug')('GraphQL')

const typeDefs = `
enum ASRProvider {
  aliyun,
  tencentCloud
}

enum TranscriptionStatus {
  started
  processing
  completed
  failed
}

type Transcription {
  id: String
  result: String
  status: TranscriptionStatus
}

type Query {
  transcriptionById(
    id: String!
    provider: ASRProvider!
  ): Transcription
}

type Mutation {
  transcriptionCreate (
    fileURL: String!
    provider: ASRProvider!
    callbackURL: String
    vocabularyId: String
    autoSplit: Boolean
    customizationId: String
  ): Transcription
}

schema {
  query: Query
  mutation: Mutation
}
`

const resolvers = {
  Query: {
    transcriptionById: (_, args) => transcriptionById(args)
  },
  Mutation: {
    transcriptionCreate: (_, args) => {
      return transcriptionCreate(args)
      .then(result => {
        debug('result', result)
        return result
      })
    }
  }
}

const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers
})

module.exports = executableSchema
