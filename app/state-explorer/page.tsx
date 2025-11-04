'use client';

import React, { useState } from 'react';
import { Layout } from '@/components/Layout';

interface SessionCard {
  id: string;
  name: string;
  participants: number;
  status: 'pending' | 'transacted' | 'rolledUp';
  timeInfo: string;
  timestamp: number; // Unix timestamp in milliseconds
  from?: string;
  fromFull?: string; // Full address for modal display
  to?: string;
  toFull?: string; // Full address for modal display
  amount?: string;
}

// Helper function to format timestamp
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export default function StateExplorerPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'transacted' | 'rolledUp'>('all');
  const [selectedSession, setSelectedSession] = useState<SessionCard | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Generate timestamps relative to a fixed base time (to avoid hydration errors)
  const baseTime = new Date('2025-11-04T15:40:00').getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;

  const sessions: SessionCard[] = [
    // Active dummy data - one per status for testing
    { 
      id: '1', 
      name: 'STATE #7', 
      participants: 10, 
      status: 'pending', 
      timeInfo: '00:05:15', 
      timestamp: baseTime - 5 * minute,
      from: '0xF9Ab...3bc7',
      fromFull: '0xF9Ab8c7d5e6f4a3b2c1d0e9f8a7b6c5d4e3f2a1b3bc7',
      to: '0x742d...4e89',
      toFull: '0x742d35e8a9b7c6d5e4f3a2b1c0d9e8f7a6b5c4d34e89',
      amount: '0.5 ETH'
    },
    { 
      id: '2', 
      name: 'TRANSACTION #8', 
      participants: 8, 
      status: 'transacted', 
      timeInfo: '01:02:22', 
      timestamp: baseTime - 62 * minute,
      from: '0x1234...5678',
      fromFull: '0x1234567890abcdef1234567890abcdef12345678',
      to: '0x9abc...def0',
      toFull: '0x9abcdef0123456789abcdef0123456789abcdef0',
      amount: '1.2 ETH'
    },
    { 
      id: '3', 
      name: 'BATCH #9', 
      participants: 12, 
      status: 'rolledUp', 
      timeInfo: '2 hours ago', 
      timestamp: baseTime - 2 * hour,
      from: '0xabcd...ef12',
      fromFull: '0xabcdef1234567890abcdef1234567890abcdef12',
      to: '0x3456...7890',
      toFull: '0x3456789abcdef0123456789abcdef0123456789',
      amount: '0.8 ETH'
    },

    // Commented out for later restoration - full 30 items dataset
    // { id: '4', name: 'Secret Hub #10', participants: 15, status: 'rolledUp', timeInfo: '3 hours ago', timestamp: baseTime - 3 * hour },
    // { id: '5', name: 'Secret Hub #11', participants: 6, status: 'pending', timeInfo: '00:15:30', timestamp: baseTime - 15 * minute },
    // { id: '6', name: 'Secret Hub #12', participants: 9, status: 'transacted', timeInfo: '02:10:45', timestamp: baseTime - 130 * minute },
    // { id: '7', name: 'Secret Hub #13', participants: 11, status: 'pending', timeInfo: '00:30:12', timestamp: baseTime - 30 * minute },
    // { id: '8', name: 'Secret Hub #14', participants: 7, status: 'rolledUp', timeInfo: '1 hour ago', timestamp: baseTime - 1 * hour },
    // { id: '9', name: 'Secret Hub #15', participants: 14, status: 'transacted', timeInfo: '01:55:33', timestamp: baseTime - 115 * minute },
    // { id: '10', name: 'Secret Hub #16', participants: 10, status: 'rolledUp', timeInfo: '4 hours ago', timestamp: baseTime - 4 * hour },
    // { id: '11', name: 'Secret Hub #17', participants: 13, status: 'transacted', timeInfo: '00:20:15', timestamp: baseTime - 20 * minute },
    // { id: '12', name: 'Secret Hub #18', participants: 5, status: 'pending', timeInfo: '00:08:45', timestamp: baseTime - 8 * minute },
    // { id: '13', name: 'Secret Hub #19', participants: 16, status: 'transacted', timeInfo: '03:25:10', timestamp: baseTime - 205 * minute },
    // { id: '14', name: 'Secret Hub #20', participants: 8, status: 'rolledUp', timeInfo: '5 hours ago', timestamp: baseTime - 5 * hour },
    // { id: '15', name: 'Secret Hub #21', participants: 12, status: 'pending', timeInfo: '00:42:20', timestamp: baseTime - 42 * minute },
    // { id: '16', name: 'Secret Hub #22', participants: 9, status: 'transacted', timeInfo: '01:30:55', timestamp: baseTime - 90 * minute },
    // { id: '17', name: 'Secret Hub #23', participants: 11, status: 'rolledUp', timeInfo: '6 hours ago', timestamp: baseTime - 6 * hour },
    // { id: '18', name: 'Secret Hub #24', participants: 7, status: 'transacted', timeInfo: '00:18:40', timestamp: baseTime - 18 * minute },
    // { id: '19', name: 'Secret Hub #25', participants: 15, status: 'pending', timeInfo: '00:55:25', timestamp: baseTime - 55 * minute },
    // { id: '20', name: 'Secret Hub #26', participants: 10, status: 'rolledUp', timeInfo: '7 hours ago', timestamp: baseTime - 7 * hour },
    // { id: '21', name: 'Secret Hub #27', participants: 6, status: 'transacted', timeInfo: '02:40:12', timestamp: baseTime - 160 * minute },
    // { id: '22', name: 'Secret Hub #28', participants: 14, status: 'pending', timeInfo: '00:12:50', timestamp: baseTime - 12 * minute },
    // { id: '23', name: 'Secret Hub #29', participants: 13, status: 'transacted', timeInfo: '01:15:33', timestamp: baseTime - 75 * minute },
    // { id: '24', name: 'Secret Hub #30', participants: 8, status: 'rolledUp', timeInfo: '8 hours ago', timestamp: baseTime - 8 * hour },
    // { id: '25', name: 'Secret Hub #31', participants: 11, status: 'transacted', timeInfo: '00:35:18', timestamp: baseTime - 35 * minute },
    // { id: '26', name: 'Secret Hub #32', participants: 9, status: 'pending', timeInfo: '00:25:42', timestamp: baseTime - 25 * minute },
    // { id: '27', name: 'Secret Hub #33', participants: 12, status: 'rolledUp', timeInfo: '9 hours ago', timestamp: baseTime - 9 * hour },
    // { id: '28', name: 'Secret Hub #34', participants: 7, status: 'transacted', timeInfo: '01:48:27', timestamp: baseTime - 108 * minute },
    // { id: '29', name: 'Secret Hub #35', participants: 16, status: 'pending', timeInfo: '00:05:15', timestamp: baseTime - 5 * minute },
    // { id: '30', name: 'Secret Hub #36', participants: 10, status: 'transacted', timeInfo: '02:22:50', timestamp: baseTime - 142 * minute },
  ];

  // Filter sessions based on active filter
  const filteredSessions = sessions
    .filter(session => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'pending') return session.status === 'pending';
      if (activeFilter === 'transacted') return session.status === 'transacted';
      if (activeFilter === 'rolledUp') return session.status === 'rolledUp';
      return true;
    })
    .sort((a, b) => {
      if (activeFilter === 'all') {
        // ALL filter: Sort by status priority first, then by timestamp
        const statusPriority = {
          pending: 1,
          transacted: 2,
          rolledUp: 3
        };
        
        const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
        
        // If same status, sort by timestamp (newest first)
        if (priorityDiff === 0) {
          return b.timestamp - a.timestamp;
        }
        
        return priorityDiff;
      } else {
        // For specific filters: Sort by timestamp only (newest first)
        return b.timestamp - a.timestamp;
      }
    });

  return (
    <>
    <Layout mainClassName="!p-0 !pt-0">
      {/* 3D Perspective Grid - Fixed to viewport */}
      <div className="perspective-grid">
        <div className="grid-plane"></div>
      </div>

      <div className="min-h-screen relative overflow-hidden">
      {/* Main Content */}
      <div className="relative z-10 pt-6 px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-12">
            <div className="space-y-3">
              <h1 
                className="text-2xl font-normal tracking-wider text-[#FFFF00] pixel-font neon-glow-yellow"
                style={{
                  textTransform: 'uppercase'
                }}
              >
                STATE EXPLORER
              </h1>
              <p className="text-[#00FFFF] font-mono text-xs tracking-tight">
                Track L2 state channel transitions and rollup status.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div 
            className="bg-[#1A1A2E] p-6 mb-12 relative border-2 border-[#00FFFF] neon-border-cyan"
            style={{ 
              clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)'
            }}
          >
            <div className="grid grid-cols-4 gap-10">
              {[
                { label: 'Created', value: '2', icon: '✦', color: '#FFA500', isTime: false },
                { label: 'Transacted', value: '2', icon: '✎', color: '#FF00FF', isTime: false },
                { label: 'Rolled Up', value: '2', icon: '⇧', color: '#00FFFF', isTime: false },
                { label: 'Last Rollup', value: '2h ago', icon: '◷', color: '#FFA500', isTime: true }
              ].map((stat, index) => (
                <div key={index} className="flex gap-5 pl-4">
                  <div 
                    className="text-4xl"
                    style={{ 
                      color: stat.color,
                      textShadow: `0 0 10px ${stat.color}, 0 0 20px ${stat.color}`
                    }}
                  >
                    {stat.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[#00FFFF] font-mono font-semibold text-xs">
                      {stat.label}
                    </span>
                    <span 
                      className={`tracking-wider pixel-font ${stat.isTime ? 'text-lg' : 'text-2xl'}`}
                      style={{ 
                        color: stat.color,
                        textShadow: `0 0 10px ${stat.color}, 0 0 20px ${stat.color}`
                      }}
                    >
                      {stat.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter Buttons and Sessions */}
          <div className="space-y-5">
            {/* Filter Buttons */}
            <div className="flex items-center gap-3">
                {[
                  { label: 'ALL', value: 'all', color: '#FFFF00' },
                  { label: 'Pending', value: 'pending', color: '#FFA500' },
                  { label: 'Transacted', value: 'transacted', color: '#FF00FF' },
                  { label: 'Rolled Up', value: 'rolledUp', color: '#00FFFF' }
                ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value as any)}
                  className={`h-10 px-6 border-2 transition-all pixel-font text-xs ${
                    activeFilter === filter.value
                      ? 'bg-[#1A1A2E] hover:translate-x-[-2px] hover:translate-y-[-2px]'
                      : 'bg-black hover:bg-[#1A1A2E]'
                  }`}
                  style={{ 
                    clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                    borderColor: activeFilter === filter.value ? filter.color : '#00FFFF',
                    color: activeFilter === filter.value ? filter.color : '#00FFFF',
                    boxShadow: activeFilter === filter.value 
                      ? `0 0 10px ${filter.color}, 0 0 20px ${filter.color}, inset 0 0 5px ${filter.color}30`
                      : 'none'
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Session Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSessions.map((session, index) => (
                <SessionCard 
                  key={`${session.id}-${index}`} 
                  session={session}
                  onShowDetail={(session) => {
                    setSelectedSession(session);
                    setShowDetailModal(true);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </Layout>

    {/* State Detail Modal */}
    {showDetailModal && selectedSession && (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
        <div 
          className="bg-[#1A1A2E] border-2 border-[#FFA500] p-8 max-w-2xl w-full"
          style={{ 
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
            boxShadow: '0 0 20px #FFA500, 0 0 40px #FFA500'
          }}
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h3 className="text-[#FFA500] pixel-font text-xl neon-glow-orange">
                STATE DETAIL
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-[#808080] hover:text-[#FF00FF] transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Session Info */}
            <div className="bg-black border-2 border-[#00FFFF] p-4"
                 style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#00FFFF] font-mono text-sm">Session Name:</span>
                  <span className="text-[#FFFF00] pixel-font text-sm">{selectedSession.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#00FFFF] font-mono text-sm">Status:</span>
                  <span className="text-[#FFA500] font-mono text-sm">Pending</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#00FFFF] font-mono text-sm">Participants:</span>
                  <span className="text-[#FFFF00] font-mono text-sm">{selectedSession.participants}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#00FFFF] font-mono text-sm">Created:</span>
                  <span className="text-[#FFFF00] font-mono text-sm">{formatTimestamp(selectedSession.timestamp)}</span>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div>
              <h4 className="text-[#00FFFF] arcade-font text-sm mb-3">TRANSACTION DETAILS</h4>
              <div className="space-y-3">
                {/* From Address */}
                <div className="bg-black border-2 border-[#00FFFF] p-4"
                     style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#00FFFF] text-xl">↓</span>
                      <p className="text-[#00FFFF] font-mono text-xs font-semibold">FROM</p>
                    </div>
                    <p className="text-[#FFFF00] font-mono text-sm pl-7 break-all">
                      {selectedSession.fromFull || selectedSession.from || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* To Address */}
                <div className="bg-black border-2 border-[#00FFFF] p-4"
                     style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#00FFFF] text-xl">↑</span>
                      <p className="text-[#00FFFF] font-mono text-xs font-semibold">TO</p>
                    </div>
                    <p className="text-[#FFFF00] font-mono text-sm pl-7 break-all">
                      {selectedSession.toFull || selectedSession.to || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-black border-2 border-[#FFA500] p-4"
                     style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[#FFA500] text-xl">◆</span>
                      <p className="text-[#00FFFF] font-mono text-xs font-semibold">AMOUNT</p>
                    </div>
                    <p className="text-[#FFA500] pixel-font text-lg neon-glow-orange">
                      {selectedSession.amount || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowDetailModal(false)}
              className="w-full h-12 bg-black border-2 border-[#00FFFF] text-[#00FFFF] pixel-font text-xs hover:bg-[#1A1A2E] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px]"
              style={{ 
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                boxShadow: '0 0 10px #00FFFF40'
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function SessionCard({ 
  session,
  onShowDetail
}: { 
  session: SessionCard;
  onShowDetail: (session: SessionCard) => void;
}) {
  const isPending = session.status === 'pending';
  const isTransacted = session.status === 'transacted';
  const isRolledUp = session.status === 'rolledUp';

  const getBorderColor = () => {
    if (isPending) return 'border-[#FFA500] neon-border-orange';
    if (isTransacted) return 'border-[#FF00FF] neon-border-pink';
    if (isRolledUp) return 'border-[#00FFFF] neon-border-cyan';
    return 'border-[#00FFFF]';
  };

  const getTitleColor = () => {
    if (isPending) return 'text-[#FFA500]' + ' ' + 'neon-glow-orange';
    if (isTransacted) return 'text-[#FF00FF] neon-glow-pink';
    if (isRolledUp) return 'text-[#00FFFF] neon-glow-cyan';
    return 'text-[#FFFF00]';
  };

  const getStatusLabel = () => {
    if (isPending) return 'Changed';
    if (isTransacted) return 'Tx Created';
    if (isRolledUp) return 'Rolled Up';
    return 'Unknown';
  };

  const getValueColor = () => {
    if (isPending) return 'text-[#FFA500]'; // Orange
    if (isTransacted) return 'text-[#FF00FF]'; // Pink
    if (isRolledUp) return 'text-[#00FFFF]'; // Cyan
    return 'text-[#FFFF00]';
  };

  return (
    <div 
      className={`p-6 relative border-2 bg-[#1A1A2E] ${getBorderColor()}`}
      style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
    >
      <div className="space-y-4">
        {/* Session Info */}
        <div className="space-y-2">
          <h3 className={`text-lg pixel-font ${getTitleColor()}`}>
            {session.name}
          </h3>
          <div className="flex justify-between items-center text-xs font-mono">
            <div className="space-y-0 leading-6">
              <p className="text-[#00FFFF]">Participants</p>
              <p className="text-[#00FFFF]">{getStatusLabel()}</p>
            </div>
            <div className="space-y-0 leading-6 text-right">
              <p className={`${getValueColor()} font-semibold`}>{session.participants}</p>
              <p className={`${getValueColor()} font-semibold`}>
                {formatTimestamp(session.timestamp)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {isRolledUp ? (
            <ActionButton 
              variant="detail" 
              label="Detail" 
              onClick={() => onShowDetail(session)}
            />
          ) : isPending ? (
            <>
              <ActionButton variant="orange" label="Verify" />
              <ActionButton 
                variant="detail" 
                label="Detail" 
                onClick={() => onShowDetail(session)}
              />
            </>
          ) : (
            <ActionButton 
              variant="detail" 
              label="Detail" 
              onClick={() => onShowDetail(session)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ 
  variant, 
  label,
  onClick
}: { 
  variant: 'primary' | 'secondary' | 'purple' | 'orange' | 'gray' | 'detail';
  label: string;
  onClick?: () => void;
}) {
  const styles = {
    primary: {
      bg: 'bg-black',
      border: 'border-[#00FFFF]',
      text: 'text-[#00FFFF]',
      hover: 'hover:bg-[#1A1A2E] hover:neon-border-cyan'
    },
    secondary: {
      bg: 'bg-black',
      border: 'border-[#FF00FF]',
      text: 'text-[#FF00FF]',
      hover: 'hover:bg-[#1A1A2E] hover:neon-border-pink'
    },
    purple: {
      bg: 'bg-black',
      border: 'border-[#FF00FF]',
      text: 'text-[#FF00FF]',
      hover: 'hover:bg-[#1A1A2E] hover:neon-border-pink'
    },
    orange: {
      bg: 'bg-black',
      border: 'border-[#FFA500]',
      text: 'text-[#FFA500]',
      hover: 'hover:bg-[#1A1A2E]'
    },
    gray: {
      bg: 'bg-black',
      border: 'border-[#808080]',
      text: 'text-[#808080]',
      hover: 'hover:bg-[#1A1A2E]'
    },
    detail: {
      bg: 'bg-black',
      border: 'border-[#00FF88]',
      text: 'text-[#00FF88]',
      hover: 'hover:bg-[#1A1A2E] hover:neon-border-green'
    }
  };

  const style = styles[variant];

  return (
    <button 
      onClick={onClick}
      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
      className={`flex-1 h-10 border-2 font-mono font-medium text-xs transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${style.bg} ${style.border} ${style.text} ${style.hover}`}
    >
      {label}
    </button>
  );
}

