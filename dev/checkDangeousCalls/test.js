const json2csv = require('json2csv')
const fs = require('fs')

let myData = [
    {url: '!23', words: 'abc'},
    {url: 'sflksjdf23', words: ['12312', '12312']}
]
const fields = ['url', 'words']

try {
  var result = json2csv({ data: myData, fields: fields })
  console.log(result)

  fs.writeFile('file.csv', result, function (err) {
    if (err) throw err
    console.log('file saved')
  })
} catch (err) {
  // Errors are thrown for bad options, or if the data is empty and no fields are provided.
  // Be sure to provide fields if it is possible that your data array will be empty.
  console.error(err)
}

function getTranscriptTxt (resultStr) {
  let arr = JSON.parse(resultStr)
  return arr.map(sentence => sentence.onebest).join('|')
}
