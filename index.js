import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';

const ECPair = ECPairFactory.ECPairFactory(ecc);
const testnet = bitcoin.networks.testnet;

function toOutputScript(address){
  return bitcoin.address.toOutputScript(address, regtest);
}

function idToHash(txid){
  return Buffer.from(txid, 'hex').reverse();
}


const alice = ECPair.fromWIF('cScfkGjbzzoeewVWmU2hYPUHeVGJRDdFt7WhmrVVGkxpmPP8BHWe', testnet);
const bob = ECPair.fromWIF('cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsLwjHXA9x', testnet);
const txdata = '010000000001013733c48c7a1aaaf6258fffa7497068d723e091a83ea7294f18bd31af84c43c4e0000000000ffffffff02e80300000000000017a91467bb43193a2e12174bcb407f9c3d2b16bba56ad4872ae50d060000000016001492873c44bd93289864842244a53498d010f00f72024730440220712d25eb01a8b4771cbf9e77eddd52193163d671bbedba18f0984261c2e6cd8e0220249d7407d6451d1d4f5be041914032f678f03fda9f82dabac2bb310ee4861ecc0121036125f73199e066c7bab0dcebdd9dd0b3cb384e5fb4c01c55b48f5b910e8fcd0400000000';

const hashType = bitcoin.Transaction.SIGHASH_ALL;

psbt()

async function psbt() {
  const pubkeys = [
    alice.publicKey,
    bob.publicKey,
  ].map(hex => Buffer.from(hex, 'hex'));
  const { address, redeem } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2ms({ 
      m: 2,
      pubkeys,
      network: testnet
    }),
    network: testnet,
  });
  console.log(address);
  console.log(redeem.output.toString('hex'));

  const inputData = {
    hash: "b8a6e4309e17cee23c36697e3b7338819906d5e868a34be4dcedec93a57f5956", // string of txid or Buffer of tx hash. (txid and hash are reverse order)
    index: 0, // the output index of the txo you are spending
    nonWitnessUtxo: Buffer.from(txdata, 'hex'), // the full previous transaction as a Buffer
    redeemScript: redeem.output,
  }

  // network is only needed if you pass an address to addOutput
  // using script (Buffer of scriptPubkey) instead will avoid needed network.
  const psbt = new bitcoin.Psbt({ network: testnet })
    .addInput(inputData) // alice & bob multiSig unspent
    .addOutput({
      address: 'tb1qj2rnc39ajv5fseyyyfz22dyc6qg0qrmjt0xzks', // Satoricoin
      value: 600,
    });

  // Let's show a new feature with PSBT.
  // We can have multiple signers sign in parrallel and combine them.
  // (this is not necessary, but a nice feature)

  // encode to send out to the signers
  const psbtBaseText = psbt.toBase64();

  console.log("psbtBaseText: " + psbtBaseText);

  // each signer imports
  const signer1 = bitcoin.Psbt.fromBase64(psbtBaseText);
  const signer2 = bitcoin.Psbt.fromBase64(psbtBaseText);

  // Alice signs each input with the respective private keys
  // signInput and signInputAsync are better
  // (They take the input index explicitly as the first arg)
  signer1.signInput(0, alice);
  signer2.signInput(0, bob);

  // If your signer object's sign method returns a promise, use the following
  // await signer2.signAllInputsAsync(alice2.keys[0])

  // encode to send back to combiner (signer 1 and 2 are not near each other)
  const s1text = signer1.toBase64();
  const s2text = signer2.toBase64();

  console.log("s1text: " + s1text);
  console.log("s2text: " + s2text);

  const final1 = bitcoin.Psbt.fromBase64(s1text);
  const final2 = bitcoin.Psbt.fromBase64(s2text);

  console.log("final1: " + final1);

  // final1.combine(final2) would give the exact same result
  psbt.combine(final1, final2);

  // Finalizer wants to check all signatures are valid before finalizing.
  // If the finalizer wants to check for specific pubkeys, the second arg
  // can be passed. See the first multisig example below.
  // assert.strictEqual(psbt.validateSignaturesOfInput(0, validator), true);
  // assert.strictEqual(psbt.validateSignaturesOfInput(1, validator), true);

  // This step it new. Since we separate the signing operation and
  // the creation of the scriptSig and witness stack, we are able to
  psbt.finalizeAllInputs();

  // build and broadcast our RegTest network
  // await regtestUtils.broadcast(psbt.extractTransaction().toHex());
  // to build and broadcast to the actual Bitcoin network, see https://github.com/bitcoinjs/bitcoinjs-lib/issues/839

  console.log(psbt.extractTransaction().toHex());

  console.log("======");

  const signer3 = bitcoin.Psbt.fromBase64(s1text);
  signer3.signInput(0, bob);
  const s3text = signer3.toBase64();

  console.log("s3text: " + s3text);

  const final3 = bitcoin.Psbt.fromBase64(s3text);
  final3.finalizeAllInputs();
  console.log(final3.extractTransaction().toHex());

}


