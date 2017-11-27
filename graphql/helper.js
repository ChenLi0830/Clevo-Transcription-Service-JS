var requestPromise = require('request-promise')

function urlExists (url) {
  return requestPromise({ url: url, method: 'HEAD' })
    .then(function (res) {
      return /4\d\d/.test(res.statusCode) === false
    })
    .catch(err => {
      console.log('url doesn\'t exists', err)
      return false
    })
}

module.exports = {urlExists}
