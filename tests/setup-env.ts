import path from "path";
import fs from "fs";
import bs58 from "bs58";

const walletCacheDir = path.resolve(__dirname, ".cache");
const walletPath = path.join(walletCacheDir, "devnet-wallet.json");

if (!fs.existsSync(walletCacheDir)) {
  fs.mkdirSync(walletCacheDir, { recursive: true });
}

if (!fs.existsSync(walletPath)) {
  const base58Secret = process.env.SWAPBACK_DEVNET_SECRET_BASE58;

  if (!base58Secret) {
    throw new Error(
      "Missing SWAPBACK_DEVNET_SECRET_BASE58. Provide the devnet wallet secret in base58 format."
    );
  }

  const secretBytes = bs58.decode(base58Secret);

  if (secretBytes.length !== 64) {
    throw new Error("Invalid devnet secret: expected 64-byte keypair.");
  }

  fs.writeFileSync(walletPath, JSON.stringify(Array.from(secretBytes)));
}

if (process.env.ANCHOR_WALLET === undefined) {
  process.env.ANCHOR_WALLET = walletPath;
}

if (process.env.ANCHOR_PROVIDER_URL === undefined) {
  process.env.ANCHOR_PROVIDER_URL = "https://api.devnet.solana.com";
}

const homeDirectory = process.env.HOME ?? "";
if (homeDirectory) {
  const solanaConfigDir = path.join(homeDirectory, ".config", "solana");
  const solanaIdPath = path.join(solanaConfigDir, "id.json");

  if (!fs.existsSync(solanaConfigDir)) {
    fs.mkdirSync(solanaConfigDir, { recursive: true });
  }

  if (!fs.existsSync(solanaIdPath)) {
    const secret = fs.readFileSync(process.env.ANCHOR_WALLET, "utf-8");
    fs.writeFileSync(solanaIdPath, secret);
  }
}
