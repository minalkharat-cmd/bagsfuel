import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// ─── Validate required environment variables ───
const required = ["BAGS_API_KEY", "SOLANA_RPC_URL", "PRIVATE_KEY", "TOKEN_MINT"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}. Copy .env.example to .env and configure.`);
  }
}

// ─── Core connections ───
export const connection = new Connection(process.env.SOLANA_RPC_URL!, {
  commitment: "confirmed",
});

export const sdk = new BagsSDK(
  process.env.BAGS_API_KEY!,
  connection,
  "processed"
);

export const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.PRIVATE_KEY!)
);

export const walletPubkey = keypair.publicKey;

// ─── Token configuration ───
export const TOKEN_MINT = new PublicKey(process.env.TOKEN_MINT!);
export const SOL_MINT = new PublicKey(
  process.env.SOL_MINT || "So11111111111111111111111111111111111111112"
);

// ─── Buyback configuration ───
export const BUYBACK_PERCENT = parseInt(process.env.BUYBACK_PERCENT || "30", 10);
export const SLIPPAGE_BPS = parseInt(process.env.SLIPPAGE_BPS || "300", 10);

// ─── Holder rewards configuration ───
export const REWARDS_PERCENT = parseInt(process.env.REWARDS_PERCENT || "20", 10);
export const TOP_HOLDERS_COUNT = parseInt(process.env.TOP_HOLDERS_COUNT || "25", 10);

// ─── Engine configuration ───
export const MIN_CLAIM_THRESHOLD = parseInt(
  process.env.MIN_CLAIM_THRESHOLD || "100000000",
  10
); // 0.1 SOL default

// ─── Helpers ───
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function timestamp(): string {
  return new Date().toISOString().replace("T", " ").split(".")[0];
}

export function log(module: string, message: string): void {
  console.log(`[${timestamp()}] [${module}] ${message}`);
}