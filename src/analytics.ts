/**
 * BagsFuel — Analytics & Reporting Module
 *
 * Provides creators with a clear picture of their token's health,
 * fee earnings, holder activity, and growth metrics — all in plain English.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  sdk,
  connection,
  keypair,
  walletPubkey,
  TOKEN_MINT,
  lamportsToSol,
  shortAddress,
  log,
} from "./config";
import { getClaimablePositions } from "./claim-fees";
import { getTopHolders } from "./holder-rewards";

export interface TokenAnalytics {
  tokenMint: string;
  walletBalance: number;
  walletBalanceSol: number;
  totalClaimableSol: number;
  holderCount: number;
  topHolders: Array<{ address: string; balance: number }>;
  claimablePositions: Array<{
    baseMint: string;
    claimableSol: number;
  }>;
  timestamp: string;
}

/**
 * Get wallet SOL balance
 */
export async function getWalletBalance(): Promise<number> {
  const balance = await connection.getBalance(walletPubkey);
  return balance;
}

/**
 * Get total number of token holders
 */
export async function getHolderCount(tokenMint?: PublicKey): Promise<number> {
  const mint = tokenMint || TOKEN_MINT;

  try {
    const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
      filters: [
        { dataSize: 165 },
        {
          memcmp: {
            offset: 0,
            bytes: mint.toBase58(),
          },
        },
      ],
    });

    const activeHolders = accounts.filter((acc) => {
      const parsed = (acc.account.data as any).parsed?.info;
      return parseInt(parsed?.tokenAmount?.amount || "0") > 0;
    });

    return activeHolders.length;
  } catch (error: any) {
    log("ANALYTICS", `Error getting holder count: ${error.message}`);
    return 0;
  }
}

/**
 * Generate full analytics report
 */
export async function generateReport(): Promise<TokenAnalytics> {
  log("ANALYTICS", "Generating full token report...");

  const [walletBalance, holderCount, topHolders, claimablePositions] = await Promise.all([
    getWalletBalance(),
    getHolderCount(),
    getTopHolders(TOKEN_MINT, 10),
    getClaimablePositions(),
  ]);

  const totalClaimableLamports = claimablePositions.reduce(
    (sum, p) => sum + p.totalClaimableLamportsUserShare,
    0
  );

  const report: TokenAnalytics = {
    tokenMint: TOKEN_MINT.toBase58(),
    walletBalance,
    walletBalanceSol: lamportsToSol(walletBalance),
    totalClaimableSol: lamportsToSol(totalClaimableLamports),
    holderCount,
    topHolders,
    claimablePositions: claimablePositions.map((p) => ({
      baseMint: p.baseMint,
      claimableSol: lamportsToSol(p.totalClaimableLamportsUserShare),
    })),
    timestamp: new Date().toISOString(),
  };

  return report;
}

/**
 * Print a human-readable analytics report
 */
export async function printReport(): Promise<void> {
  const report = await generateReport();

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║     BagsFuel — Token Growth Report       ║");
  console.log("╚══════════════════════════════════════════╝\n");

  console.log(`Token:           ${shortAddress(report.tokenMint)}`);
  console.log(`Wallet Balance:  ${report.walletBalanceSol.toFixed(4)} SOL`);
  console.log(`Total Claimable: ${report.totalClaimableSol.toFixed(6)} SOL`);
  console.log(`Total Holders:   ${report.holderCount}`);

  if (report.claimablePositions.length > 0) {
    console.log("\n--- Claimable Fees ---");
    report.claimablePositions.forEach((p) => {
      console.log(`  ${shortAddress(p.baseMint)}: ${p.claimableSol.toFixed(6)} SOL`);
    });
  }

  if (report.topHolders.length > 0) {
    console.log("\n--- Top 10 Holders ---");
    report.topHolders.forEach((h, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${shortAddress(h.address)} — ${h.balance.toLocaleString()} tokens`);
    });
  }

  console.log(`\nReport generated: ${report.timestamp}`);
  console.log("─".repeat(44));
}

// ─── CLI Entry Point ───
if (require.main === module) {
  printReport().catch(console.error);
}