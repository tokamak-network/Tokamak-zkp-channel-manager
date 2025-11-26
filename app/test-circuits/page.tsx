'use client';

import { useState } from 'react';
import { verifyCircuitFiles } from '@/lib/clientProofGeneration';

export default function TestCircuits() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const verification = await verifyCircuitFiles();
      setResults(verification);
      console.log('🔍 Circuit Files Verification:', verification);
    } catch (error) {
      console.error('Error verifying circuits:', error);
      setResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Circuit Files Test</h1>
      
      <div className="mb-6">
        <button
          onClick={handleTest}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test All Circuit Files'}
        </button>
      </div>

      {results && (
        <div className="space-y-4">
          {results.error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              Error: {results.error}
            </div>
          ) : (
            <>
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                ✅ Available circuits: {results.available.join(', ')} leaves
              </div>
              
              {results.missing.length > 0 && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  ❌ Missing circuits: {results.missing.join(', ')} leaves
                </div>
              )}

              <div className="bg-gray-100 p-4 rounded">
                <h3 className="font-bold mb-2">Detailed Results:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(results.details, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}