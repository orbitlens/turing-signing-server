import { Transaction, Networks, Asset, BASE_FEE, Operation } from 'stellar-sdk'
import BigNumber from 'bignumber.js'

// Contract
// GAVIZKH2TGVSDFOX6UAUX7OTJPGDTXPPDAW5ZEWMYBW7Q7DM34REMMNS
// SAJ4UYLV6QA26H64JSH2UVRIKFGGJUFYEXVNJJX5ETUQ7VMG6ABDVEUP
// 06953a7121507cbc566930162603b50a976120deef7095eb75a93de555667bc2

// Signers
// GA7INKZDMNAMWFSFG7BZT2LQJ6KWJKJHSC52QMAGSEDV25XZRN3J26LV
// GCAQRQIXJMTZM2HYWG2W5Y2MMX4UYF55J4DVSV3S67IDGHO7VLCP3ADP

// User
// GDCJF7HQXOXVZ5ARPAX2PZR5ZX3G6YHVAQLGKI7UZOPU33I222RFSTFI
// SAHXJ5RBXNLTI6DCIQWFMBGQYJXK64L2EGDYEXYJK3C3GQM6L7TCXI6R

// Turrets
// aHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItMC5zdGVsbGFyLmJ1enosaHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItMS5zdGVsbGFyLmJ1eno=

// Fields
// W3sibmFtZSI6InhkciIsInR5cGUiOiJzdHJpbmciLCJkZXNjcmlwdGlvbiI6IlRyYW5zYWN0aW9uIGVudmVsb3BlIHlvdSdyZSBsb29raW5nIHRvIGdldCBzaWduZWQiLCJydWxlIjoiTXVzdCBiZSBhIHZhbGlkIFN0ZWxsYXIgWERSIHN0cmluZyJ9XQ==

const XLM = Asset.native()

async function contract ({request, turrets}) {
  try {
    const transaction = new Transaction(request.xdr, Networks.TESTNET)
    const op = transaction.operations[0]
    const amount = new BigNumber(op.amount)

    if (
      transaction.operations.length > 1
      || op.type !== 'payment'
      || !op.asset.equals(XLM)
      || amount.gt(100)
    ) throw 'Request rejected'

    for (const turret of turrets) {
      const fee = new BigNumber(transaction._tx._attributes.fee)
      const op = Operation.payment({
        destination: turret.vault,
        amount: turret.fee,
        asset: XLM
      })

      transaction._tx._attributes.fee = fee.plus(BASE_FEE).toNumber()
      transaction._tx._attributes.operations.push(op)
    }

    return transaction.toXDR()
  }

  catch(err) {
    throw err
  }
}

export default contract

// contract({request: {
//   xdr: 'AAAAAMSS/PC7r1z0EXgvp+Y9zfZvYPUEFmUj9MufTe0a1qJZAAAAZAACNk4AAAADAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAP5rMYsK+vSYqJzX+deNs42HunlbA9g1BAc90+YUmBDLAAAAAAAAAAA7msoAAAAAAAAAAAA='
// }, turrets: [{
//   vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//   signer: 'GBC7HRL3LGT3YOMO2ERLESQONZ4QXNDPEBXLJTVIWRJ7V6RNGYU6FUZN',
//   fee: '0.5'
// },{
//   vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//   signer: 'GCZ7YWVVSO2MDK5EXDXQXEQTI5VP4J5OWWUCKQAVHN3Q3Y6YPPUH6WTY',
//   fee: '0.5'
// }]})
// .then((data) => console.log(data))
// .catch((err) => console.error(err))