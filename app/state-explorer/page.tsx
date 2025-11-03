'use client';

import React, { useState } from 'react';
import { Layout } from '@/components/Layout';

interface SessionCard {
  id: string;
  name: string;
  participants: number;
  status: 'ended' | 'expiring' | 'active';
  timeInfo: string;
}

export default function StateExplorerPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'ended'>('all');

  const sessions: SessionCard[] = [
    { id: '1', name: 'Secret Hub #7', participants: 10, status: 'ended', timeInfo: '2 hours ago' },
    { id: '2', name: 'Secret Hub #7', participants: 10, status: 'expiring', timeInfo: '01:02:22' },
    { id: '3', name: 'Secret Hub #7', participants: 10, status: 'expiring', timeInfo: '01:02:22' },
    { id: '4', name: 'Secret Hub #7', participants: 10, status: 'ended', timeInfo: '2 hours ago' },
    { id: '5', name: 'Secret Hub #7', participants: 10, status: 'expiring', timeInfo: '01:02:22' },
    { id: '6', name: 'Secret Hub #7', participants: 10, status: 'expiring', timeInfo: '01:02:22' },
  ];

  const filteredSessions = sessions.filter(session => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return session.status === 'expiring';
    if (activeFilter === 'ended') return session.status === 'ended';
    return true;
  });

  return (
    <Layout mainClassName="!p-0 !pt-0">
      <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Pac-Man dot pattern */}
      <div className="absolute inset-0 pacman-dots"></div>
      
      {/* Neon grid lines */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(#00FFFF22 1px, transparent 1px),
          linear-gradient(90deg, #00FFFF22 1px, transparent 1px)
        `,
        backgroundSize: '30px 30px'
      }} />

      {/* Main Content */}
      <div className="relative z-10 pt-6 px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex justify-between items-center mb-12">
            <div className="space-y-3">
              <h1 
                className="text-6xl font-normal tracking-wider"
                style={{
                  fontFamily: "'Jersey 10', cursive",
                  background: 'linear-gradient(180deg, #57D2FF 0%, #57D2FF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0px 4px 0px rgba(14, 50, 96, 1)',
                  textTransform: 'uppercase'
                }}
              >
                PROOFLESS DASHBOARD
              </h1>
              <p className="text-[#C8EDFF] font-mono text-base tracking-tight">
                Where proof exists, but records don&apos;t.
              </p>
            </div>

            {/* Create Session Button */}
            <button 
              className="relative h-14 px-6 bg-black border-2 border-[#FFFF00] hover:bg-[#1A1A2E] hover:border-[#00FFFF] transition-all neon-border-yellow hover:neon-border-cyan hover:translate-x-[-2px] hover:translate-y-[-2px]"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              <span 
                className="text-3xl text-[#FFFF00] tracking-wide pixel-font neon-glow-yellow"
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
                { label: 'Created', count: 2, icon: '➕', color: '#FFFF00' },
                { label: 'Joined', count: 2, icon: '🔗', color: '#00FFFF' },
                { label: 'Expiring', count: 2, icon: '⏰', color: '#FF00FF' },
                { label: 'Destroyed', count: 2, icon: '💥', color: '#FFA500' }
              ].map((stat, index) => (
                <div key={index} className="flex gap-5 pl-4">
                  <div className="text-4xl">{stat.icon}</div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[#00FFFF] font-mono font-semibold text-base">
                      {stat.label}
                    </span>
                    <span 
                      className="text-5xl tracking-wider pixel-font"
                      style={{ 
                        color: stat.color,
                        textShadow: `0 0 10px ${stat.color}, 0 0 20px ${stat.color}`
                      }}
                    >
                      {stat.count}
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
                { label: 'Active', value: 'active', color: '#00FFFF' },
                { label: 'Ended', value: 'ended', color: '#FF00FF' }
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value as any)}
                  className={`h-10 px-6 border-2 transition-all pixel-font ${
                    activeFilter === filter.value
                      ? 'bg-[#1A1A2E] hover:translate-x-[-2px] hover:translate-y-[-2px]'
                      : 'bg-black hover:bg-[#1A1A2E]'
                  }`}
                  style={{ 
                    fontSize: '24px',
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
            <div className="grid grid-cols-2 gap-6">
              {filteredSessions.map((session, index) => (
                <SessionCard key={`${session.id}-${index}`} session={session} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 w-full bg-[#0C1B2D] py-6 px-10">
        <div className="flex justify-between items-center text-[#CCEFFF] text-sm">
          <span className="font-sans tracking-wider">
            ©2025 Tokamak Network zk-EVM. All Rights Reserved.
          </span>
          <div className="flex gap-8">
            <a href="#" className="hover:opacity-80 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M20 3.924a8.223 8.223 0 01-2.357.646A4.115 4.115 0 0019.448 2.3a8.24 8.24 0 01-2.605.996 4.104 4.104 0 00-6.993 3.741 11.65 11.65 0 01-8.457-4.287 4.104 4.104 0 001.27 5.477A4.072 4.072 0 01.8 7.704v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407 11.616 11.616 0 006.29 18.3c7.547 0 11.675-6.252 11.675-11.675 0-.178-.004-.355-.012-.531A8.341 8.341 0 0020 3.924z"/>
              </svg>
            </a>
            <a href="#" className="hover:opacity-80 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 0C4.477 0 0 4.477 0 10c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z"/>
              </svg>
            </a>
            <a href="#" className="hover:opacity-80 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 0c5.523 0 10 4.477 10 10s-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0zm4.442 6.014l-5.116 5.116a.697.697 0 01-.986 0L6.014 8.803a.697.697 0 010-.986l.493-.493a.697.697 0 01.986 0l1.39 1.39 3.637-3.637a.697.697 0 01.986 0l.493.493a.697.697 0 010 .986z"/>
              </svg>
            </a>
            <a href="#" className="hover:opacity-80 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm4.894 6.187l-.001.043c-.003 1.287-.383 3.202-1.568 5.12-.812 1.311-1.826 2.352-3.014 3.093-1.186.74-2.447 1.113-3.75 1.113-.65 0-1.28-.102-1.882-.303-.6-.201-1.161-.492-1.673-.87l.256-.006c.887 0 1.723-.265 2.493-.789-.413-.008-.787-.134-1.116-.377a2.03 2.03 0 01-.731-.903l.478.004c.197 0 .39-.024.575-.072a2.018 2.018 0 01-1.183-.72 2.01 2.01 0 01-.463-1.298v-.025c.256.141.539.221.842.237a2.005 2.005 0 01-.893-1.673c0-.382.102-.74.281-1.063.464.568 1.023 1.018 1.66 1.338.64.32 1.328.494 2.047.517a2.27 2.27 0 01-.053-.459c0-.546.193-1.012.58-1.396.386-.385.852-.577 1.397-.577.57 0 1.053.207 1.44.617a3.997 3.997 0 001.285-.488 2.008 2.008 0 01-.885 1.114c.404-.048.792-.155 1.158-.318-.267.398-.607.748-1.012 1.043z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}

function SessionCard({ session }: { session: SessionCard }) {
  const isEnded = session.status === 'ended';
  const isExpiring = session.status === 'expiring';

  return (
    <div 
      className={`p-6 relative border-2 ${
        isEnded 
          ? 'bg-[#1A1A2E] border-[#FF00FF] neon-border-pink'
          : 'bg-[#1A1A2E] border-[#00FFFF] neon-border-cyan'
      }`}
      style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
    >
      <div className="space-y-4">
        {/* Session Info */}
        <div className="space-y-2">
          <h3 
            className={`text-3xl pixel-font ${isEnded ? 'text-[#FF00FF] neon-glow-pink' : 'text-[#FFFF00] neon-glow-yellow'}`}
          >
            {session.name}
          </h3>
          <div className="flex justify-between items-center text-base font-mono">
            <div className="space-y-0 leading-10">
              <p className="text-[#00FFFF]">Participants</p>
              <p className="text-[#00FFFF]">{isEnded ? 'Ended' : 'Expires in'}</p>
            </div>
            <div className="space-y-0 leading-10 text-right">
              <p className="text-[#FFFF00] font-semibold">{session.participants}</p>
              <p className="text-[#FFFF00] font-semibold">{session.timeInfo}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {isEnded ? (
            <>
              <ActionButton variant="secondary" label="View Log" />
              <ActionButton variant="secondary" label="Delete" />
            </>
          ) : (
            <>
              <ActionButton variant="primary" label="Enter" />
              <div className="flex gap-3 flex-1">
                <ActionButton variant="purple" label="Invite" />
                <ActionButton variant="gray" label="Destroy" />
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
  variant: 'primary' | 'secondary' | 'purple' | 'gray';
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
    gray: {
      bg: 'bg-black',
      border: 'border-[#FFA500]',
      text: 'text-[#FFA500]',
      hover: 'hover:bg-[#1A1A2E]'
    }
  };

  const style = styles[variant];

  return (
    <button 
      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
      className={`flex-1 h-10 border-2 font-mono font-medium text-base transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${style.bg} ${style.border} ${style.text} ${style.hover}`}
    >
      {label}
    </button>
  );
}

