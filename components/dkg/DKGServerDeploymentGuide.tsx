'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Server } from 'lucide-react';

interface DKGServerDeploymentGuideProps {
  onSuccessMessage: (message: string) => void;
}

export function DKGServerDeploymentGuide({ onSuccessMessage }: DKGServerDeploymentGuideProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center">
            <Server className="w-5 h-5 text-[#4fc3f7]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">FROST DKG Server Deployment</h3>
            <p className="text-sm text-gray-400">Run the DKG coordinator server locally and create ngrok tunnels for external access</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/30 p-6 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#4fc3f7] text-black rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Clone the FROST DKG Repository
            </h4>
            <div className="space-y-4">
              <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4">
                <p className="text-sm text-gray-300 mb-2">First, clone the threshold signature FROST repository:</p>
                <code className="block bg-black/50 text-green-400 p-3 rounded font-mono text-sm">
                  git clone https://github.com/tokamak-network/threshold-signature-Frost.git{'\n'}
                  cd threshold-signature-Frost
                </code>
                <p className="text-xs text-gray-400 mt-2">✅ This repository contains the FROST DKG coordinator server implementation</p>
              </div>
              <div className="text-sm text-gray-300 p-3 bg-blue-900/20 border border-blue-500/50 rounded">
                <strong className="text-blue-300">💡 Tip:</strong> Make sure you have Rust and Cargo installed before proceeding to the next step.
              </div>
            </div>
          </div>

          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/30 p-6 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#4fc3f7] text-black rounded-full flex items-center justify-center text-sm font-bold">2</span>
              Start the DKG Server
            </h4>
            <div className="space-y-4">
              <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4">
                <p className="text-sm text-gray-300 mb-2">Build and run the FROST DKG server:</p>
                <code className="block bg-black/50 text-green-400 p-3 rounded font-mono text-sm">
                  cargo run --bin fserver server --bind 127.0.0.1:9000
                </code>
                <p className="text-xs text-gray-400 mt-2">✅ Server will be available at: ws://127.0.0.1:9000/ws</p>
              </div>
              <div className="text-sm text-gray-300 p-3 bg-blue-900/20 border border-blue-500/50 rounded">
                <strong className="text-blue-300">💡 Tip:</strong> Keep this terminal open while running DKG ceremonies. The server coordinates between participants.
              </div>
            </div>
          </div>

          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/30 p-6 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#4fc3f7] text-black rounded-full flex items-center justify-center text-sm font-bold">3</span>
              Create ngrok Tunnel for External Access
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4">
                  <p className="text-sm text-gray-300 mb-2">Install ngrok (macOS):</p>
                  <code className="block bg-black/50 text-green-400 p-3 rounded font-mono text-sm">
                    brew install ngrok
                  </code>
                </div>
                <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4">
                  <p className="text-sm text-gray-300 mb-2">Or download from:</p>
                  <a href="https://ngrok.com/download" target="_blank" rel="noopener noreferrer" 
                     className="text-[#4fc3f7] hover:underline font-mono text-sm">
                    https://ngrok.com/download
                  </a>
                </div>
              </div>
              
              <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4">
                <p className="text-sm text-gray-300 mb-2">Get your auth token from ngrok dashboard and authenticate:</p>
                <code className="block bg-black/50 text-green-400 p-3 rounded font-mono text-sm mb-2">
                  ngrok authtoken YOUR_AUTH_TOKEN_HERE
                </code>
                <p className="text-xs text-gray-400">Get your token at: <a href="https://dashboard.ngrok.com/get-started/your-authtoken" target="_blank" rel="noopener noreferrer" className="text-[#4fc3f7] hover:underline">dashboard.ngrok.com/get-started/your-authtoken</a></p>
              </div>

              <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4">
                <p className="text-sm text-gray-300 mb-2">Create tunnel (run in a new terminal):</p>
                <code className="block bg-black/50 text-green-400 p-3 rounded font-mono text-sm">
                  ngrok http 9000
                </code>
                <p className="text-xs text-gray-400 mt-2">✅ Use the HTTPS URL from ngrok output, append /ws for WebSocket endpoint</p>
              </div>

              <div className="text-sm text-yellow-200 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded">
                <strong className="text-yellow-300">⚠️ Important:</strong> Use <code className="bg-black/30 px-1 rounded">wss://</code> (secure WebSocket) not <code className="bg-black/30 px-1 rounded">ws://</code> for ngrok URLs
              </div>
            </div>
          </div>

          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/30 p-6 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#4fc3f7] text-black rounded-full flex items-center justify-center text-sm font-bold">4</span>
              Connect Participants
            </h4>
            <div className="space-y-4">
              <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4">
                <p className="text-sm text-gray-300 mb-2">Share your ngrok URL with other participants:</p>
                <code className="block bg-black/50 text-green-400 p-3 rounded font-mono text-sm">
                  wss://abc123-defg-4567.ngrok-free.dev/ws
                </code>
                <p className="text-xs text-gray-400 mt-2">Each participant enters this URL in the DKG server connection field above</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-sm text-green-200 p-3 bg-green-900/20 border border-green-500/50 rounded">
                  <strong className="text-green-300">✅ Local Development:</strong><br/>
                  Use ws://127.0.0.1:9000/ws
                </div>
                <div className="text-sm text-blue-200 p-3 bg-blue-900/20 border border-blue-500/50 rounded">
                  <strong className="text-blue-300">🌐 External Access:</strong><br/>
                  Use wss://your-ngrok-url.ngrok-free.dev/ws
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/30 p-6 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#4fc3f7] text-black rounded-full flex items-center justify-center text-sm font-bold">5</span>
              Quick Commands
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText('git clone https://github.com/tokamak-network/threshold-signature-Frost.git');
                    onSuccessMessage('Git clone command copied to clipboard!');
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
                >
                  📋 Copy Git Clone Command
                </Button>
                
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText('cargo run --bin fserver server --bind 127.0.0.1:9000');
                    onSuccessMessage('Server start command copied to clipboard!');
                  }}
                  className="w-full bg-[#4fc3f7] hover:bg-[#4fc3f7]/80 text-black font-medium"
                >
                  📋 Copy Server Start Command
                </Button>
                
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText('ngrok http 9000');
                    onSuccessMessage('ngrok tunnel command copied to clipboard!');
                  }}
                  className="w-full bg-[#028bee] hover:bg-[#0277d4] text-white font-medium"
                >
                  🌐 Copy ngrok Tunnel Command
                </Button>
              </div>

              <div className="space-y-3">
                <a
                  href="https://dashboard.ngrok.com/get-started/your-authtoken"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-block text-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors"
                >
                  🔑 Get ngrok Auth Token
                </a>
                
                <Button
                  onClick={() => {
                    const url = 'http://127.0.0.1:4040';
                    window.open(url, '_blank');
                  }}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium"
                >
                  📊 Open ngrok Dashboard
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/30 p-6 rounded-lg">
            <h4 className="text-md font-semibold text-white mb-4">📚 Additional Resources</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4 text-center">
                <div className="text-2xl mb-2">📖</div>
                <h5 className="text-sm font-semibold text-white mb-1">Full Documentation</h5>
                <p className="text-xs text-gray-400 mb-3">Complete server deployment guide</p>
                <Button
                  onClick={() => {
                    onSuccessMessage('See frost-dkg/SERVER_DEPLOYMENT.md for complete documentation');
                  }}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  View Guide
                </Button>
              </div>
              
              <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4 text-center">
                <div className="text-2xl mb-2">🔧</div>
                <h5 className="text-sm font-semibold text-white mb-1">Troubleshooting</h5>
                <p className="text-xs text-gray-400 mb-3">Common issues and solutions</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    document.getElementById('troubleshooting')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  See Below
                </Button>
              </div>
              
              <div className="bg-[#1a1a2e] border border-gray-600 rounded p-4 text-center">
                <div className="text-2xl mb-2">🔐</div>
                <h5 className="text-sm font-semibold text-white mb-1">Security Guide</h5>
                <p className="text-xs text-gray-400 mb-3">Best practices and security</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  See Below
                </Button>
              </div>
            </div>
          </div>

          <div id="troubleshooting" className="bg-red-900/10 border border-red-500/30 p-6 rounded-lg">
            <h4 className="text-md font-semibold text-red-200 mb-4">🔧 Troubleshooting</h4>
            <div className="space-y-3 text-sm text-red-100">
              <div>
                <strong>Port already in use:</strong> Change port with <code className="bg-black/30 px-1 rounded">--bind 0.0.0.0:8080</code>
              </div>
              <div>
                <strong>ngrok tunnel already online:</strong> Kill existing with <code className="bg-black/30 px-1 rounded">pkill ngrok</code> then restart
              </div>
              <div>
                <strong>Connection refused:</strong> Ensure server is running and firewall allows the port
              </div>
              <div>
                <strong>WebSocket errors:</strong> Check ngrok dashboard at <code className="bg-black/30 px-1 rounded">http://127.0.0.1:4040</code>
              </div>
            </div>
          </div>

          <div id="security" className="bg-amber-900/10 border border-amber-500/30 p-6 rounded-lg">
            <h4 className="text-md font-semibold text-amber-200 mb-4">🔒 Security Considerations</h4>
            <div className="space-y-2 text-sm text-amber-100">
              <div>• All operations require cryptographic signature authentication</div>
              <div>• Use HTTPS/WSS in production environments</div>
              <div>• ngrok free tier has rate limits and temporary URLs</div>
              <div>• Consider VPN or dedicated server for production use</div>
              <div>• Monitor server logs for suspicious activity</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}