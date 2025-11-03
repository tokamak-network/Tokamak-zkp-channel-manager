'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileMenuButton } from '@/components/MobileMenuButton';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showMobileMenu?: boolean;
  setShowMobileMenu?: (show: boolean) => void;
  showTitle?: boolean;
  className?: string;
  sidebarCollapsed?: boolean;
  showSidebar?: boolean;
}

export function Header({ 
  title = "Tokamak",
  subtitle = "ZKP Channel Manager",
  showMobileMenu = false,
  setShowMobileMenu,
  showTitle = true,
  className = "",
  sidebarCollapsed = false,
  showSidebar = true
}: HeaderProps) {
  const leftOffset = showSidebar ? (sidebarCollapsed ? 'lg:left-16' : 'lg:left-64') : 'left-0';
  
  return (
    <header className={`bg-black border-b-2 border-[#00FFFF] absolute top-0 left-0 ${leftOffset} right-0 z-40 m-0 transition-all duration-300 ${className}`}>
      {/* Neon glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00FFFF] to-transparent neon-border-cyan"></div>
      
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          {showTitle && (
            <div className="flex items-center gap-3">
              {/* Tokamak Logo - Pac-Man Style */}
              <div className="flex items-center gap-3">
                {/* Neon Logo Box */}
                <div 
                  className="w-10 h-10 bg-black border-2 border-[#FFFF00] relative neon-border-yellow"
                  style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[#FFFF00] font-bold text-xl pixel-font neon-glow-yellow">ZK</span>
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold pixel-font tracking-wider">
                    <span className="text-[#FFFF00] neon-glow-yellow">{title} ZKP</span>{' '}
                    <span className="text-[#00FFFF] neon-glow-cyan">Channel Manager</span>
                  </h1>
                </div>
              </div>
            </div>
          )}
          
          {/* Right side controls */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Mobile Navigation Menu Button */}
            {setShowMobileMenu && (
              <MobileMenuButton 
                showMobileMenu={showMobileMenu} 
                setShowMobileMenu={setShowMobileMenu} 
              />
            )}
            
            {/* RainbowKit Connect Button with Pac-Man styling */}
            <ClientOnly>
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  mounted,
                }) => {
                  const ready = mounted;
                  const connected = ready && account && chain;

                  return (
                    <div
                      {...(!ready && {
                        'aria-hidden': true,
                        'style': {
                          opacity: 0,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        },
                      })}
                      className="flex items-center gap-3"
                    >
                      {(() => {
                        if (!connected) {
                          return (
                            <button
                              onClick={openConnectModal}
                              type="button"
                              className="h-10 px-6 bg-black border-2 border-[#FFFF00] text-[#FFFF00] hover:bg-[#1A1A2E] hover:border-[#00FFFF] hover:text-[#00FFFF] transition-all pixel-font text-base neon-border-yellow hover:neon-border-cyan"
                              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                            >
                              CONNECT WALLET
                            </button>
                          );
                        }

                        if (chain.unsupported) {
                          return (
                            <button
                              onClick={openChainModal}
                              type="button"
                              className="h-10 px-6 bg-black border-2 border-[#FF00FF] text-[#FF00FF] hover:bg-[#1A1A2E] transition-all pixel-font text-base neon-border-pink"
                              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                            >
                              WRONG NETWORK
                            </button>
                          );
                        }

                        return (
                          <div className="flex items-center gap-3">
                            {/* Chain Selector */}
                            <button
                              onClick={openChainModal}
                              type="button"
                              className="h-10 px-4 bg-black border-2 border-[#00FFFF] text-[#00FFFF] hover:bg-[#1A1A2E] hover:border-[#FFFF00] transition-all flex items-center gap-2 neon-border-cyan hover:neon-border-yellow"
                              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                            >
                              {chain.hasIcon && (
                                <div
                                  className="w-5 h-5 rounded-full overflow-hidden"
                                  style={{
                                    background: chain.iconBackground,
                                  }}
                                >
                                  {chain.iconUrl && (
                                    <img
                                      alt={chain.name ?? 'Chain icon'}
                                      src={chain.iconUrl}
                                      className="w-5 h-5"
                                    />
                                  )}
                                </div>
                              )}
                              <span className="font-mono font-semibold text-sm">{chain.name}</span>
                            </button>

                            {/* Account Button */}
                            <button
                              onClick={openAccountModal}
                              type="button"
                              className="h-10 px-4 bg-black border-2 border-[#FFFF00] text-[#FFFF00] hover:bg-[#1A1A2E] hover:border-[#FF00FF] transition-all flex items-center gap-2 neon-border-yellow hover:neon-border-pink"
                              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                            >
                              <span className="font-mono font-semibold text-sm">
                                {account.displayBalance
                                  ? ` ${account.displayBalance}`
                                  : ''}
                              </span>
                              <span className="font-mono font-semibold text-sm">
                                {account.displayName}
                              </span>
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </ClientOnly>
          </div>
        </div>
      </div>
    </header>
  );
}