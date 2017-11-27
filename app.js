require('dotenv').config()

const express = require('express')
const graphqlHTTP = require('express-graphql')
const schema = require('./graphql/schema')

const app = express()

app.use('/graphql', graphqlHTTP({
  schema: schema,
  graphiql: true
}))

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`App listening on port ${port}!`))
