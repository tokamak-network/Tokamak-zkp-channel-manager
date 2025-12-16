import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUnits, parseUnits } from "ethers";
import { ChannelState, ChannelStateLabels } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format balance for display (removes trailing zeros)
export function formatBalance(
  balance: string | bigint,
  decimals: number = 18,
  maxDecimals: number = 6
): string {
  try {
    const formatted = formatUnits(balance.toString(), decimals);
    const num = parseFloat(formatted);
    
    if (num === 0) return '0';
    
    // For very small numbers, show more precision
    if (num < 0.000001) {
      return num.toExponential(2);
    }
    
    // For regular numbers, limit decimal places
    return num.toFixed(maxDecimals).replace(/\.?0+$/, '');
  } catch {
    return '0';
  }
}

// Parse input amount to BigInt
export function parseInputAmount(amount: string, decimals: number = 18): bigint {
  try {
    if (!amount || amount === '') return BigInt(0);
    return parseUnits(amount, decimals);
  } catch {
    return BigInt(0);
  }
}

// Validate if amount input is valid
export function isValidAmount(amount: string): boolean {
  if (!amount || amount === '' || amount === '0') return false;
  
  try {
    const num = parseFloat(amount);
    return num > 0 && isFinite(num) && !isNaN(num);
  } catch {
    return false;
  }
}

// Format time duration in human readable format
export function formatDuration(seconds: bigint | number): string {
  const secs = typeof seconds === 'bigint' ? Number(seconds) : seconds;
  
  if (secs === 0) return 'Expired';
  
  const days = Math.floor(secs / (24 * 60 * 60));
  const hours = Math.floor((secs % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((secs % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Format timestamp to readable date
export function formatDate(timestamp: bigint | number): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Shorten address for display
export function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Get channel state color class
export function getChannelStateColor(state: ChannelState): string {
  switch (state) {
    case ChannelState.Open:
      return 'status-active';
    case ChannelState.Initialized:
    case ChannelState.Closing:
      return 'status-pending';
    case ChannelState.Closed:
      return 'status-inactive';
    default:
      return 'status-error';
  }
}

// Get channel state label
export function getChannelStateLabel(state: ChannelState): string {
  return ChannelStateLabels[state] || 'Unknown';
}

// Calculate percentage
export function calculatePercentage(part: bigint, total: bigint): number {
  if (total === BigInt(0)) return 0;
  return Number((part * BigInt(100)) / total);
}

// Format large numbers with K, M, B suffixes
export function formatLargeNumber(num: number): string {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  }
  return num.toString();
}

// Validate Ethereum address
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Convert timeout value to seconds
export function timeoutToSeconds(value: number, unit: 'hours' | 'days'): bigint {
  const multiplier = unit === 'hours' ? 3600 : 86400;
  return BigInt(value * multiplier);
}

// Parse and validate participant addresses
export function parseParticipantAddresses(input: string): string[] {
  return input
    .split('\n')
    .map(addr => addr.trim())
    .filter(addr => addr && isValidAddress(addr));
}

// Generate random hex string for testing
export function generateRandomHex(length: number = 64): `0x${string}` {
  const chars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result as `0x${string}`;
}

// Calculate gas estimate multiplier for safety margin
export function calculateGasLimit(estimate: bigint, multiplier: number = 1.2): bigint {
  return BigInt(Math.floor(Number(estimate) * multiplier));
}

// Format token symbol for display
export function formatTokenSymbol(address: string): string {
  // ETH token address from contract
  if (address === '0x0000000000000000000000000000000000000001') {
    return 'ETH';
  }
  return 'ERC20';
}

// Check if channel is in a state where user can deposit
export function canDeposit(state: ChannelState): boolean {
  return state === ChannelState.Initialized;
}

// Check if channel is in a state where leader can initialize
export function canInitialize(state: ChannelState): boolean {
  return state === ChannelState.Initialized || state === ChannelState.Open;
}

// Check if channel is in a state where proof can be submitted
export function canSubmitProof(state: ChannelState): boolean {
  return state === ChannelState.Open;
}

// Check if channel is in a state where it can be closed
export function canClose(state: ChannelState): boolean {
  return state === ChannelState.Closing;
}

// Check if user can withdraw from channel
export function canWithdraw(state: ChannelState): boolean {
  return state === ChannelState.Closed;
}

// Extract error message from contract error
export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  
  if (error?.reason) return error.reason;
  if (error?.message) {
    // Try to extract revert reason from message
    const revertMatch = error.message.match(/reason="([^"]+)"/);
    if (revertMatch) return revertMatch[1];
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

// Debounce function for search/filter inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Sort channels by various criteria
export function sortChannels<T extends { id: bigint; totalDeposits: bigint; participantCount: bigint }>(
  channels: T[],
  sortBy: 'newest' | 'oldest' | 'deposits' | 'participants'
): T[] {
  const sorted = [...channels];
  
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => Number(b.id) - Number(a.id));
    case 'oldest':
      return sorted.sort((a, b) => Number(a.id) - Number(b.id));
    case 'deposits':
      return sorted.sort((a, b) => Number(b.totalDeposits) - Number(a.totalDeposits));
    case 'participants':
      return sorted.sort((a, b) => Number(b.participantCount) - Number(a.participantCount));
    default:
      return sorted;
  }
}

// Format FROST ID for display (removes leading zeros)
export function formatFrostId(frostId: string | null | undefined): string {
  // Handle null/undefined cases
  if (!frostId || frostId.trim() === '') {
    return 'N/A';
  }
  
  // Remove any '0x' prefix if present
  let cleaned = frostId.toLowerCase().replace('0x', '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // If all zeros, return '0'
  if (cleaned === '') {
    return '0';
  }
  
  return cleaned;
}