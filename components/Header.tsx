'use client';

import React from 'react';
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
    <>
      <header className={`absolute top-0 right-0 left-0 lg:left-72 z-40 ${className}`}>
        <div className="px-6 py-6 lg:px-8">
          <div className="flex items-center justify-end lg:hidden">
            {/* Mobile Navigation Menu Button */}
            {setShowMobileMenu && (
              <MobileMenuButton 
                showMobileMenu={showMobileMenu} 
                setShowMobileMenu={setShowMobileMenu} 
              />
            )}
          </div>
        </div>
      </header>
    </>
  );
}