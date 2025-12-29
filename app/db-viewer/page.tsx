"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Database,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ArrowLeft,
} from "lucide-react";

function DbViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channelId");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/db?path=");
      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const copyToClipboard = async (path: string, value: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const deleteData = async (path: string) => {
    if (!confirm(`Are you sure you want to delete data at "${path}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/db?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        fetchData();
      } else {
        alert("Delete failed: " + result.error);
      }
    } catch (err) {
      alert("Delete failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const renderValue = (value: any, path: string, depth: number = 0): JSX.Element => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic">null</span>;
    }

    if (typeof value === "string") {
      // Truncate long strings (like base64)
      if (value.length > 100) {
        return (
          <span className="text-green-400">
            &quot;{value.substring(0, 100)}...&quot;
            <span className="text-gray-500 text-xs ml-2">({value.length} chars)</span>
          </span>
        );
      }
      return <span className="text-green-400">&quot;{value}&quot;</span>;
    }

    if (typeof value === "number") {
      return <span className="text-blue-400">{value}</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-purple-400">{value.toString()}</span>;
    }

    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path);
      return (
        <div>
          <button
            onClick={() => toggleExpand(path)}
            className="inline-flex items-center text-gray-400 hover:text-white"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span className="text-yellow-400">Array</span>
            <span className="text-gray-500 text-xs ml-1">[{value.length}]</span>
          </button>
          {isExpanded && (
            <div className="ml-4 border-l border-gray-700 pl-2">
              {value.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-gray-500">{index}:</span>
                  {renderValue(item, `${path}/${index}`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === "object") {
      const isExpanded = expandedPaths.has(path);
      const keys = Object.keys(value);
      
      return (
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleExpand(path)}
              className="inline-flex items-center text-gray-400 hover:text-white"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-cyan-400">Object</span>
              <span className="text-gray-500 text-xs ml-1">{`{${keys.length}}`}</span>
            </button>
            <button
              onClick={() => copyToClipboard(path, value)}
              className="text-gray-500 hover:text-white p-1"
              title="Copy JSON"
            >
              {copiedPath === path ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
            {path && depth > 0 && (
              <button
                onClick={() => deleteData(path)}
                className="text-gray-500 hover:text-red-400 p-1"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          {isExpanded && (
            <div className="ml-4 border-l border-gray-700 pl-2">
              {keys.map((key) => (
                <div key={key} className="flex items-start gap-2 py-0.5">
                  <span className="text-amber-300 shrink-0">{key}:</span>
                  <div className="flex-1">
                    {renderValue(value[key], path ? `${path}/${key}` : key, depth + 1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="outline"
          className="mb-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30 text-white hover:border-[#4fc3f7] hover:bg-[#1a2347]"
          onClick={() => {
            if (channelId) {
              router.push(`/state-explorer?channelId=${channelId}`);
            } else {
              router.push("/state-explorer");
            }
          }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Explorer
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Local Database Viewer</h1>
          </div>
          <Button
            onClick={fetchData}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="bg-[#0a1628] border border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-4">
            📁 Data file: <code className="bg-gray-800 px-2 py-0.5 rounded">data/local-db.json</code>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
              Error: {error}
            </div>
          )}

          {!loading && !error && data && (
            <div className="font-mono text-sm overflow-x-auto">
              {renderValue(data, "", 0)}
            </div>
          )}

          {!loading && !error && !data && (
            <div className="text-gray-500 text-center py-12">
              Database is empty.
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-500">
          <p>💡 Tip: To view directly in terminal:</p>
          <code className="bg-gray-800 px-2 py-1 rounded block mt-1">
            cat data/local-db.json | jq .
          </code>
        </div>
      </div>
    </Layout>
  );
}

// Wrapper with Suspense for useSearchParams
export default function DbViewerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <DbViewerContent />
    </Suspense>
  );
}
