import AWS from 'aws-sdk'
import Promise from 'bluebird'
import { Keypair, Networks, Transaction } from 'stellar-sdk'
import axios from 'axios'
import { get, map, compact } from 'lodash'

import lambda from './js/lambda'
import {
  isDev,
  headers,
  parseError
} from './js/utils'
import Pool from './js/pg'

// Check for fees before signing xdr
// Pools should be released even if there are errors, maybe in the finally block?

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    await lambda.invoke({ // Call after the s3 lookup to ensure we've actually got a contract to work with
      FunctionName: `${process.env.SERVICE_NAME}-dev-checkContractPrivate`,
      InvocationType: 'Event',
      LogType: 'None',
      Payload: JSON.stringify({
        hash: event.pathParameters.hash
      })
    }).promise()

    const pgClientSelect = await Pool.connect()

    // Transactions signed but not submitted
      // Can just keep spamming the same transaction
    // Limits should be set per txn and per contract

    // Unsubmitted contract limits
    // Same txn output limits

    // Dupe is pretty easy to bypass just by sending a different request, amount, to, source, etc.
    // Not currently using sqs

    const dupeLength = await pgClientSelect.query(`
      SELECT cardinality(pendingtxns) FROM contracts
      WHERE contract = '${event.pathParameters.hash}'
    `).then((data) => {
      const contractExists = data.rows[0]

      if (contractExists)
        return get(data, 'rows[0].cardinality')

      throw {
        status: 404,
        message: 'Contract not found'
      }
    }) // Include an extra catch statement in the first request to check for contract existence

    if (dupeLength >= process.env.TURING_DUPE_LIMIT) // Contract locked due to too many duplicate unsubmitted txns
      throw 'TURING_DUPE_LIMIT'

    const uniqueLength = await pgClientSelect.query(`
      select array(select distinct unnest(pendingtxns))
        from contracts
      WHERE contract = '${event.pathParameters.hash}'
    `).then((data) => get(data, 'rows[0].array', []).length)

    if (uniqueLength >= process.env.TURING_UNIQ_LIMIT) // Contract locked due to too many unsubmitted txns
      throw 'TURING_UNIQ_LIMIT'

    const signerSecret = await pgClientSelect.query(`
      SELECT signer FROM contracts
      WHERE contract = '${event.pathParameters.hash}'
    `).then((data) => get(data, 'rows[0].signer'))

    await pgClientSelect.release()

    const signerKeypair = Keypair.fromSecret(signerSecret)

    // Is including the turrets array as a param an attack vector? Could you pay yourself a fee?
      // Each turing server will check to ensure they are paid requiring all turing fees to exist
      // Only attack I see is if there are extra turrets which are not valid signers for the contract

    // Only accept the forwarded body from the collation endpoint to avoid malicious turret fees

    const contractTurrets = await s3.getObjectTagging({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }).promise()
    .then(({TagSet}) => map(TagSet, (tag) => Buffer.from(tag.Value, 'base64').toString('utf8')))

    const turretsContractData = await Promise.map(contractTurrets, async (turret) =>
      axios.get(`${turret}/contract/${event.pathParameters.hash}`)
      .then(({data}) => data)
      .catch(() => null) // Don't error out if a turingSigningServer request fails
    ).then((data) => compact(data)) // if anything errors out, remove that from the response

    const xdr = await lambda.invoke({
      FunctionName: `${process.env.SERVICE_NAME}-dev-runContractPrivate`,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Payload: JSON.stringify({
        hash: event.pathParameters.hash,
        body: {
          request: JSON.parse(event.body),
          turrets: turretsContractData
        }
      })
    }).promise()
    .then(({Payload}) => {
      const payload = JSON.parse(Payload)

      if (payload.isError)
        throw {message: payload.message}
      return payload.message
    })

    const transaction = new Transaction(xdr, Networks[process.env.STELLAR_NETWORK])
    const signature = signerKeypair.sign(transaction.hash()).toString('base64')

    const pgClientUpdate = await Pool.connect()

    await pgClientUpdate.query(`
      update contracts set
        pendingtxns = array_append(pendingtxns, '${transaction.hash().toString('hex')}')
      where contract = '${event.pathParameters.hash}'
    `)

    await pgClientUpdate.release()

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify({
        xdr,
        signer: signerKeypair.publicKey(),
        signature
      })
    }
  }

  catch(err) {
    return parseError(err)
  }
}