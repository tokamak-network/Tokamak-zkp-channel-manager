'use client';

interface MobileMenuButtonProps {
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;
}

export function MobileMenuButton({ showMobileMenu, setShowMobileMenu }: MobileMenuButtonProps) {
  return (
    <button
      onClick={() => setShowMobileMenu(!showMobileMenu)}
      className="xl:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
      aria-label="Navigation menu"
    >
      <div className="flex flex-col gap-1">
        <span className={`block w-5 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-300 ${showMobileMenu ? 'rotate-45 translate-y-1.5' : ''}`}></span>
        <span className={`block w-5 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-300 ${showMobileMenu ? 'opacity-0' : ''}`}></span>
        <span className={`block w-5 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-300 ${showMobileMenu ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
      </div>
    </button>
  );
}