import { TokenAmount } from "@raydium-io/raydium-sdk";
import { DEFAULT_TOKEN, connection, wallet } from "./config";
import { getWalletTokenAccount } from "./utils";
import BN from "bn.js";
import { createPoolIx } from "./lpCreate";
import { PublicKey } from "@solana/web3.js";
import createLookupTable from "./createLookupTable";
import createSwapIx from "./swapCreate";
import submitJitoBundle from "./submitJitoBundle";
async function main() {
  // token A and B for the new pair, replace with a Token() class object
  const inputToken = DEFAULT_TOKEN.WSOL; // replace with base token
  const outputToken = DEFAULT_TOKEN.USDC; // replace with quote token

  const createLpBaseAmount = new BN(100000000000000);
  const createLpQuoteAmount = new BN(100000000000000);

  // openbook market id
  const marketId = "marketId";
  const inputTokenAmount = new TokenAmount(inputToken, 10000); // amount of SOL to use per swap

  const walletTokenAccounts = await getWalletTokenAccount(
    connection,
    wallet.publicKey
  );
  // create LP instructions + pool keys
  const createPoolIxResponse = await createPoolIx(
    new PublicKey(marketId),
    wallet,
    walletTokenAccounts,
    inputToken.mint,
    outputToken.mint,
    createLpBaseAmount,
    createLpQuoteAmount
  );
  if (createPoolIxResponse) {
    const { poolKeys, createPoolTx } = createPoolIxResponse;
    //extract instructions from createPoolIxResponse

    console.log(poolKeys);
    // we have the create pool instructions, now we add swap transactions
    // pass pool keys to lookup table
    const onlyPublicKeys = Object.values(poolKeys).filter(
      (poolKey) => poolKey instanceof PublicKey
    );
    const lookupTableAddress = await createLookupTable(
      wallet,
      onlyPublicKeys as PublicKey[]
    );

    console.log("onlyPublicKeys:", onlyPublicKeys);
    //now we batch 15 swaps into 1 bundle
    // jito bundle format: 1 create lp tx, 1 batched swap tx, 1 batched swap  tx, 1 more, 1 tip tx to validator
    const swapIx = await createSwapIx(
      poolKeys,
      inputTokenAmount,
      outputToken,
      walletTokenAccounts,
      wallet,
      3,
      lookupTableAddress
    );

    // pass pool creation ix, swap ix, lookup table address to jito bundle

    const submitBundleRes = await submitJitoBundle(
      // create LP tx, swap tx, swap tx, swap tx (each 5 swap instructions)
      // 1 tip tx added in the submitJitoBundle function
      [createPoolTx, swapIx, swapIx, swapIx],
      wallet.publicKey,
      wallet,
      lookupTableAddress
    );
    console.log("submitBundleRes:", submitBundleRes);
  } else {
    console.log("createPoolIx failed");
    return;
  }

  // send tx
}

main()
  .then((value) => console.log(value))
  .catch((err) => console.log(err));
