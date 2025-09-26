'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { MobileMenuButton } from '@/components/MobileMenuButton';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showMobileMenu?: boolean;
  setShowMobileMenu?: (show: boolean) => void;
  showTitle?: boolean;
  className?: string;
}

export function Header({ 
  title = "Tokamak ZK-Rollup Manager",
  subtitle = "Zero-Knowledge Rollup Manager",
  showMobileMenu = false,
  setShowMobileMenu,
  showTitle = true,
  className = ""
}: HeaderProps) {
  return (
    <header className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300 ${className}`}>
      <div className="px-4 py-4 lg:px-6">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          {showTitle && (
            <div className="hidden lg:flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                <span className="text-white font-bold text-lg">ZK</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">{title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
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

            {/* Dark Mode Toggle */}
            <ClientOnly>
              <DarkModeToggle />
            </ClientOnly>
            
            {/* RainbowKit Connect Button */}
            <ClientOnly>
              <ConnectButton />
            </ClientOnly>
          </div>
        </div>
      </div>
    </header>
  );
}