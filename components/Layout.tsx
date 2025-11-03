'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Sidebar } from '@/components/Sidebar';
import { ChannelCreatedBanner } from '@/components/ChannelCreatedBanner';
import { MobileNavigation } from '@/components/MobileNavigation';
import { ClientOnly } from '@/components/ClientOnly';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showSidebar?: boolean;
  showBanner?: boolean;
  showFooter?: boolean;
  showTestnetWarning?: boolean;
  headerClassName?: string;
  footerClassName?: string;
  mainClassName?: string;
}

export function Layout({
  children,
  title,
  subtitle,
  showSidebar = true,
  showBanner = true,
  showFooter = true,
  showTestnetWarning = true,
  headerClassName = "",
  footerClassName = "",
  mainClassName = ""
}: LayoutProps) {
  const { isConnected } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A1A] relative overflow-x-hidden">
      {/* Pac-Man dot pattern overlay */}
      <div className="fixed inset-0 pacman-dots pointer-events-none z-0"></div>
      
      {/* Channel Created Banner */}
      {showBanner && (
        <ClientOnly>
          <ChannelCreatedBanner />
        </ClientOnly>
      )}

      {/* Sidebar - Fixed, independent area */}
      {showSidebar && (
        <ClientOnly>
          <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
        </ClientOnly>
      )}

      {/* Mobile Navigation */}
      {showSidebar && (
        <ClientOnly>
          <MobileNavigation 
            showMobileMenu={showMobileMenu}
            setShowMobileMenu={setShowMobileMenu}
          />
        </ClientOnly>
      )}

      {/* Header - Fixed, independent area */}
      <Header
        title={title}
        subtitle={subtitle}
        showMobileMenu={showMobileMenu}
        setShowMobileMenu={showSidebar ? setShowMobileMenu : undefined}
        className={headerClassName}
        sidebarCollapsed={sidebarCollapsed}
        showSidebar={showSidebar}
      />

      {/* Main Content Area - Flow layout without margins */}
      <div className={`min-h-screen flex flex-col pt-[72px] ${showSidebar ? (sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64') : ''} transition-all duration-300`}>
        {/* Main Content */}
        <main className={`flex-1 px-4 py-8 lg:px-6 ${mainClassName || ''}`}>
          {children}
        </main>

        {/* Footer */}
        {showFooter && (
          <Footer 
            className={`mt-auto ${footerClassName}`}
            showTestnetWarning={showTestnetWarning}
          />
        )}
      </div>
    </div>
  );
}