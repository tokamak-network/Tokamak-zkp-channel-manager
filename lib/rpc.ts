const rpcUrl = (process.env.NEXT_ETHERS_RPC_URL ?? "").trim();

export const ETHERS_RPC_URL = rpcUrl;
export const HAS_ETHERS_RPC_CONFIG = rpcUrl.length > 0;
