import AWS from 'aws-sdk'
import { map } from 'lodash'

import { headers, parseError } from './js/utils'

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

export default async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    await s3.deleteObjectTagging({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }).promise()

    const TagSet = map(JSON.parse(event.body).turrets, (turret, i) => {
      return {
        Key: `Turret_${i}`,
        Value: Buffer.from(turret, 'utf8').toString('base64')
      }
    })

    await s3.putObjectTagging({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
      Tagging: { TagSet }
    }).promise()

    return {
      headers,
      statusCode: 200
    }
  }

  catch(err) {
    return parseError(err)
  }
}