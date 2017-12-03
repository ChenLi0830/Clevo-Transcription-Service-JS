const path = require('path')
const fs = require('fs')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const cutAudioByPeriod = ({filePath, outputPath = './', periodSecs = 30}) => {
  let extension = path.extname(filePath)
  let baseName = path.basename(filePath, extension)
  const outputFilePath = `${outputPath}${baseName}.mp3`

  console.log('filePath', filePath)
  console.log('outputFilePath', outputFilePath)

  // Remove left over file
  if (fs.existsSync(outputFilePath)) {
    fs.unlinkSync(outputFilePath)
  }

  return exec(`ffmpeg -i ${filePath} -acodec copy -ss 00:00:00 -t 00:00:${periodSecs} ${outputFilePath}`)
    .then((result) => {
      console.log(`${outputFilePath} is generated`)
      return outputFilePath
    })
    .catch(error => {
      console.error('error', error)
    })
}

// module.exports = cutAudioByPeriod

async function main () {
  const fs = require('fs')
  const path = require('path')

  let fileNames = fs.readdirSync('/Users/Chen/百度云同步盘/Startup/Clevo/优音/record201711271642')
  fileNames = fileNames.filter(fileName => path.extname(fileName) === '.mp3') // remove non-mp3 files

  let filePaths = fileNames.map(name => `/Users/Chen/百度云同步盘/Startup/Clevo/优音/record201711271642/${name}`)
  //   let filePath = '/Users/Chen/百度云同步盘/Startup/Clevo/优音/record201711271642/4000006808_13800138000_18801113000_843780675084_20171101082739.wav.mp3'
  let outputPath = '/Users/Chen/百度云同步盘/Startup/Clevo/优音/record201711271642_cut/'

  for (let filePath of filePaths) {
    await cutAudioByPeriod({filePath, outputPath})
  }
}

main()
