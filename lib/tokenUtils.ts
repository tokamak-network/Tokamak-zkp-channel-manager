// Token utility functions
import { Address } from 'wagmi';

// Token addresses - duplicated here to avoid circular dependency
const TON_TOKEN_ADDRESS: Address = '0xa30fe40285B8f5c0457DbC3B7C8A280373c40044' as Address;
const USDC_TOKEN_ADDRESS: Address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address;
const USDT_TOKEN_ADDRESS: Address = '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A' as Address;
const ETH_TOKEN_ADDRESS: Address = '0x0000000000000000000000000000000000000001' as Address;

// Token symbol mapping helper function
export function getTokenSymbol(tokenAddress: string): string {
  if (!tokenAddress) return 'TOKEN';
  
  switch (tokenAddress.toLowerCase()) {
    case TON_TOKEN_ADDRESS.toLowerCase():
      return 'TON';
    case USDC_TOKEN_ADDRESS.toLowerCase():
      return 'USDC';
    case USDT_TOKEN_ADDRESS.toLowerCase():
      return 'USDT';
    case ETH_TOKEN_ADDRESS.toLowerCase():
      return 'ETH';
    default:
      return 'TOKEN';
  }
}

// Token decimals mapping helper function
export function getTokenDecimals(tokenAddress: string): number {
  if (!tokenAddress) return 18;
  
  switch (tokenAddress.toLowerCase()) {
    case TON_TOKEN_ADDRESS.toLowerCase():
      return 18;
    case USDC_TOKEN_ADDRESS.toLowerCase():
      return 6;
    case USDT_TOKEN_ADDRESS.toLowerCase():
      return 6;
    case ETH_TOKEN_ADDRESS.toLowerCase():
      return 18;
    default:
      return 18;
  }
}