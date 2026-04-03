/**
 * BagsFuel — Holder Rewards Distribution Module
 *
 * Takes a portion of claimed SOL fees and distributes them
 * to the top token holders as SOL rewards. This incentivizes
 * holding and buying more of the creator's token.
 *
 * Every reward distribution = real onchain SOL transfer = active engagement.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  connection,
  keypair,
  TOKEN_MINT,
  REWARDS_PERCENT,
  TOP_HOLDERS_COUNT,
  lamportsToSol,
  solToLamports,
  shortAddress,
  log,
} from "./config";

export interface HolderInfo {
  address: string;
  tokenBalance: number;
  sharePercent: number;
  rewardLamports: number;
}

export interface RewardsResult {
  totalDistributed: number;
  totalDistributedSol: number;
  holdersRewarded: number;
  holders: HolderInfo[];
  signatures: string[];
  success: boolean;
  error?: string;
}

/**
 * Fetch top token holders by querying token accounts
 */
export async function getTopHolders(
  tokenMint?: PublicKey,
  count?: number
): Promise<Array<{ address: string; balance: number }>> {
  const mint = tokenMint || TOKEN_MINT;
  const limit = count || TOP_HOLDERS_COUNT;

  log("REWARDS", `Fetching top ${limit} holders for ${shortAddress(mint.toBase58())}...`);

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

    const holders = accounts
      .map((account) => {
        const parsed = (account.account.data as any).parsed?.info;
        return {
          address: parsed?.owner || "",
          balance: parseInt(parsed?.tokenAmount?.amount || "0"),
        };
      })
      .filter((h) => h.balance > 0 && h.address !== keypair.publicKey.toBase58())
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);

    log("REWARDS", `Found ${holders.length} holder(s) with non-zero balance`);
    return holders;
  } catch (error: any) {
    log("REWARDS", `Error fetching holders: ${error.message}`);
    return [];
  }
}

/**
 * Distribute SOL rewards to top holders proportionally
 */
export async function distributeRewards(
  totalSolForRewards: number
): Promise<RewardsResult> {
  log("REWARDS", `Distributing ${totalSolForRewards.toFixed(6)} SOL to top holders...`);

  if (totalSolForRewards < 0.001) {
    log("REWARDS", "Reward amount too small (<0.001 SOL). Skipping.");
    return {
      totalDistributed: 0,
      totalDistributedSol: 0,
      holdersRewarded: 0,
      holders: [],
      signatures: [],
      success: true,
    };
  }

  try {
    const holders = await getTopHolders();

    if (holders.length === 0) {
      log("REWARDS", "No holders found. Skipping distribution.");
      return {
        totalDistributed: 0,
        totalDistributedSol: 0,
        holdersRewarded: 0,
        holders: [],
        signatures: [],
        success: true,
      };
    }

    const totalBalance = holders.reduce((sum, h) => sum + h.balance, 0);
    const totalLamports = solToLamports(totalSolForRewards);

    const reserveForFees = solToLamports(0.01);
    const distributableLamports = totalLamports - reserveForFees;

    if (distributableLamports <= 0) {
      log("REWARDS", "Not enough SOL after reserving for fees. Skipping.");
      return {
        totalDistributed: 0,
        totalDistributedSol: 0,
        holdersRewarded: 0,
        holders: [],
        signatures: [],
        success: true,
      };
    }

    const holderInfos: HolderInfo[] = holders.map((h) => {
      const sharePercent = (h.balance / totalBalance) * 100;
      const rewardLamports = Math.floor((h.balance / totalBalance) * distributableLamports);
      return {
        address: h.address,
        tokenBalance: h.balance,
        sharePercent,
        rewardLamports,
      };
    });

    const eligibleHolders = holderInfos.filter((h) => h.rewardLamports >= 100_000);

    if (eligibleHolders.length === 0) {
      log("REWARDS", "No holders eligible for rewards (amounts too small). Skipping.");
      return {
        totalDistributed: 0,
        totalDistributedSol: 0,
        holdersRewarded: 0,
        holders: holderInfos,
        signatures: [],
        success: true,
      };
    }

    log("REWARDS", `Distributing to ${eligibleHolders.length} holder(s)...`);

    const signatures: string[] = [];
    const batchSize = 10;

    for (let i = 0; i < eligibleHolders.length; i += batchSize) {
      const batch = eligibleHolders.slice(i, i + batchSize);
      const tx = new Transaction();

      for (const holder of batch) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(holder.address),
            lamports: holder.rewardLamports,
          })
        );
      }

      log("REWARDS", `Sending batch ${Math.floor(i / batchSize) + 1}: ${batch.length} transfers...`);

      const signature = await sendAndConfirmTransaction(connection, tx, [keypair], {
        commitment: "confirmed",
      });

      signatures.push(signature);
      log("REWARDS", `Batch confirmed: ${signature}`);
    }

    const totalDistributed = eligibleHolders.reduce((sum, h) => sum + h.rewardLamports, 0);

    log(
      "REWARDS",
      `Distributed ${lamportsToSol(totalDistributed).toFixed(6)} SOL to ${eligibleHolders.length} holders in ${signatures.length} tx(s)`
    );

    return {
      totalDistributed,
      totalDistributedSol: lamportsToSol(totalDistributed),
      holdersRewarded: eligibleHolders.length,
      holders: holderInfos,
      signatures,
      success: true,
    };
  } catch (error: any) {
    log("REWARDS", `Error distributing rewards: ${error.message}`);
    return {
      totalDistributed: 0,
      totalDistributedSol: 0,
      holdersRewarded: 0,
      holders: [],
      signatures: [],
      success: false,
      error: error.message,
    };
  }
}

/**
 * Calculate and distribute rewards from claimed fees
 */
export async function rewardsFromFees(claimedSol: number): Promise<RewardsResult> {
  const rewardAmount = claimedSol * (REWARDS_PERCENT / 100);
  log("REWARDS", `Allocating ${REWARDS_PERCENT}% of ${claimedSol.toFixed(6)} SOL = ${rewardAmount.toFixed(6)} SOL for holder rewards`);
  return distributeRewards(rewardAmount);
}

// ─── CLI Entry Point ───
if (require.main === module) {
  (async () => {
    console.log("\n=== BagsFuel Holder Rewards Distribution ===\n");

    const holders = await getTopHolders();
    console.log("\nTop holders:");
    holders.forEach((h, i) => {
      console.log(`  ${i + 1}. ${shortAddress(h.address)} — ${h.balance} tokens`);
    });

    const solAmount = parseFloat(process.argv[2] || "0");
    if (solAmount > 0) {
      console.log(`\nDistributing ${solAmount} SOL...\n`);
      const result = await distributeRewards(solAmount);
      console.log("\n--- Result ---");
      console.log(JSON.stringify(result, null, 2));
    }
  })().catch(console.error);
}