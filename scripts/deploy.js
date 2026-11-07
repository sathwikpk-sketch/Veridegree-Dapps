const { ethers, network } = require("hardhat");

function readSepoliaAdmins() {
  const values = [process.env.ADMIN_A, process.env.ADMIN_B, process.env.ADMIN_C];
  if (values.some((value) => !value)) {
    throw new Error("For Sepolia deployment, set ADMIN_A, ADMIN_B and ADMIN_C in .env.");
  }

  const admins = values.map((value) => ethers.getAddress(value));
  if (admins.some((address) => address === ethers.ZeroAddress)) {
    throw new Error("Admin addresses must not be the zero address.");
  }
  if (new Set(admins).size !== 3) {
    throw new Error("ADMIN_A, ADMIN_B and ADMIN_C must be three distinct addresses.");
  }
  return admins;
}

async function resolveAdmins() {
  if (network.name === "sepolia") {
    if (!process.env.SEPOLIA_RPC_URL) throw new Error("SEPOLIA_RPC_URL is missing from .env.");
    if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is missing from .env.");
    return readSepoliaAdmins();
  }

  const signers = await ethers.getSigners();
  if (signers.length < 3) {
    throw new Error("Need at least 3 local accounts to deploy the 2-of-3 admin contract.");
  }
  console.log("Using the first three local Hardhat signers as admins.");
  return [signers[0].address, signers[1].address, signers[2].address];
}

async function main() {
  const admins = await resolveAdmins();
  console.log(`Network: ${network.name}`);
  console.log("Deploying with admins:", admins);

  const VeriDegree = await ethers.getContractFactory("VeriDegree");
  const veriDegree = await VeriDegree.deploy(admins);
  await veriDegree.waitForDeployment();

  const address = await veriDegree.getAddress();
  console.log("VeriDegree deployed to:", address);
  console.log("Constructor admins:", JSON.stringify(admins));
  if (network.name === "sepolia") {
    console.log(`Verify with: CONTRACT_ADDRESS=${address} npm run verify:sepolia`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
