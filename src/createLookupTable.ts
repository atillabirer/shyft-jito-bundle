import {
  ComputeBudgetProgram,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  PublicKey,
  Keypair,
} from "@solana/web3.js";
import { connection } from "./config";
export default async function createLookupTable(
  wallet: Keypair,
  addresses: PublicKey[]
) {
  let latestBH = await connection.getLatestBlockhash("finalized");
  const recentSlot = await connection.getSlot("finalized");

  const bribe = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 25000,
  });
  const [lookupTableInst, lookupTableAddress] =
    await AddressLookupTableProgram.createLookupTable({
      authority: wallet.publicKey,
      recentSlot,
      payer: wallet.publicKey,
    });

  const LUTmessage = new TransactionMessage({
    instructions: [bribe, lookupTableInst],
    payerKey: wallet.publicKey,
    recentBlockhash: latestBH.blockhash,
  }).compileToV0Message();
  const tx = new VersionedTransaction(LUTmessage);
  tx.sign([wallet]);
  const lutSignature = await connection.sendRawTransaction(tx.serialize(), {
    maxRetries: 20,
  });
  console.log("luttxid:", lutSignature);
  await connection.confirmTransaction({
    blockhash: latestBH.blockhash,
    signature: lutSignature,
    lastValidBlockHeight: latestBH.lastValidBlockHeight,
  });
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const extendInst = AddressLookupTableProgram.extendLookupTable({
    addresses: [wallet.publicKey, ...addresses],
    authority: wallet.publicKey,
    payer: wallet.publicKey,
    lookupTable: lookupTableAddress,
  });

  // -------- step 1.7: extend lookup table --------
  const ExtendMessage = new TransactionMessage({
    instructions: [bribe, extendInst],
    payerKey: wallet.publicKey,
    recentBlockhash: latestBH.blockhash,
  }).compileToV0Message();
  const extendTx = new VersionedTransaction(ExtendMessage);
  extendTx.sign([wallet]);
  const extendSignature = await connection.sendRawTransaction(
    extendTx.serialize(),
    { maxRetries: 20 }
  );
  console.log("extendtxxid:", extendSignature);
  await connection.confirmTransaction({
    blockhash: (await connection.getLatestBlockhash()).blockhash,
    signature: extendSignature,
    lastValidBlockHeight: (
      await connection.getLatestBlockhash()
    ).lastValidBlockHeight,
  });
  // wait for tx to finalize
  await new Promise((resolve) => setTimeout(resolve, 10000));
  // return address lookup table
  return lookupTableAddress;
}
