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
  const leftOffset = showSidebar ? (sidebarCollapsed ? 'xl:left-16' : 'xl:left-64') : 'left-0';
  
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
                    className="w-12 h-12 relative p-2 flash-animation"
                  >
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <img 
                      src="/images/logo/tokamak-logo.svg" 
                      alt="Tokamak Logo"
                      className="w-full h-full"
                      style={{
                        filter: 'drop-shadow(0 0 5px #2A72E5) drop-shadow(0 0 10px #2A72E5) drop-shadow(0 0 15px #2A72E5)'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h1 className="font-bold tracking-wider flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                    <span 
                      className="arcade-font text-lg pulse-glow-animation"
                      style={{ color: '#00FFFF' }}
                    >
                      {title} ZKP
                    </span>
                    <span 
                      className="arcade-font text-base pulse-glow-animation"
                      style={{ color: '#FF00FF' }}
                    >
                      Channel Manager
                    </span>
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
                              style={{ 
                                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                                color: '#FFFF00',
                                borderColor: '#FFFF00'
                              }}
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
                              style={{ 
                                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                                color: '#FF00FF',
                                borderColor: '#FF00FF'
                              }}
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
                              style={{ 
                                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                                color: '#00FFFF',
                                borderColor: '#00FFFF'
                              }}
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
                              <span className="font-mono font-semibold text-sm" style={{ color: '#00FFFF' }}>{chain.name}</span>
                            </button>

                            {/* Account Button */}
                            <button
                              onClick={openAccountModal}
                              type="button"
                              className="h-10 px-4 bg-black border-2 border-[#FFFF00] text-[#FFFF00] hover:bg-[#1A1A2E] hover:border-[#FF00FF] transition-all flex items-center gap-2 neon-border-yellow hover:neon-border-pink"
                              style={{ 
                                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                                color: '#FFFF00',
                                borderColor: '#FFFF00'
                              }}
                            >
                              <span className="font-mono font-semibold text-sm" style={{ color: '#FFFF00' }}>
                                {account.displayBalance
                                  ? ` ${account.displayBalance}`
                                  : ''}
                              </span>
                              <span className="font-mono font-semibold text-sm" style={{ color: '#FFFF00' }}>
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