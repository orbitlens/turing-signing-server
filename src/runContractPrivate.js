import requireFromString from 'require-from-string'
import AWS from 'aws-sdk'
import Promise from 'bluebird'

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const s3Contract = await s3.getObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.hash,
    }).promise()

    // const fs = require('fs')
    // const path = require('path')
    // const s3Contract = { Body: fs.readFileSync(path.resolve(`${isDev ? '' : 'src/'}contracts/dist/contract.js`))}

    return {
      isError: false,
      message: await requireFromString(s3Contract.Body.toString('utf8'))(event.body)
    }
  }

  catch(err) {
    return {
      isError: true,
      message: err.message
    }
  }

  // requireFromString(script)(body)
  // .then((data) => callback(null, data))
  // .catch((err) => {
  //   console.error('butts')
  //   callback(err)
  //   throw err
  // })
}

// Don't seem able to throw and error which shows up in the lambda catch promise block