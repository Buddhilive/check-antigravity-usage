'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { QuotaData } from "@/lib/antigravity";

export default function Dashboard() {
  const { user, googleAccessToken, logout } = useAuth();
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!googleAccessToken) {
        setError("No Google Access Token found. Please sign in again and ensure you grant the required permissions.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // We fetch through our Next.js API Route to avoid CORS issues with internal Google APIs
        const response = await fetch('/api/quota', {
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch quota");
        }
        
        const data = await response.json();
        setQuota(data);
      } catch (err) {
        console.error("Failed to fetch Antigravity quota", err);
        setError(err instanceof Error ? err.message : "Failed to fetch quota");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user, googleAccessToken]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Antigravity Usage</h1>
            <p className="text-gray-500 text-sm">Welcome, {user?.displayName || user?.email}</p>
          </div>
          <button 
            onClick={logout}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
            <h3 className="font-semibold mb-1">Error Loading Quota</h3>
            <p>{error}</p>
          </div>
        ) : quota ? (
          <div className="grid gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Prompt Credits</h2>
              <div className="flex justify-between items-end mb-2">
                <span className="text-3xl font-bold text-blue-600">{quota.promptCredits.used}</span>
                <span className="text-gray-500 mb-1">/ {quota.promptCredits.monthly} used</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mt-4 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${
                    quota.promptCredits.percentage > 90 ? 'bg-red-500' : 
                    quota.promptCredits.percentage > 75 ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, quota.promptCredits.percentage)}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Model Quotas</h2>
              {quota.models.length === 0 ? (
                <p className="text-gray-500 italic">No model quota information available.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quota.models.map(model => (
                    <div key={model.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="font-medium text-gray-800">{model.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-gray-600">Remaining</span>
                        <span className="font-semibold text-gray-900">{model.remaining.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                         <div 
                           className={`h-full ${model.remaining < 10 ? 'bg-red-500' : 'bg-emerald-500'}`}
                           style={{ width: `${Math.max(0, Math.min(100, model.remaining))}%` }}
                         ></div>
                      </div>
                      {model.resetTime && (
                        <p className="text-xs text-gray-400 mt-2">Resets: {new Date(model.resetTime).toLocaleString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
