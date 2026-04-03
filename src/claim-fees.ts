/**
 * BagsFuel — Auto Fee Claiming Module
 *
 * Scans all claimable positions for the creator's wallet,
 * identifies unclaimed fees for their token, and executes
 * claim transactions. Every claim = real onchain transaction.
 */

import { signAndSendTransaction } from "@bagsfm/bags-sdk";
import { PublicKey, VersionedTransaction, Transaction } from "@solana/web3.js";
import {
  sdk,
  connection,
  keypair,
  walletPubkey,
  TOKEN_MINT,
  MIN_CLAIM_THRESHOLD,
  lamportsToSol,
  shortAddress,
  log,
} from "./config";

export interface ClaimResult {
  tokenMint: string;
  claimableLamports: number;
  claimableSol: number;
  transactionSignatures: string[];
  success: boolean;
  error?: string;
}

/**
 * Get all claimable positions for the wallet
 */
export async function getClaimablePositions(): Promise<
  Array<{
    baseMint: string;
    totalClaimableLamportsUserShare: number;
    isCustomFeeVault: boolean;
  }>
> {
  log("CLAIM", `Scanning claimable positions for ${shortAddress(walletPubkey.toBase58())}...`);

  const positions = await sdk.fee.getAllClaimablePositions(walletPubkey);

  log("CLAIM", `Found ${positions.length} total claimable position(s)`);
  return positions;
}

/**
 * Get claimable amount for a specific token
 */
export async function getClaimableForToken(
  tokenMint?: PublicKey
): Promise<{ lamports: number; sol: number }> {
  const mint = tokenMint || TOKEN_MINT;
  const positions = await getClaimablePositions();

  const tokenPosition = positions.find(
    (p) => p.baseMint === mint.toBase58()
  );

  if (!tokenPosition) {
    log("CLAIM", `No claimable fees found for token ${shortAddress(mint.toBase58())}`);
    return { lamports: 0, sol: 0 };
  }

  const lamports = tokenPosition.totalClaimableLamportsUserShare;
  const sol = lamportsToSol(lamports);
  log("CLAIM", `Claimable for ${shortAddress(mint.toBase58())}: ${sol.toFixed(6)} SOL (${lamports} lamports)`);

  return { lamports, sol };
}

/**
 * Execute fee claim for a specific token
 */
export async function claimFeesForToken(
  tokenMint?: PublicKey
): Promise<ClaimResult> {
  const mint = tokenMint || TOKEN_MINT;
  const mintStr = mint.toBase58();

  log("CLAIM", `Starting fee claim for token ${shortAddress(mintStr)}...`);

  // Check claimable amount first
  const { lamports, sol } = await getClaimableForToken(mint);

  if (lamports < MIN_CLAIM_THRESHOLD) {
    log(
      "CLAIM",
      `Claimable amount (${sol.toFixed(6)} SOL) below threshold (${lamportsToSol(MIN_CLAIM_THRESHOLD)} SOL). Skipping.`
    );
    return {
      tokenMint: mintStr,
      claimableLamports: lamports,
      claimableSol: sol,
      transactionSignatures: [],
      success: true,
    };
  }

  try {
    // Get claim transactions from Bags API
    const transactions = await sdk.fee.getClaimTransactions(
      keypair.publicKey,
      mint
    );

    if (!transactions || transactions.length === 0) {
      log("CLAIM", "No claim transactions returned from API");
      return {
        tokenMint: mintStr,
        claimableLamports: lamports,
        claimableSol: sol,
        transactionSignatures: [],
        success: true,
      };
    }

    log("CLAIM", `Got ${transactions.length} claim transaction(s). Signing and sending...`);

    const signatures: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      log("CLAIM", `Sending transaction ${i + 1}/${transactions.length}...`);

      // Handle both legacy Transaction and VersionedTransaction from the SDK
      let versionedTx: VersionedTransaction;
      if (tx instanceof VersionedTransaction) {
        versionedTx = tx;
      } else {
        // Legacy Transaction — convert to VersionedTransaction
        const { MessageV0 } = await import("@solana/web3.js");
        const latestBlockhash = await connection.getLatestBlockhash();
        (tx as Transaction).recentBlockhash = latestBlockhash.blockhash;
        (tx as Transaction).feePayer = keypair.publicKey;
        const messageV0 = new MessageV0({
          header: (tx as Transaction).compileMessage().header,
          staticAccountKeys: (tx as Transaction).compileMessage().accountKeys,
          recentBlockhash: latestBlockhash.blockhash,
          compiledInstructions: (tx as Transaction).compileMessage().instructions.map((ix: any) => ({
            programIdIndex: ix.programIdIndex,
            accountKeyIndexes: ix.accounts,
            data: ix.data,
          })),
          addressTableLookups: [],
        });
        versionedTx = new VersionedTransaction(messageV0);
      }

      const signature = await signAndSendTransaction(
        connection,
        sdk.state.getCommitment(),
        versionedTx,
        keypair
      );

      signatures.push(signature);
      log("CLAIM", `Confirmed: ${signature}`);
    }

    log("CLAIM", `Successfully claimed ${sol.toFixed(6)} SOL from ${shortAddress(mintStr)} in ${signatures.length} tx(s)`);

    return {
      tokenMint: mintStr,
      claimableLamports: lamports,
      claimableSol: sol,
      transactionSignatures: signatures,
      success: true,
    };
  } catch (error: any) {
    log("CLAIM", `Error claiming fees: ${error.message}`);
    return {
      tokenMint: mintStr,
      claimableLamports: lamports,
      claimableSol: sol,
      transactionSignatures: [],
      success: false,
      error: error.message,
    };
  }
}

/**
 * Claim ALL claimable positions across all tokens
 */
export async function claimAllFees(): Promise<ClaimResult[]> {
  const positions = await getClaimablePositions();
  const results: ClaimResult[] = [];

  for (const position of positions) {
    if (position.totalClaimableLamportsUserShare >= MIN_CLAIM_THRESHOLD) {
      const result = await claimFeesForToken(new PublicKey(position.baseMint));
      results.push(result);
    }
  }

  const totalClaimed = results.reduce((sum, r) => sum + (r.success ? r.claimableSol : 0), 0);
  log("CLAIM", `Total claimed across all tokens: ${totalClaimed.toFixed(6)} SOL`);

  return results;
}

// ─── CLI Entry Point ───
if (require.main === module) {
  (async () => {
    console.log("\n=== BagsFuel Auto Fee Claimer ===\n");
    const result = await claimFeesForToken();
    console.log("\n--- Result ---");
    console.log(JSON.stringify(result, null, 2));
  })().catch(console.error);
}