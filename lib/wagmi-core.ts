import { createConfig } from "@wagmi/core";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { ETHERS_RPC_URL } from "@/lib/rpc";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(ETHERS_RPC_URL),
});

export const coreConfig = createConfig({
  publicClient,
});
