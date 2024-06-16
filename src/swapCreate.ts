// create swap instructions

import {
  InnerSimpleV0Transaction,
  Liquidity,
  Percent,
  TxVersion,
} from "@raydium-io/raydium-sdk";
import {
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";
import { connection } from "./config";

export default async function createSwapIx(
  poolKeys: any,
  inputTokenAmount: any,
  outputToken: any,
  walletTokenAccounts: any,
  wallet: any,
  times: number = 1,
  LUT: PublicKey
) {
  // -- get lookup table
  const lookupTableAcc = await connection.getAddressLookupTable(LUT);
  // -------- step 1: coumpute amount out --------
  const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
    amountIn: inputTokenAmount,
    currencyOut: outputToken,
    slippage: new Percent(30, 100), // for new LP its quite common to have high slippage
  });
  const ix = await Liquidity.makeSwapFixedInInstruction(
    {
      poolKeys,
      userKeys: {
        owner: wallet.publicKey,
        tokenAccountIn: walletTokenAccounts[0],
        tokenAccountOut: walletTokenAccounts[1],
      },
      amountIn: inputTokenAmount,
      minAmountOut: minAmountOut.raw,
    },
    4
  );
  // repeat the ix times amount in the array
  let ixs = [];
  for (let i = 0; i < times; i++) {
    ixs.push(...ix.innerTransaction.instructions);
  }
  // create a transaction that duplicates swap ix in the same tx
  const message = new TransactionMessage({
    instructions: ixs,
    payerKey: wallet.publicKey,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  }).compileToV0Message([lookupTableAcc.value!]);

  const transaction = new VersionedTransaction(message);
  await transaction.sign([wallet]);

  return transaction;
}
