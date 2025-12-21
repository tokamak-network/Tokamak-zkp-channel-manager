'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './button';
import { useToast } from './toast';

interface CopyButtonProps {
  text: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showSuccessMessage?: boolean;
}

export function CopyButton({ 
  text, 
  label = 'Copy', 
  variant = 'ghost', 
  size = 'sm',
  className = '',
  showSuccessMessage = true
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      
      if (showSuccessMessage) {
        showToast({
          type: 'success',
          title: 'Copied to clipboard!',
          duration: 2000
        });
      }

      // Reset icon after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast({
        type: 'error',
        title: 'Failed to copy',
        message: 'Please try again or copy manually',
        duration: 3000
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={`transition-all ${className}`}
      title={`Copy ${label.toLowerCase()}`}
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
      {label && <span className="ml-1">{label}</span>}
    </Button>
  );
}

interface CopyableTextProps {
  text: string;
  truncate?: boolean;
  maxLength?: number;
  className?: string;
  showCopyButton?: boolean;
}

export function CopyableText({ 
  text, 
  truncate = true, 
  maxLength = 20, 
  className = '',
  showCopyButton = true 
}: CopyableTextProps) {
  const displayText = truncate && text.length > maxLength 
    ? `${text.slice(0, maxLength)}...` 
    : text;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <code className="flex-1 text-sm font-mono break-all bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
        {displayText}
      </code>
      {showCopyButton && (
        <CopyButton 
          text={text} 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
          showSuccessMessage={false}
        />
      )}
    </div>
  );
}