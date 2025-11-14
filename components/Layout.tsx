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
    <div className="min-h-screen space-background flex flex-col">
      {/* Channel Created Banner */}
      {showBanner && (
        <ClientOnly>
          <ChannelCreatedBanner />
        </ClientOnly>
      )}

      {/* Sidebar */}
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

      {/* Main Content Area */}
      <div className={`ml-0 ${showSidebar ? 'lg:ml-72' : ''} transition-all duration-300 flex flex-col min-h-screen relative`}>
        {/* Header */}
        <Header
          title={title}
          subtitle={subtitle}
          showMobileMenu={showMobileMenu}
          setShowMobileMenu={showSidebar ? setShowMobileMenu : undefined}
          className={headerClassName}
        />

        {/* Main Content */}
        <main className={`flex-1 ${mainClassName}`}>
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