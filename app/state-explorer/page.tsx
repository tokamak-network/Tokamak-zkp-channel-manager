'use client';

import React, { useState } from 'react';
import { Layout } from '@/components/Layout';

interface SessionCard {
  id: string;
  name: string;
  participants: number;
  status: 'pending' | 'transacted' | 'rolledUp';
  timeInfo: string;
}

export default function StateExplorerPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'transacted' | 'rolledUp'>('all');

  const sessions: SessionCard[] = [
    { id: '1', name: 'Secret Hub #7', participants: 10, status: 'rolledUp', timeInfo: '2 hours ago' },
    { id: '2', name: 'Secret Hub #8', participants: 8, status: 'transacted', timeInfo: '01:02:22' },
    { id: '3', name: 'Secret Hub #9', participants: 12, status: 'transacted', timeInfo: '00:45:18' },
    { id: '4', name: 'Secret Hub #10', participants: 15, status: 'rolledUp', timeInfo: '3 hours ago' },
    { id: '5', name: 'Secret Hub #11', participants: 6, status: 'pending', timeInfo: '00:15:30' },
    { id: '6', name: 'Secret Hub #12', participants: 9, status: 'transacted', timeInfo: '02:10:45' },
    { id: '7', name: 'Secret Hub #13', participants: 11, status: 'pending', timeInfo: '00:30:12' },
    { id: '8', name: 'Secret Hub #14', participants: 7, status: 'rolledUp', timeInfo: '1 hour ago' },
    { id: '9', name: 'Secret Hub #15', participants: 14, status: 'transacted', timeInfo: '01:55:33' },
    { id: '10', name: 'Secret Hub #16', participants: 10, status: 'rolledUp', timeInfo: '4 hours ago' },
    { id: '11', name: 'Secret Hub #17', participants: 13, status: 'transacted', timeInfo: '00:20:15' },
    { id: '12', name: 'Secret Hub #18', participants: 5, status: 'pending', timeInfo: '00:08:45' },
    { id: '13', name: 'Secret Hub #19', participants: 16, status: 'transacted', timeInfo: '03:25:10' },
    { id: '14', name: 'Secret Hub #20', participants: 8, status: 'rolledUp', timeInfo: '5 hours ago' },
    { id: '15', name: 'Secret Hub #21', participants: 12, status: 'pending', timeInfo: '00:42:20' },
    { id: '16', name: 'Secret Hub #22', participants: 9, status: 'transacted', timeInfo: '01:30:55' },
    { id: '17', name: 'Secret Hub #23', participants: 11, status: 'rolledUp', timeInfo: '6 hours ago' },
    { id: '18', name: 'Secret Hub #24', participants: 7, status: 'transacted', timeInfo: '00:18:40' },
    { id: '19', name: 'Secret Hub #25', participants: 15, status: 'pending', timeInfo: '00:55:25' },
    { id: '20', name: 'Secret Hub #26', participants: 10, status: 'rolledUp', timeInfo: '7 hours ago' },
    { id: '21', name: 'Secret Hub #27', participants: 6, status: 'transacted', timeInfo: '02:40:12' },
    { id: '22', name: 'Secret Hub #28', participants: 14, status: 'pending', timeInfo: '00:12:50' },
    { id: '23', name: 'Secret Hub #29', participants: 13, status: 'transacted', timeInfo: '01:15:33' },
    { id: '24', name: 'Secret Hub #30', participants: 8, status: 'rolledUp', timeInfo: '8 hours ago' },
    { id: '25', name: 'Secret Hub #31', participants: 11, status: 'transacted', timeInfo: '00:35:18' },
    { id: '26', name: 'Secret Hub #32', participants: 9, status: 'pending', timeInfo: '00:25:42' },
    { id: '27', name: 'Secret Hub #33', participants: 12, status: 'rolledUp', timeInfo: '9 hours ago' },
    { id: '28', name: 'Secret Hub #34', participants: 7, status: 'transacted', timeInfo: '01:48:27' },
    { id: '29', name: 'Secret Hub #35', participants: 16, status: 'pending', timeInfo: '00:05:15' },
    { id: '30', name: 'Secret Hub #36', participants: 10, status: 'transacted', timeInfo: '02:22:50' },
  ];

  const filteredSessions = sessions.filter(session => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return session.status === 'pending';
    if (activeFilter === 'transacted') return session.status === 'transacted';
    if (activeFilter === 'rolledUp') return session.status === 'rolledUp';
    return true;
  });

  return (
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
          <div className="flex justify-between items-center mb-12">
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

            {/* Create Session Button */}
            <button 
              className="relative h-12 px-6 bg-black border-2 border-[#FFFF00] hover:bg-[#1A1A2E] hover:border-[#00FFFF] transition-all neon-border-yellow hover:neon-border-cyan hover:translate-x-[-2px] hover:translate-y-[-2px]"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              <span 
                className="text-sm text-[#FFFF00] tracking-wide pixel-font neon-glow-yellow"
              >
                Create Session
              </span>
            </button>
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
                { label: 'Created', value: '2', icon: '➕', color: '#FFFF00', isTime: false },
                { label: 'Transacted', value: '2', icon: '📝', color: '#FF00FF', isTime: false },
                { label: 'Rolled Up', value: '2', icon: '⬆️', color: '#00FFFF', isTime: false },
                { label: 'Last Rollup', value: '2h ago', icon: '🕐', color: '#FFA500', isTime: true }
              ].map((stat, index) => (
                <div key={index} className="flex gap-5 pl-4">
                  <div className="text-4xl">{stat.icon}</div>
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
                <SessionCard key={`${session.id}-${index}`} session={session} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}

function SessionCard({ session }: { session: SessionCard }) {
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
    if (isRolledUp) return 'text-[#FFFF00] neon-glow-yellow';
    return 'text-[#FFFF00]';
  };

  const getStatusLabel = () => {
    if (isPending) return 'State Changed';
    if (isTransacted) return 'Tx Created';
    if (isRolledUp) return 'Rolled Up';
    return 'Unknown';
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
              <p className="text-[#FFFF00] font-semibold">{session.participants}</p>
              <p className="text-[#FFFF00] font-semibold">{session.timeInfo}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {isRolledUp ? (
            <>
              <ActionButton variant="secondary" label="View Log" />
              <ActionButton variant="secondary" label="Archive" />
            </>
          ) : isPending ? (
            <>
              <ActionButton variant="orange" label="Create Tx" />
              <ActionButton variant="gray" label="Cancel" />
            </>
          ) : (
            <>
              <ActionButton variant="primary" label="Rollup" />
              <div className="flex gap-3 flex-1">
                <ActionButton variant="purple" label="View Tx" />
                <ActionButton variant="gray" label="Cancel" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ 
  variant, 
  label 
}: { 
  variant: 'primary' | 'secondary' | 'purple' | 'orange' | 'gray';
  label: string;
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
    }
  };

  const style = styles[variant];

  return (
    <button 
      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
      className={`flex-1 h-10 border-2 font-mono font-medium text-xs transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${style.bg} ${style.border} ${style.text} ${style.hover}`}
    >
      {label}
    </button>
  );
}

