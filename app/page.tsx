"use client";

import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";
import { ClientOnly } from "@/components/ClientOnly";
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from "@/lib/contracts";
import { useRouter } from "next/navigation";
import { Layout } from "@/components/Layout";
import { useUserRolesDynamic } from "@/hooks/useUserRolesDynamic";

export default function HomePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [creatorAddress, setCreatorAddress] = useState("");
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);

  // Check if the current user is the owner
  const { data: owner } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: "owner",
    enabled: isConnected,
  });

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase();

  // Check if the current user is authorized to create channels
  const { data: isAuthorized } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: "isAuthorizedCreator",
    args: address ? [address] : undefined,
    enabled: isConnected && !!address,
  });

  // Use dynamic hook to check all channels for leadership and participation
  const {
    hasChannels,
    isParticipant: isDynamicParticipant,
    participatingChannels,
    leadingChannels,
  } = useUserRolesDynamic();

  // For compatibility, map the dynamic results to the existing variable names
  const isParticipant = isDynamicParticipant;

  // Validate the creator address
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(creatorAddress);

  // Prepare the authorize creator transaction
  const { config } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: "authorizeCreator",
    args: isValidAddress ? [creatorAddress as `0x${string}`] : undefined,
    enabled: isOwner && isValidAddress,
  });

  const { write: authorizeCreator, isLoading: isAuthorizing } =
    useContractWrite(config);

  const handleAuthorizeCreator = () => {
    if (authorizeCreator) {
      authorizeCreator();
      setCreatorAddress("");
    }
  };

  const handleCreateChannel = () => {
    if (!isConnected) {
      return;
    }

    setShowCreateChannelModal(true);
  };

  const handleConfirmCreateChannel = () => {
    setShowCreateChannelModal(false);
    router.push("/create-channel");
  };

  const handleDepositTokens = () => {
    if (!isConnected) return;
    router.push("/deposit-tokens");
  };

  const handleWithdrawTokens = () => {
    if (!isConnected) return;
    router.push("/withdraw-tokens");
  };

  const handleInitializeState = () => {
    if (!isConnected) return;
    router.push("/initialize-state");
  };

  const handleSubmitProof = () => {
    if (!isConnected) return;
    router.push("/submit-proof");
  };

  const handleSignProof = () => {
    if (!isConnected) return;
    router.push("/sign-proof");
  };

  const handleCloseChannel = () => {
    if (!isConnected) return;
    router.push("/close-channel");
  };

  const handleDeleteChannel = () => {
    if (!isConnected) return;
    router.push("/delete-channel");
  };

  const handleDKGManagement = () => {
    if (!isConnected) return;
    router.push("/dkg-management");
  };

  // Game missions based on user status
  const missions = [];

  if (isConnected) {
    // Create Channel - available for anyone with 1 ETH deposit
    missions.push({
      id: "create",
      icon: "⚒",
      name: "Create Channel",
      level: "LVL 1",
      color: "#00FF00",
      action: handleCreateChannel,
    });

    // DKG Management - available for all connected users
    missions.push({
      id: "dkg",
      icon: "🔑",
      name: "DKG Management",
      level: "LVL 2",
      color: "#FFFF00",
      action: handleDKGManagement,
    });

    if (isParticipant || hasChannels) {
      missions.push(
        {
          id: "deposit",
          icon: "💰",
          name: "Deposit Tokens",
          level: "LVL 3",
          color: "#00FFFF",
          action: handleDepositTokens,
        },
        {
          id: "withdraw",
          icon: "💳",
          name: "Withdraw Tokens",
          level: "LVL 4",
          color: "#FF00FF",
          action: handleWithdrawTokens,
        }
      );
    }

    if (hasChannels) {
      missions.push(
        {
          id: "init",
          icon: "⚡",
          name: "Initialize State",
          level: "LVL 5",
          color: "#FFA500",
          action: handleInitializeState,
        },
        {
          id: "submit",
          icon: "📋",
          name: "Submit Proof",
          level: "LVL 6",
          color: "#00FFFF",
          action: handleSubmitProof,
        },
        {
          id: "sign",
          icon: "✎",
          name: "Sign Proof",
          level: "LVL 7",
          color: "#FF00FF",
          action: handleSignProof,
        },
        {
          id: "close",
          icon: "⊗",
          name: "Close Channel",
          level: "LVL 8",
          color: "#FF0000",
          action: handleCloseChannel,
        },
        {
          id: "delete",
          icon: "✕",
          name: "Delete Channel",
          level: "LVL 9",
          color: "#808080",
          action: handleDeleteChannel,
        }
      );
    }
  }

  return (
    <>
      <Layout mainClassName="!p-0 !pt-0">
        {/* 3D Perspective Grid - Fixed to viewport */}
        <div className="perspective-grid">
          <div className="grid-plane"></div>
        </div>

        <div className="min-h-screen relative overflow-hidden">
          {/* Main Content */}
          <div className="relative z-10 pt-12 px-6 pb-12">
            <div className="max-w-7xl mx-auto">
              {/* Channel Hub Title */}
              <div className="text-center mb-12">
                <h1 className="text-3xl pixel-font mb-4 text-[#FFA500] neon-glow-orange">
                  CHANNEL HUB
                </h1>
                <ClientOnly>
                  <p className="text-[#00FFFF] pixel-font text-xs tracking-wider">
                    {isConnected
                      ? "MANAGE YOUR L2 STATE CHANNELS"
                      : "CONNECT WALLET TO CONTINUE"}
                  </p>
                </ClientOnly>
              </div>

              {/* Arcade Cabinet Frame */}
              <div className="arcade-cabinet max-w-5xl mx-auto mb-12">
                {/* CRT Screen */}
                <div className="arcade-screen crt-curve">
                  <div className="crt-content">
                    {/* Player Status Board */}
                    <ClientOnly>
                      {isConnected ? (
                        <div
                          className="bg-[#1A1A2E] p-6 mb-8 border-2 border-[#FFFF00] neon-border-yellow"
                          style={{
                            clipPath:
                              "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                          }}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="text-center">
                              <p className="text-[#00FFFF] font-mono text-xs mb-2">
                                PARTICIPATING CHANNELS
                              </p>
                              <p
                                className="text-[#00FF00] pixel-font text-2xl"
                                style={{
                                  textShadow:
                                    "0 0 10px #00FF00, 0 0 20px #00FF00",
                                }}
                              >
                                {isParticipant
                                  ? participatingChannels.length
                                  : 0}
                              </p>
                              <p className="text-[#00FFFF] font-mono text-[10px] mt-1 opacity-70">
                                Channels you've joined
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-[#00FFFF] font-mono text-xs mb-2">
                                CREATED CHANNELS
                              </p>
                              <p className="text-[#FF00FF] pixel-font text-2xl neon-glow-pink">
                                {hasChannels ? leadingChannels.length : 0}
                              </p>
                              <p className="text-[#00FFFF] font-mono text-[10px] mt-1 opacity-70">
                                Channels you've created
                              </p>
                            </div>
                          </div>

                          {/* Owner Panel Toggle */}
                          {isOwner && (
                            <div className="mt-6 pt-6 border-t-2 border-[#00FFFF]">
                              <button
                                onClick={() =>
                                  setShowOwnerPanel(!showOwnerPanel)
                                }
                                className="w-full h-12 bg-black border-2 border-[#FFA500] text-[#FFA500] hover:bg-[#1A1A2E] transition-all pixel-font text-xs flex items-center justify-center gap-2"
                                style={{
                                  clipPath:
                                    "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                                }}
                              >
                                <span>👑</span>
                                <span>
                                  {showOwnerPanel ? "HIDE" : "SHOW"} ADMIN PANEL
                                </span>
                              </button>

                              {showOwnerPanel && (
                                <div
                                  className="mt-4 p-4 bg-black border-2 border-[#FFA500]"
                                  style={{
                                    clipPath:
                                      "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                                  }}
                                >
                                  <label className="block text-[#00FFFF] font-mono text-xs mb-2">
                                    AUTHORIZE CREATOR ADDRESS
                                  </label>
                                  <div className="flex gap-3">
                                    <input
                                      type="text"
                                      value={creatorAddress}
                                      onChange={(e) =>
                                        setCreatorAddress(e.target.value)
                                      }
                                      placeholder="0x..."
                                      className="flex-1 px-3 py-2 bg-black border-2 border-[#00FFFF] text-[#00FFFF] font-mono text-xs focus:outline-none focus:border-[#FFFF00]"
                                    />
                                    <button
                                      onClick={handleAuthorizeCreator}
                                      disabled={
                                        !isValidAddress || isAuthorizing
                                      }
                                      className="px-6 py-2 bg-black border-2 border-[#00FF00] text-[#00FF00] pixel-font text-xs hover:bg-[#1A1A2E] disabled:opacity-50 disabled:cursor-not-allowed"
                                      style={{
                                        clipPath:
                                          "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                                      }}
                                    >
                                      {isAuthorizing
                                        ? "LOADING..."
                                        : "AUTHORIZE"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="bg-[#1A1A2E] p-12 border-2 border-[#FFFF00] neon-border-yellow text-center flash-animation"
                          style={{
                            clipPath:
                              "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                          }}
                        >
                          <div className="text-8xl mb-6">🎮</div>
                          <p className="text-[#FFFF00] pixel-font text-2xl mb-6 neon-glow-yellow">
                            CONNECT WALLET
                          </p>
                          <p className="text-[#00FFFF] font-mono text-xs mb-8">
                            Connect your wallet to start playing
                          </p>
                          <div className="flex justify-center">
                            <ConnectButton />
                          </div>
                        </div>
                      )}
                    </ClientOnly>

                    {/* Action Cards Grid */}
                    <ClientOnly>
                      {missions.length > 0 && (
                        <div className="mt-8">
                          <h2 className="text-[#00FFFF] pixel-font text-xl text-center mb-6 neon-glow-cyan">
                            AVAILABLE ACTIONS
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {missions.map((mission, index) => (
                              <button
                                key={mission.id}
                                onClick={mission.action}
                                className="p-6 bg-[#1A1A2E] border-2 hover:bg-[#2A2A3E] transition-all hover:translate-x-[-4px] hover:translate-y-[-4px] group"
                                style={{
                                  clipPath:
                                    "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                                  borderColor: mission.color,
                                  boxShadow: `0 0 10px ${mission.color}40`,
                                }}
                              >
                                <div className="flex items-center justify-center mb-4">
                                  <span
                                    className="text-4xl"
                                    style={{
                                      filter: `drop-shadow(0 0 8px ${mission.color}) drop-shadow(0 0 12px ${mission.color})`,
                                    }}
                                  >
                                    {mission.icon}
                                  </span>
                                </div>
                                <h3
                                  className="pixel-font text-xs mb-2"
                                  style={{
                                    color: mission.color,
                                    textShadow: `0 0 5px ${mission.color}, 0 0 10px ${mission.color}`,
                                  }}
                                >
                                  {mission.name}
                                </h3>
                                <div className="flex items-center justify-between mt-4">
                                  <span className="text-[#00FFFF] font-mono text-[10px] opacity-70">
                                    EXECUTE
                                  </span>
                                  <span className="text-[#FFFF00] font-mono text-xs opacity-60">
                                    ▶
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </ClientOnly>
                  </div>
                </div>
              </div>

              {/* Contract Info - Integrated System Panel */}
              <ClientOnly>
                {isConnected && (
                  <div className="mt-12 max-w-3xl mx-auto">
                    {/* Unified System Panel */}
                    <div
                      className="relative bg-gradient-to-b from-[#2A2A3E] via-[#1A1A2E] to-[#0A0A14] p-8"
                      style={{
                        border: "4px solid #4A4A5E",
                        borderRadius: "4px",
                        boxShadow: `
                          0 0 0 2px #FFA500,
                          0 0 0 6px #2A2A3E,
                          0 0 20px rgba(255, 165, 0, 0.4),
                          inset 0 2px 20px rgba(0, 0, 0, 0.8),
                          inset 0 0 60px rgba(255, 165, 0, 0.05)
                        `,
                      }}
                    >
                      {/* Corner Bolts */}
                      {[
                        { top: "-top-2", left: "-left-2", rotate: "" },
                        {
                          top: "-top-2",
                          left: "-right-2",
                          rotate: "rotate-90",
                        },
                        {
                          top: "-bottom-2",
                          left: "-left-2",
                          rotate: "rotate-45",
                        },
                        { top: "-bottom-2", left: "-right-2", rotate: "" },
                      ].map((pos, i) => (
                        <div
                          key={i}
                          className={`absolute ${pos.top} ${pos.left} w-4 h-4 bg-gradient-to-br from-[#8B8B9E] to-[#4A4A5E] rounded-full border-2 border-[#2A2A3E]`}
                          style={{
                            boxShadow:
                              "inset 1px 1px 2px rgba(255,255,255,0.3), inset -1px -1px 2px rgba(0,0,0,0.5)",
                          }}
                        >
                          <div className="absolute inset-1 border border-[#6A6A7E] rounded-full"></div>
                          <div
                            className={`absolute top-1/2 left-1/2 w-[2px] h-2 bg-[#2A2A3E] transform -translate-x-1/2 -translate-y-1/2 ${pos.rotate}`}
                          ></div>
                        </div>
                      ))}

                      {/* System Header */}
                      <div className="flex items-center justify-center gap-3 mb-6">
                        <span className="text-[#FFA500] text-2xl">⚙</span>
                        <h3
                          className="arcade-font text-lg text-[#FFA500] tracking-wider"
                          style={{
                            textShadow:
                              "0 0 10px #FFA500, 0 0 20px #FFA500, 2px 2px 0px rgba(0, 0, 0, 0.8)",
                          }}
                        >
                          SMART CONTRACT SYSTEM
                        </h3>
                        <span className="text-[#FFA500] text-2xl">⚙</span>
                      </div>

                      {/* Divider Line */}
                      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#FFA500] to-transparent opacity-30 mb-6"></div>

                      {/* Display Screen */}
                      <div
                        className="bg-black border-2 border-[#00FF88] p-6 mb-6"
                        style={{
                          clipPath:
                            "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                          boxShadow:
                            "inset 0 0 20px rgba(0, 255, 136, 0.2), 0 0 15px rgba(0, 255, 136, 0.3)",
                        }}
                      >
                        <p className="text-[#00FF88] font-mono text-xs text-center mb-3 tracking-widest">
                          CONTRACT ADDRESS
                        </p>
                        <p
                          className="text-[#00FF88] pixel-font text-xs text-center break-all leading-relaxed mb-6"
                          style={{
                            textShadow: "0 0 5px #00FF88",
                          }}
                        >
                          {ROLLUP_BRIDGE_ADDRESS}
                        </p>

                        {/* Divider */}
                        <div className="h-[1px] bg-gradient-to-r from-transparent via-[#00FF88] to-transparent opacity-30 mb-4"></div>

                        {/* Channel Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Total Channels */}
                          <div className="text-center">
                            <p className="text-[#00FFFF] font-mono text-[10px] mb-2 tracking-wide">
                              Total Channels
                            </p>
                            <p
                              className="text-[#FFFF00] pixel-font text-xl"
                              style={{
                                textShadow:
                                  "0 0 10px #FFFF00, 0 0 20px #FFFF00",
                              }}
                            >
                              0
                            </p>
                          </div>

                          {/* Next Channel ID */}
                          <div className="text-center">
                            <p className="text-[#00FFFF] font-mono text-[10px] mb-2 tracking-wide">
                              Next Channel ID
                            </p>
                            <p
                              className="text-[#FF00FF] pixel-font text-xl"
                              style={{
                                textShadow:
                                  "0 0 10px #FF00FF, 0 0 20px #FF00FF",
                              }}
                            >
                              0
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Control Panel Row */}
                      <div className="flex items-center justify-between px-4">
                        {/* Etherscan Link Button */}
                        <a
                          href={`https://sepolia.etherscan.io/address/${ROLLUP_BRIDGE_ADDRESS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-2 bg-black border-2 border-[#00FF88] text-[#00FF88] arcade-font text-xs hover:bg-[#1A1A2E] hover:neon-border-green transition-all"
                          style={{
                            clipPath:
                              "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                          }}
                        >
                          [●] ETHERSCAN
                        </a>

                        {/* Status LED */}
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 bg-[#00FF00] rounded-full"
                            style={{
                              boxShadow: "0 0 10px #00FF00, 0 0 20px #00FF00",
                              animation: "pulse 2s infinite",
                            }}
                          ></div>
                          <span className="text-[#00FF00] font-mono text-xs">
                            READY
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </ClientOnly>
            </div>
          </div>
        </div>
      </Layout>

      {/* Create Channel Modal - Retro Style */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div
            className="bg-[#1A1A2E] border-2 border-[#00FF00] p-8 max-w-md w-full"
            style={{
              clipPath:
                "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
              boxShadow: "0 0 20px #00FF00, 0 0 40px #00FF00",
            }}
          >
            <div className="text-center">
              <div className="text-6xl mb-4">⚒</div>
              <h3
                className="text-[#00FF00] pixel-font text-xl mb-4"
                style={{ textShadow: "0 0 10px #00FF00, 0 0 20px #00FF00" }}
              >
                CREATE CHANNEL
              </h3>

              <div className="text-left space-y-4 mb-6">
                <div
                  className="bg-black border-2 border-[#00FFFF] p-4"
                  style={{
                    clipPath:
                      "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                  }}
                >
                  <p className="text-[#00FFFF] font-mono text-xs mb-2 font-semibold">
                    REQUIREMENTS
                  </p>
                  <ul className="text-[#00FFFF] font-mono text-xs space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-[#FFFF00]">•</span>
                      <span>
                        Deposit:{" "}
                        <span className="text-[#FFFF00] font-semibold">
                          1 ETH
                        </span>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#FFFF00]">•</span>
                      <span>Multi-party state channel</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#FFFF00]">•</span>
                      <span>You will become the channel leader</span>
                    </li>
                  </ul>
                </div>

                <div
                  className="bg-black border-2 border-[#FFA500] p-4"
                  style={{
                    clipPath:
                      "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                  }}
                >
                  <p className="text-[#FFA500] font-mono text-xs mb-2 font-semibold">
                    ⚠ NOTICE
                  </p>
                  <p className="text-[#00FFFF] font-mono text-xs">
                    The 1 ETH deposit will be locked until the channel is
                    properly closed.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateChannelModal(false)}
                  className="flex-1 h-12 bg-black border-2 border-[#808080] text-[#808080] pixel-font text-xs hover:bg-[#1A1A2E] transition-all"
                  style={{
                    clipPath:
                      "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleConfirmCreateChannel}
                  className="flex-1 h-12 bg-black border-2 border-[#00FF00] text-[#00FF00] pixel-font text-xs hover:bg-[#1A1A2E] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px]"
                  style={{
                    clipPath:
                      "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                    boxShadow: "0 0 10px #00FF0040",
                  }}
                >
                  PROCEED
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
