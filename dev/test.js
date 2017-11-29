// require('dotenv').config()
// const debug = require('debug')('graphql-resolvers')
// require('dotenv').config({path: '../.env'})

// debug('start!')

let promises = [new Promise(resolve => setTimeout(resolve(Math.random()), 2000))]

Promise.all
