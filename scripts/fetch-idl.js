const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const os = require("os");

const programs = [
  { name: "swapback_cnft", id: "9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw" },
  {
    name: "swapback_router",
    id: "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt",
  },
  {
    name: "swapback_buyback",
    id: "EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf",
  },
];

async function main() {
  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  const connection = new anchor.web3.Connection(rpcUrl, {
    commitment: "confirmed",
  });
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const secretKey = fs.readFileSync(walletPath, "utf8");
  const keypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(secretKey))
  );
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  for (const { name, id } of programs) {
    const programId = new PublicKey(id);
    const idl = await anchor.Program.fetchIdl(programId, provider);
    if (!idl) {
      throw new Error(`Failed to fetch IDL for ${name}`);
    }

    const serialized = `${JSON.stringify(idl, null, 2)}\n`;
    const sdkPath = path.join(
      __dirname,
      "..",
      "sdk",
      "src",
      "idl",
      `${name}.json`
    );
    const appPath = path.join(
      __dirname,
      "..",
      "app",
      "public",
      "idl",
      `${name}.json`
    );

    fs.mkdirSync(path.dirname(sdkPath), { recursive: true });
    fs.mkdirSync(path.dirname(appPath), { recursive: true });
    fs.writeFileSync(sdkPath, serialized, "utf8");
    fs.writeFileSync(appPath, serialized, "utf8");

    console.log(`✅ Updated IDL for ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
