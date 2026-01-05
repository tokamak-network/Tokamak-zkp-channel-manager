// Token utility functions
import { TON_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, USDT_TOKEN_ADDRESS, ETH_TOKEN_ADDRESS } from './contracts';

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