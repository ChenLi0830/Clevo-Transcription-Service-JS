(async function () {
  require('dotenv').config()
  const { removeCallBySource } = require('./helperXF')
  const debug = require('debug')('findAndRemove - localscript')

  let toBeRemovedURLs = require('./toBeRemovedURLs')
  let CON_CURRENCY = 2

  debug('toBeRemovedURLs', toBeRemovedURLs)
    // let source = 'http://processed-wav-dev-uswest.oss-us-west-1.aliyuncs.com/riskyCalls/2.wav'

  debug('start removing')
  while (toBeRemovedURLs.length > 0) {
    let urlBatch = toBeRemovedURLs.splice(0, CON_CURRENCY)
    debug('processing urlBach', urlBatch)

    let promises = urlBatch.map(url => {
      return removeCallBySource(url)
    })
    let results = await Promise.all(promises)
    debug(`removed ${results.length} results`, JSON.stringify(results))
  }

    // removeCallBySource(source)
    //   .then(result => {
    //     debug('removed result', result)
    //   })
})()
