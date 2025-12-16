'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatFrostId } from '@/lib/utils';
import { decompressPublicKey, isCompressedKey } from '@/lib/key-utils';
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Key, 
  Users, 
  Shield, 
  CheckCircle2,
  Clock,
  Hash,
  Lock
} from 'lucide-react';

interface DKGSession {
  id: string;
  creator: string;
  minSigners: number;
  maxSigners: number;
  currentParticipants: number;
  status: 'waiting' | 'round1' | 'round2' | 'finalizing' | 'completed' | 'failed';
  groupId: string;
  topic: string;
  createdAt: Date;
  myRole?: 'creator' | 'participant';
  description?: string;
  participants: any[];
  roster: Array<[number, string, string]>;
  groupVerifyingKey?: string;
  automationMode?: 'manual' | 'automatic';
}

interface DKGSessionInfoProps {
  session: DKGSession;
  myFrostId?: string;
  authState: {
    publicKeyHex: string | null;
    dkgPrivateKey: string | null;
  };
}

export function DKGSessionInfo({ session, myFrostId, authState }: DKGSessionInfoProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'round1': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'round2': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'finalizing': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'completed': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'failed': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  // Try to get key package from localStorage
  const keyPackageData = typeof window !== 'undefined' 
    ? localStorage.getItem(`dkg_key_package_${session.id}`)
    : null;
  const keyPackage = keyPackageData ? JSON.parse(keyPackageData) : null;

  return (
    <Card className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/50">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer border-b border-[#4fc3f7]/30"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Key className="w-5 h-5 text-[#4fc3f7]" />
          <div>
            <h3 className="font-semibold text-white">Session Information</h3>
            <p className="text-xs text-gray-400">Real DKG values and cryptographic data</p>
          </div>
        </div>
        <Button variant="ghost" size="sm">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Session Basics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#4fc3f7]" />
              <span className="text-sm font-medium text-gray-300">Session ID:</span>
            </div>
            <div className="bg-[#0a1930] p-3 rounded border border-[#4fc3f7]/30 flex items-center justify-between">
              <code className="text-xs text-[#4fc3f7] break-all">{session.id}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(session.id, 'sessionId')}
                className="ml-2"
              >
                {copiedField === 'sessionId' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Status & Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a1930]/50 p-3 rounded border border-[#4fc3f7]/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-[#4fc3f7]" />
                <span className="text-xs text-gray-400">Threshold</span>
              </div>
              <p className="text-lg font-semibold text-white">
                {session.minSigners || 0}-of-{session.maxSigners || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {session.minSigners || 0} signatures required
              </p>
            </div>

            <div className="bg-[#0a1930]/50 p-3 rounded border border-[#4fc3f7]/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[#4fc3f7]" />
                <span className="text-xs text-gray-400">Status</span>
              </div>
              <Badge className={getStatusColor(session.status)}>
                {session.status.toUpperCase()}
              </Badge>
              <p className="text-xs text-gray-400 mt-1">
                Created: {isMounted ? new Date(session.createdAt).toISOString().replace('T', ' ').slice(0, 19) : '-'}
              </p>
            </div>
          </div>

          {/* My FROST ID */}
          {myFrostId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-gray-300">My FROST Identifier:</span>
              </div>
              <div className="bg-green-900/20 p-3 rounded border border-green-500/30 flex items-center justify-between">
                <code className="text-xs text-green-300 break-all">{formatFrostId(myFrostId)}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(myFrostId, 'frostId')}
                  className="ml-2"
                >
                  {copiedField === 'frostId' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-green-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                This is your unique identifier in the DKG ceremony
              </p>
            </div>
          )}

          {/* My ECDSA Keys */}
          {authState.publicKeyHex && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#4fc3f7]" />
                <span className="text-sm font-medium text-gray-300">My ECDSA Public Key:</span>
              </div>
              <div className="bg-[#0a1930] p-3 rounded border border-[#4fc3f7]/30 flex items-center justify-between">
                <code className="text-xs text-[#4fc3f7] break-all">{authState.publicKeyHex}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(authState.publicKeyHex!, 'publicKey')}
                  className="ml-2"
                >
                  {copiedField === 'publicKey' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                33-byte compressed SEC1 format (used for encryption & authentication)
              </p>
            </div>
          )}

          {/* Roster */}
          {session.roster && session.roster.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4fc3f7]" />
                <span className="text-sm font-medium text-gray-300">Participant Roster:</span>
              </div>
              <div className="bg-[#0a1930]/50 rounded border border-[#4fc3f7]/20 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#0a1930]">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-400">UID</th>
                      <th className="px-3 py-2 text-left text-gray-400">FROST ID</th>
                      <th className="px-3 py-2 text-left text-gray-400">ECDSA Public Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.roster.map(([uid, frostId, ecdsaPub], idx) => {
                      // Normalize ecdsaPub in case it's an object
                      const normalizedPubKey = typeof ecdsaPub === 'string' 
                        ? ecdsaPub 
                        : (ecdsaPub as any)?.key || String(ecdsaPub);
                      
                      return (
                        <tr 
                          key={uid} 
                          className={`${idx % 2 === 0 ? 'bg-[#0a1930]/30' : 'bg-transparent'} ${
                            frostId === myFrostId ? 'border-l-2 border-green-500' : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-white font-medium">
                            {uid}
                            {frostId === myFrostId && (
                              <Badge className="ml-2 bg-green-500/20 text-green-300 text-[10px]">
                                YOU
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <code className="text-[#4fc3f7]">{formatFrostId(frostId)}</code>
                          </td>
                          <td className="px-3 py-2">
                            <code className="text-gray-300">{formatAddress(normalizedPubKey)}</code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Group Verifying Key (if completed) */}
          {session.groupVerifyingKey && (() => {
            const decompressed = isCompressedKey(session.groupVerifyingKey) 
              ? decompressPublicKey(session.groupVerifyingKey) 
              : null;
              
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-gray-300">
                    Group Verification Key (Uncompressed):
                  </span>
                </div>
                {decompressed ? (
                  // Display decompressed px and py
                  <div className="space-y-2">
                    <div className="bg-green-900/20 p-2 rounded border border-green-500/30">
                      <div className="text-xs text-gray-400 mb-1">px:</div>
                      <div className="flex items-center justify-between">
                        <code className="text-xs text-green-300 break-all">0x{decompressed.px}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard('0x' + decompressed.px, 'px')}
                          className="ml-2"
                        >
                          {copiedField === 'px' ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="bg-green-900/20 p-2 rounded border border-green-500/30">
                      <div className="text-xs text-gray-400 mb-1">py:</div>
                      <div className="flex items-center justify-between">
                        <code className="text-xs text-green-300 break-all">0x{decompressed.py}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard('0x' + decompressed.py, 'py')}
                          className="ml-2"
                        >
                          {copiedField === 'py' ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : session.groupVerifyingKey.startsWith('04') ? (
                  // Already uncompressed - extract px and py
                  <div className="space-y-2">
                    <div className="bg-green-900/20 p-2 rounded border border-green-500/30">
                      <div className="text-xs text-gray-400 mb-1">px:</div>
                      <div className="flex items-center justify-between">
                        <code className="text-xs text-green-300 break-all">0x{session.groupVerifyingKey!.slice(2, 66)}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard('0x' + session.groupVerifyingKey!.slice(2, 66), 'px')}
                          className="ml-2"
                        >
                          {copiedField === 'px' ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="bg-green-900/20 p-2 rounded border border-green-500/30">
                      <div className="text-xs text-gray-400 mb-1">py:</div>
                      <div className="flex items-center justify-between">
                        <code className="text-xs text-green-300 break-all">0x{session.groupVerifyingKey!.slice(66)}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard('0x' + session.groupVerifyingKey!.slice(66), 'py')}
                          className="ml-2"
                        >
                          {copiedField === 'py' ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Fallback - show raw key
                  <div className="bg-green-900/20 p-3 rounded border border-green-500/30 flex items-center justify-between">
                    <code className="text-xs text-green-300 break-all">{session.groupVerifyingKey}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(session.groupVerifyingKey!, 'groupKey')}
                      className="ml-2"
                    >
                      {copiedField === 'groupKey' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-green-400" />
                      )}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  This key can verify threshold signatures from your group
                </p>
              </div>
            );
          })()}

          {/* Key Package (if saved) */}
          {keyPackage && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-gray-300">My Key Package (Secret):</span>
              </div>
              <div className="bg-purple-900/20 p-3 rounded border border-purple-500/30">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Package Length:</span>
                    <p className="text-purple-300 font-mono">{keyPackage.key_package_hex.length / 2} bytes</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Timestamp:</span>
                    <p className="text-purple-300 font-mono">
                      {isMounted ? new Date(keyPackage.timestamp).toISOString().slice(11, 19) : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Threshold:</span>
                    <p className="text-purple-300 font-mono">{keyPackage.threshold || 0}-of-{keyPackage.total || 0}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Group ID:</span>
                    <p className="text-purple-300 font-mono">{keyPackage.group_id}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-purple-500/30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(keyPackage.key_package_hex, 'keyPackage')}
                    className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                  >
                    {copiedField === 'keyPackage' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Key Package (for signing)
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Keep this secret! Use this to sign threshold signatures
              </p>
            </div>
          )}

          {/* Progress Indicators */}
          <div className="bg-[#0a1930]/50 p-3 rounded border border-[#4fc3f7]/20">
            <div className="text-xs text-gray-400 mb-2">Ceremony Progress:</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {session.status !== 'waiting' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
                )}
                <span className="text-sm text-gray-300">
                  Round 1: Commitments {session.status !== 'waiting' && '✓'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {['round2', 'finalizing', 'completed'].includes(session.status) ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
                )}
                <span className="text-sm text-gray-300">
                  Round 2: Secret Shares {['round2', 'finalizing', 'completed'].includes(session.status) && '✓'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {session.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
                )}
                <span className="text-sm text-gray-300">
                  Finalization {session.status === 'completed' && '✓'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

