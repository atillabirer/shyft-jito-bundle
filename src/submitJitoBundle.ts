import { InnerSimpleV0Transaction } from "@raydium-io/raydium-sdk";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import { PublicKey, VersionedTransaction, Signer } from "@solana/web3.js";
import { connection, sc, wallet } from "./config";
// create a Jito bundle object, add the tx, monitor it
export default async function submitJitoBundle(
  txs: VersionedTransaction[],
  payer: PublicKey,
  signer: Signer,
  LUT: PublicKey
) {
  // same LUT can be used for both create tx and LUT
  const recentBlockHash = (await connection.getLatestBlockhash()).blockhash;

  let bundle = new Bundle(txs, 5);

  //get a tip account
  const tipAcc = await sc.getTipAccounts();
  const maybebundle = bundle.addTipTx(
    wallet,
    25000,
    new PublicKey(tipAcc[0]),
    recentBlockHash
  );
  if (maybebundle instanceof Error) {
    throw new Error("bundle error");
  } else {
    bundle = maybebundle;
  }

  const bundleId = await sc.sendBundle(bundle);
  // search the ID on the jito website
  console.log(`bundleId: ${bundleId}`);
  return bundleId;
}
