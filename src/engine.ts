/**
 * BagsFuel — The Autonomous Creator Growth Engine
 *
 * This is the main engine that orchestrates the full growth cycle:
 *
 *   1. CLAIM:   Auto-claim accumulated creator fees
 *   2. BUYBACK: Use a % of claimed fees to buy back your token (real volume!)
 *   3. REWARD:  Distribute a % of claimed fees to top holders (engagement!)
 *   4. REPORT:  Generate analytics on token health and growth
 *
 * Each cycle generates real onchain transactions:
 *   - Fee claims = onchain tx
 *   - Buybacks = real trading volume
 *   - Rewards = SOL transfers to holders
 *
 * Usage:
 *   npx ts-node src/engine.ts              # Run one full cycle
 *   npx ts-node src/engine.ts --report     # Analytics only
 *   npx ts-node src/engine.ts --claim      # Claim fees only
 *   npx ts-node src/engine.ts --buyback    # Buyback only (provide SOL amount)
 */

import {
  BUYBACK_PERCENT,
  REWARDS_PERCENT,
  lamportsToSol,
  shortAddress,
  TOKEN_MINT,
  log,
} from "./config";
import { claimFeesForToken, ClaimResult } from "./claim-fees";
import { buybackFromFees, BuybackResult } from "./buyback";
import { rewardsFromFees, RewardsResult } from "./holder-rewards";
import { printReport } from "./analytics";

export interface CycleResult {
  cycle: number;
  timestamp: string;
  claim: ClaimResult;
  buyback: BuybackResult;
  rewards: RewardsResult;
  summary: {
    totalClaimed: number;
    totalBoughtBack: number;
    totalDistributed: number;
    totalCreatorRetained: number;
    totalOnchainTxs: number;
  };
}

/**
 * Run one full growth cycle
 */
export async function runCycle(cycleNumber: number = 1): Promise<CycleResult> {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(`║  BagsFuel Growth Engine — Cycle #${cycleNumber.toString().padStart(3, "0")}          ║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  log("ENGINE", `Starting growth cycle for token ${shortAddress(TOKEN_MINT.toBase58())}...`);
  log("ENGINE", `Config: ${BUYBACK_PERCENT}% buyback, ${REWARDS_PERCENT}% rewards, ${100 - BUYBACK_PERCENT - REWARDS_PERCENT}% retained`);

  // Step 1: Claim fees
  console.log("\n--- Step 1: Auto Fee Claim ---\n");
  const claimResult = await claimFeesForToken();

  const claimedSol = claimResult.success ? claimResult.claimableSol : 0;

  if (claimedSol <= 0) {
    log("ENGINE", "No fees to claim. Cycle complete — will retry next run.");
    return {
      cycle: cycleNumber,
      timestamp: new Date().toISOString(),
      claim: claimResult,
      buyback: {
        inputAmount: 0,
        inputSol: 0,
        outputAmount: 0,
        priceImpact: "0",
        signature: "",
        success: true,
      },
      rewards: {
        totalDistributed: 0,
        totalDistributedSol: 0,
        holdersRewarded: 0,
        holders: [],
        signatures: [],
        success: true,
      },
      summary: {
        totalClaimed: 0,
        totalBoughtBack: 0,
        totalDistributed: 0,
        totalCreatorRetained: 0,
        totalOnchainTxs: claimResult.transactionSignatures.length,
      },
    };
  }

  // Step 2: Buyback
  console.log("\n--- Step 2: Auto Buyback ---\n");
  const buybackResult = await buybackFromFees(claimedSol);

  // Step 3: Holder Rewards
  console.log("\n--- Step 3: Holder Rewards ---\n");
  const rewardsResult = await rewardsFromFees(claimedSol);

  // Step 4: Summary
  const totalTxs =
    claimResult.transactionSignatures.length +
    (buybackResult.signature ? 1 : 0) +
    rewardsResult.signatures.length;

  const retainedPercent = 100 - BUYBACK_PERCENT - REWARDS_PERCENT;
  const retainedSol = claimedSol * (retainedPercent / 100);

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║          Cycle Summary                       ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Fees Claimed:     ${claimedSol.toFixed(6).padStart(12)} SOL          ║`);
  console.log(`║  Bought Back:      ${buybackResult.inputSol.toFixed(6).padStart(12)} SOL (${BUYBACK_PERCENT}%)    ║`);
  console.log(`║  Rewarded Holders: ${rewardsResult.totalDistributedSol.toFixed(6).padStart(12)} SOL (${REWARDS_PERCENT}%)    ║`);
  console.log(`║  Creator Retained: ${retainedSol.toFixed(6).padStart(12)} SOL (${retainedPercent}%)    ║`);
  console.log(`║  Onchain Txs:      ${totalTxs.toString().padStart(12)}              ║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  return {
    cycle: cycleNumber,
    timestamp: new Date().toISOString(),
    claim: claimResult,
    buyback: buybackResult,
    rewards: rewardsResult,
    summary: {
      totalClaimed: claimedSol,
      totalBoughtBack: buybackResult.inputSol,
      totalDistributed: rewardsResult.totalDistributedSol,
      totalCreatorRetained: retainedSol,
      totalOnchainTxs: totalTxs,
    },
  };
}

// ─── CLI Entry Point ───
if (require.main === module) {
  const args = process.argv.slice(2);

  (async () => {
    if (args.includes("--report")) {
      await printReport();
    } else if (args.includes("--claim")) {
      const { claimFeesForToken } = await import("./claim-fees");
      const result = await claimFeesForToken();
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Full cycle
      const result = await runCycle(1);
      log("ENGINE", "Cycle complete. Run again to execute next cycle.");
    }
  })().catch(console.error);
}