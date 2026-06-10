"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [botStatus, setBotStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function fetchStatus() {
      try {
        const res = await fetch("http://localhost:4000/admin/bot-status");
        if (!res.ok) throw new Error("Failed to fetch status");
        const data = await res.json();
        setBotStatus(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    // Initial fetch
    fetchStatus();

    // Poll every 3 seconds
    interval = setInterval(fetchStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-neutral-800 p-8 rounded-xl shadow-lg border border-neutral-700">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-white">
            SaathiAI Admin
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-400">
            WhatsApp Bot Status & Management
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-md bg-neutral-900/50 p-4 border border-neutral-700">
            <h3 className="text-lg font-medium leading-6 text-white mb-4">
              Connection Status
            </h3>
            
            {loading && !botStatus ? (
              <p className="text-neutral-400 text-center py-4">Loading...</p>
            ) : error ? (
              <p className="text-red-400 text-center py-4">Error: {error}</p>
            ) : (
              <div className="flex flex-col items-center space-y-6">
                <div className="flex items-center space-x-2">
                  <span className={`h-3 w-3 rounded-full ${botStatus?.connected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                  <span className="text-xl font-semibold capitalize">
                    {botStatus?.status?.replace('_', ' ') || 'Unknown'}
                  </span>
                </div>

                {botStatus?.qr && !botStatus?.connected && (
                  <div className="flex flex-col items-center space-y-4">
                    <p className="text-sm text-neutral-400">Scan this QR code with WhatsApp</p>
                    <div className="bg-white p-4 rounded-xl shadow-inner">
                      <img src={botStatus.qr} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                    </div>
                  </div>
                )}
                
                {botStatus?.connected && (
                  <div className="bg-green-900/30 text-green-400 px-4 py-3 rounded-lg border border-green-800/50 w-full text-center">
                    Bot is connected and ready to process messages.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
