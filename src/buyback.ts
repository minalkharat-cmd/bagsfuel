/**
 * BagsFuel — Auto Buyback Module
 *
 * Takes a portion of claimed SOL fees and buys back the creator's
 * token on the open market via Bags swap API. This generates REAL
 * trading volume and supports the token price.
 *
 * Every buyback = real onchain swap transaction = volume + active trader.
 */

import { signAndSendTransaction } from "@bagsfm/bags-sdk";
import { PublicKey } from "@solana/web3.js";
import {
  sdk,
  connection,
  keypair,
  TOKEN_MINT,
  SOL_MINT,
  BUYBACK_PERCENT,
  SLIPPAGE_BPS,
  lamportsToSol,
  solToLamports,
  shortAddress,
  log,
} from "./config";

export interface BuybackResult {
  inputAmount: number;
  inputSol: number;
  outputAmount: number;
  priceImpact: string;
  signature: string;
  success: boolean;
  error?: string;
}

/**
 * Get a quote for buying back the token with SOL
 */
export async function getBuybackQuote(solAmount: number) {
  const lamports = solToLamports(solAmount);

  log("BUYBACK", `Getting quote: ${solAmount.toFixed(6)} SOL -> ${shortAddress(TOKEN_MINT.toBase58())}...`);

  const quote = await sdk.trade.getQuote({
    inputMint: SOL_MINT,
    outputMint: TOKEN_MINT,
    amount: lamports,
    slippageMode: SLIPPAGE_BPS > 0 ? "manual" : "auto",
    slippageBps: SLIPPAGE_BPS > 0 ? SLIPPAGE_BPS : undefined,
  });

  log("BUYBACK", `Quote received: ${quote.outAmount} tokens out, ${quote.priceImpactPct}% price impact`);

  return quote;
}

/**
 * Execute a buyback: swap SOL for the creator's token
 */
export async function executeBuyback(solAmount: number): Promise<BuybackResult> {
  log("BUYBACK", `Executing buyback of ${solAmount.toFixed(6)} SOL into ${shortAddress(TOKEN_MINT.toBase58())}...`);

  if (solAmount <= 0) {
    log("BUYBACK", "Buyback amount is 0 or negative. Skipping.");
    return {
      inputAmount: 0,
      inputSol: 0,
      outputAmount: 0,
      priceImpact: "0",
      signature: "",
      success: true,
    };
  }

  try {
    // Step 1: Get quote
    const quote = await getBuybackQuote(solAmount);

    // Safety check: skip if price impact is too high (>5%)
    const impact = parseFloat(quote.priceImpactPct || "0");
    if (impact > 5) {
      log("BUYBACK", `Price impact too high (${impact}%). Skipping to protect token price.`);
      return {
        inputAmount: solToLamports(solAmount),
        inputSol: solAmount,
        outputAmount: 0,
        priceImpact: quote.priceImpactPct,
        signature: "",
        success: false,
        error: `Price impact too high: ${impact}%`,
      };
    }

    // Step 2: Create swap transaction
    const swapResult = await sdk.trade.createSwapTransaction({
      quoteResponse: quote,
      userPublicKey: keypair.publicKey,
    });

    // Step 3: Sign and send
    const signature = await signAndSendTransaction(
      connection,
      sdk.state.getCommitment(),
      swapResult.transaction,
      keypair
    );

    log("BUYBACK", `Buyback confirmed! Tx: ${signature}`);
    log("BUYBACK", `Swapped ${solAmount.toFixed(6)} SOL -> ${quote.outAmount} tokens`);

    return {
      inputAmount: solToLamports(solAmount),
      inputSol: solAmount,
      outputAmount: parseInt(quote.outAmount),
      priceImpact: quote.priceImpactPct,
      signature,
      success: true,
    };
  } catch (error: any) {
    log("BUYBACK", `Buyback failed: ${error.message}`);
    return {
      inputAmount: solToLamports(solAmount),
      inputSol: solAmount,
      outputAmount: 0,
      priceImpact: "unknown",
      signature: "",
      success: false,
      error: error.message,
    };
  }
}

/**
 * Calculate and execute buyback from claimed fees
 */
export async function buybackFromFees(claimedSol: number): Promise<BuybackResult> {
  const buybackAmount = claimedSol * (BUYBACK_PERCENT / 100);

  log("BUYBACK", `Allocating ${BUYBACK_PERCENT}% of ${claimedSol.toFixed(6)} SOL = ${buybackAmount.toFixed(6)} SOL for buyback`);

  if (buybackAmount < 0.001) {
    log("BUYBACK", "Buyback amount too small (<0.001 SOL). Skipping.");
    return {
      inputAmount: 0,
      inputSol: 0,
      outputAmount: 0,
      priceImpact: "0",
      signature: "",
      success: true,
    };
  }

  return executeBuyback(buybackAmount);
}

// ─── CLI Entry Point ───
if (require.main === module) {
  const solAmount = parseFloat(process.argv[2] || "0.01");

  (async () => {
    console.log("\n=== BagsFuel Auto Buyback Engine ===\n");
    console.log(`Buying back ${solAmount} SOL worth of ${shortAddress(TOKEN_MINT.toBase58())}...\n`);

    const result = await executeBuyback(solAmount);

    console.log("\n--- Result ---");
    console.log(JSON.stringify(result, null, 2));
  })().catch(console.error);
}