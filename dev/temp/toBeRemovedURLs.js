// let urls = [
//   // 注意，这里是URL，对应的应该是这种形式：
//   // 'http://processed-wav-dev-uswest.oss-us-west-1.aliyuncs.com/Youyin-test-Nov28-30s/4006868588_18218128915_09356963435_188170855446_20171101000808.wav.mp3'
// ]

const fs = require('fs')
const path = require('path')
// const file = require('../../unmatchedAudio.txt')
let file = fs.readFileSync('./unmatchedAudio.txt', {encoding: 'utf8'})
let URLAndPossbilityArray = file.split('\n').filter(item => item.indexOf('http') !== -1)
let urls30s = URLAndPossbilityArray.map(urlNPossibility => urlNPossibility.split('@')[0])

let fullAudioUrls = urls30s.map(url30s => `http://processed-wav-dev-uswest.oss-us-west-1.aliyuncs.com/Youyin-test-Nov28/${path.basename(url30s)}`)

// console.log('file', file)
// console.log('URLAndPossbilityArray', URLAndPossbilityArray)
console.log('fullAudioUrls', fullAudioUrls)
console.log('fullAudioUrls.length', fullAudioUrls.length)

module.exports = fullAudioUrls
