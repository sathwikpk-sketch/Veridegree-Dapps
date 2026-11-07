const { run, ethers, network } = require("hardhat");

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("This verification script must be run with --network sepolia.");
  }
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY is missing from .env.");
  }
  if (!process.env.CONTRACT_ADDRESS) {
    throw new Error("Set CONTRACT_ADDRESS in your environment or .env before verification.");
  }

  const admins = [process.env.ADMIN_A, process.env.ADMIN_B, process.env.ADMIN_C];
  if (admins.some((value) => !value)) {
    throw new Error("ADMIN_A, ADMIN_B and ADMIN_C are required to verify the constructor arguments.");
  }
  const normalizedAdmins = admins.map((address) => ethers.getAddress(address));
  const contractAddress = ethers.getAddress(process.env.CONTRACT_ADDRESS);

  await run("verify:verify", {
    address: contractAddress,
    constructorArguments: [normalizedAdmins],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
