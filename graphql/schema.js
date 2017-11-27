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
  transcriptionById: Transcription
}

type Mutation {
  transcriptionCreate (
    fileURL: String!
    provider: ASRProvider!
    options: String
  ): Transcription
}

schema {
  query: Query
  mutation: Mutation
}
`

const resolvers = {
  Query: {
    // savedAudio: (_, { id }) => find(authors, { id: id }),
  },
  Mutation: {
    transcriptionCreate: (_, { provider, fileURL, options }) => {
      return transcriptionCreate({provider, fileURL, options})
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
