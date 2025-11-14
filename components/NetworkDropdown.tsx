'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export function NetworkDropdown() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>('sepolia');
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close network dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.network-dropdown-container')) {
        setIsNetworkDropdownOpen(false);
      }
    };

    if (isNetworkDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNetworkDropdownOpen]);

  if (!isMounted) {
    return (
      <div className="bg-[#0a1930] border border-[#4fc3f7]/30 px-3 py-2">
        <div className="text-xs text-gray-400 mb-1">Network</div>
        <div className="text-sm text-white font-medium">Sepolia Testnet</div>
      </div>
    );
  }

  return (
    <div className="relative network-dropdown-container">
      <div className="bg-[#0a1930] border border-[#4fc3f7]/30 px-3 py-2">
        <div className="text-xs text-gray-400 mb-1">Network</div>
        <button
          type="button"
          onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
          className="w-full flex items-center justify-between text-sm text-white font-medium focus:outline-none cursor-pointer"
        >
          <span>
            {selectedNetwork === 'sepolia' && 'Sepolia Testnet'}
            {selectedNetwork === 'mainnet' && 'Ethereum Mainnet'}
            {selectedNetwork === 'goerli' && 'Goerli Testnet'}
          </span>
          <ChevronDown className={`w-4 h-4 text-[#4fc3f7] transition-transform ${isNetworkDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      
      {/* Custom Dropdown Menu */}
      {isNetworkDropdownOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-[#0a1930] border border-[#4fc3f7]/50 shadow-lg shadow-[#4fc3f7]/20 z-50">
          {[
            { value: 'sepolia', label: 'Sepolia Testnet' },
            { value: 'mainnet', label: 'Ethereum Mainnet' },
            { value: 'goerli', label: 'Goerli Testnet' }
          ].map((network) => (
            <button
              key={network.value}
              type="button"
              onClick={() => {
                setSelectedNetwork(network.value);
                setIsNetworkDropdownOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                selectedNetwork === network.value
                  ? 'bg-[#4fc3f7]/20 text-[#4fc3f7] font-medium'
                  : 'text-white hover:bg-[#1a2347] hover:text-[#4fc3f7]'
              }`}
            >
              {network.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

