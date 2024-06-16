// create liquidity pool instructions with Raydium SDK

import {
  LOOKUP_TABLE_CACHE,
  Liquidity,
  LiquidityPoolKeys,
  MAINNET_PROGRAM_ID,
  MARKET_STATE_LAYOUT_V3,
  Percent,
  TokenAccount,
  TokenAmount,
  TxVersion,
  jsonInfo2PoolKeys,
  InnerSimpleV0Transaction,
  LiquidityPoolKeysV4,
} from "@raydium-io/raydium-sdk";
import { getComputeBudgetConfig, getWalletTokenAccount } from "./utils";
import { DEFAULT_TOKEN, connection } from "./config";
import {
  Keypair,
  PublicKey,
  PublicKeyInitData,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { unpackMint } from "@solana/spl-token";
import BN from "bn.js";

const inputToken = DEFAULT_TOKEN.WSOL; // USDC
const outputToken = DEFAULT_TOKEN.USDC; // RAY

interface createPoolIxReturnType {
  poolKeys: LiquidityPoolKeysV4;
  createPoolTx: VersionedTransaction;
}

// openbook market id

const marketId = "marketId here";

// raydium create pool instructions
export async function createPoolIx(
  marketId: PublicKey,
  wallet: Keypair,
  tokenAccounts: TokenAccount[],
  baseMint: PublicKey,
  quoteMint: PublicKey,
  baseAmount: BN,
  quoteAmount: BN
): Promise<void | createPoolIxReturnType> {
  const tokenAccountInfo = await getWalletTokenAccount(
    connection,
    wallet.publicKey
  );
  const marketBufferInfo = await connection.getAccountInfo(marketId);
  if (!marketBufferInfo) throw Error("no marketBufferInfo");
  const {
    baseVault: marketBaseVault,
    quoteVault: marketQuoteVault,
    bids: marketBids,
    asks: marketAsks,
    eventQueue: marketEventQueue,
  } = MARKET_STATE_LAYOUT_V3.decode(marketBufferInfo.data);
  console.log("Base mint: ", baseMint.toString());
  console.log("Quote mint: ", quoteMint.toString());

  const accountInfo_base = await connection.getAccountInfo(baseMint);
  if (!accountInfo_base) throw Error("no accountInfo_base");
  const baseTokenProgramId = accountInfo_base.owner;
  const baseDecimals = unpackMint(
    baseMint,
    accountInfo_base,
    baseTokenProgramId
  ).decimals;
  console.log("Base Decimals: ", baseDecimals);

  const accountInfo_quote = await connection.getAccountInfo(quoteMint);
  if (!accountInfo_quote) throw Error("no accountInfo_quote");
  const quoteTokenProgramId = accountInfo_quote.owner;
  const quoteDecimals = unpackMint(
    quoteMint,
    accountInfo_quote,
    quoteTokenProgramId
  ).decimals;

  const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint,
    quoteMint,
    baseDecimals,
    quoteDecimals,
    marketId: new PublicKey(marketId),
    programId: MAINNET_PROGRAM_ID.AmmV4,
    marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
  });
  const { id: ammId, lpMint } = associatedPoolKeys;
  console.log("AMM ID: ", ammId.toString());
  console.log("lpMint: ", lpMint.toString());

  console.log("Quote Decimals: ", quoteDecimals);
  const targetPoolInfo = {
    id: associatedPoolKeys.id.toString(),
    baseMint: associatedPoolKeys.baseMint.toString(),
    quoteMint: associatedPoolKeys.quoteMint.toString(),
    lpMint: associatedPoolKeys.lpMint.toString(),
    baseDecimals: associatedPoolKeys.baseDecimals,
    quoteDecimals: associatedPoolKeys.quoteDecimals,
    lpDecimals: associatedPoolKeys.lpDecimals,
    version: 4,
    programId: associatedPoolKeys.programId.toString(),
    authority: associatedPoolKeys.authority.toString(),
    openOrders: associatedPoolKeys.openOrders.toString(),
    targetOrders: associatedPoolKeys.targetOrders.toString(),
    baseVault: associatedPoolKeys.baseVault.toString(),
    quoteVault: associatedPoolKeys.quoteVault.toString(),
    withdrawQueue: associatedPoolKeys.withdrawQueue.toString(),
    lpVault: associatedPoolKeys.lpVault.toString(),
    marketVersion: 3,
    marketProgramId: associatedPoolKeys.marketProgramId.toString(),
    marketId: associatedPoolKeys.marketId.toString(),
    marketAuthority: associatedPoolKeys.marketAuthority.toString(),
    marketBaseVault: marketBaseVault.toString(),
    marketQuoteVault: marketQuoteVault.toString(),
    marketBids: marketBids.toString(),
    marketAsks: marketAsks.toString(),
    marketEventQueue: marketEventQueue.toString(),
    lookupTableAccount: PublicKey.default.toString(),
  };
  console.log(targetPoolInfo);

  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

  // create liquidity pool and get pool keys + pool creation instructions

  const { innerTransactions } =
    await Liquidity.makeCreatePoolV4InstructionV2Simple({
      connection,
      programId: MAINNET_PROGRAM_ID.AmmV4,
      marketInfo: {
        programId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
        marketId: marketId,
      },
      associatedOnly: false,
      ownerInfo: {
        feePayer: wallet.publicKey,
        wallet: wallet.publicKey,
        tokenAccounts: tokenAccountInfo,
        useSOLBalance: true,
      },
      baseMintInfo: {
        mint: baseMint,
        decimals: baseDecimals,
      },
      quoteMintInfo: {
        mint: quoteMint,
        decimals: quoteDecimals,
      },

      startTime: new BN(Math.floor(Date.now() / 1000)),
      baseAmount: new BN(baseAmount.toString()),
      quoteAmount: new BN(quoteAmount.toString()),

      computeBudgetConfig: await getComputeBudgetConfig(),
      checkCreateATAOwner: true,
      makeTxVersion: TxVersion.V0,
      lookupTableCache: LOOKUP_TABLE_CACHE,
      feeDestinationId: new PublicKey(
        "7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5"
      ),
    });

  const message = new TransactionMessage({
    instructions: innerTransactions.flatMap((it) => it.instructions),
    payerKey: wallet.publicKey,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);
  await transaction.sign([wallet]);

  return { poolKeys, createPoolTx: transaction };
}
