'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function UIDManagement() {
  const [uidMappings, setUidMappings] = useState<Record<string, number>>({});
  const [nextUid, setNextUid] = useState<number>(1);

  // Load UID mappings from localStorage
  useEffect(() => {
    const mapping = localStorage.getItem('dkg-pubkey-uid-mapping');
    const currentUid = localStorage.getItem('dkg-next-uid');
    
    if (mapping) {
      try {
        setUidMappings(JSON.parse(mapping));
      } catch (error) {
        console.error('Failed to parse UID mappings:', error);
      }
    }
    
    if (currentUid) {
      setNextUid(parseInt(currentUid));
    }
  }, []);

  const clearAllMappings = () => {
    if (confirm('Are you sure you want to clear all UID mappings? This will reset all public key assignments.')) {
      localStorage.removeItem('dkg-pubkey-uid-mapping');
      localStorage.removeItem('dkg-next-uid');
      setUidMappings({});
      setNextUid(1);
    }
  };

  const removeSingleMapping = (publicKey: string) => {
    if (confirm(`Remove UID mapping for public key ${publicKey.slice(0, 10)}...?`)) {
      const newMappings = { ...uidMappings };
      delete newMappings[publicKey];
      
      localStorage.setItem('dkg-pubkey-uid-mapping', JSON.stringify(newMappings));
      setUidMappings(newMappings);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const mappingEntries = Object.entries(uidMappings);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">UID Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage public key to UID mappings for DKG sessions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            Next UID: {nextUid}
          </Badge>
          <Button
            variant="outline"
            onClick={clearAllMappings}
            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            disabled={mappingEntries.length === 0}
          >
            Clear All Mappings
          </Button>
        </div>
      </div>

      {mappingEntries.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🆔</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No UID Mappings Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            UID mappings will appear here when you add participants to DKG sessions
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg max-w-md mx-auto">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">How it works:</h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p>• Each public key gets assigned a unique UID</p>
              <p>• Same public key = same UID across all sessions</p>
              <p>• Prevents server conflicts when reusing participants</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Registered Public Keys ({mappingEntries.length})
            </h3>
          </div>
          
          <div className="space-y-3">
            {mappingEntries.map(([publicKey, uid]) => (
              <div key={publicKey} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        UID: {uid}
                      </Badge>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Assigned: {new Date().toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400 truncate">
                        {publicKey}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(publicKey)}
                        className="px-2 py-1 text-xs"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeSingleMapping(publicKey)}
                    className="ml-4 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Statistics */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {mappingEntries.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Public Keys
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {nextUid - 1}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                UIDs Assigned
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {nextUid}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Next Available UID
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}