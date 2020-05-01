// import { Server } from 'stellar-sdk'
// import Promise from 'bluebird'
import { get } from 'lodash'
import moment from 'moment'

import Pool from './js/pg'

// If a txn has been submitted to the network remove it from the pendingtxns array
  // Since this will include looping over a rate limited horizon endpoint we should only run this occasionally and not as a response to a contract call

// const horizon = process.env.STELLAR_NETWORK === 'TESTNET' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'
// const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const pgClient = await Pool.connect()

    const contractMeta = await pgClient.query(`
      select nextdedupe, nextflush
        from contracts
      WHERE contract = '${event.hash}'
    `).then((data) => get(data, 'rows[0]'))

    if (moment(parseInt(contractMeta.nextdedupe, 10)).isBefore()) {
      console.log('Run Dedupe')

      await pgClient.query(`
        update contracts set
          pendingtxns = array(select distinct unnest(pendingtxns)),
          nextdedupe = ${
            parseInt(moment().add(1, 'minute').format('x'), 10) // Dedupe every minute
          }
        WHERE contract = '${event.hash}'
      `)
    }

    if (moment(parseInt(contractMeta.nextflush, 10)).isBefore()) {
      console.log('Run Flush')

      await pgClient.query(`
        update contracts set
          pendingtxns = NULL,
          nextflush = ${
            parseInt(moment().add(1, 'hour').format('x'), 10) // Flush every hour
          }
        WHERE contract = '${event.hash}'
      `)
    }

    await pgClient.release()

    // Need to add `array(select distinct unnest(pendingtxns))` to the contractMeta call
    // const response = await new Promise.map(uniqueTxns, (txn) => {
    //   return server
    //   .transactions()
    //   .transaction(txn)
    //   .call()
    //   .then((data) => true)
    //   .catch((err) => false)
    // }, {concurrency: 1})

    return {
      isError: false,
      message: contractMeta
    }
  }

  catch(err) {
    console.error(err)

    return {
      isError: true,
      message: err.message
    }
  }
}

// Immediately flush if a txn exists on the blockchain (incurs the cost of looking that data up)
// Dedupe if it's been 10 minutes since last dedupe
// Flush unique if it's been 1 hour since last unique flush (may flush very recent submissions)

// update contracts set
//   pendingtxns = (select array_agg(distinct e) from unnest(pendingtxns || '{${transaction.hash().toString('hex')}}') e)
// where not pendingtxns @> '{${transaction.hash().toString('hex')}}'