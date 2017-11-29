const { createApolloFetch } = require('apollo-fetch')

function generateCreateTranscriptionPromise (audioURL) {
  const fetch = createApolloFetch({
    uri: process.env.JS_TRANSCRIBE_SPEECH_ENDPOINT || `http://localhost:3030/graphql`
  })

  const query = `
    mutation transcriptionCreate(
        $fileURL:String!, 
        $provider:ASRProvider!, 
        $callbackURL: String
        $autoSplit: Boolean
    ){
        transcriptionCreate(
        fileURL: $fileURL, 
        provider: $provider, 
        callbackURL: $callbackURL,
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
        # result
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

module.exports = {generateCreateTranscriptionPromise, generateGetTranscriptionPromise}
