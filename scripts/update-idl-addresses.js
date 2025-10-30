const fs = require("fs");
const path = require("path");

const mappings = [
  {
    name: "swapback_cnft",
    address: "9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw",
  },
  {
    name: "swapback_router",
    address: "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt",
  },
  {
    name: "swapback_buyback",
    address: "EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf",
  },
];

function updateIdl(filePath, address) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing IDL: ${filePath}`);
    return;
  }

  const idl = JSON.parse(fs.readFileSync(filePath, "utf8"));
  idl.address = address;
  if (idl.metadata) {
    idl.metadata.address = address;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(idl, null, 2)}\n`, "utf8");
  console.log(
    `Updated address for ${path.relative(process.cwd(), filePath)} → ${address}`
  );
}

for (const { name, address } of mappings) {
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
  updateIdl(sdkPath, address);
  updateIdl(appPath, address);
}
