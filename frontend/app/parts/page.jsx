"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchPartBySku } from '../../api';

export default function PartDetailsByQueryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sku = useMemo(() => (searchParams?.get('sku') ? String(searchParams.get('sku')) : ''), [searchParams]);

  const [part, setPart] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [matchStatus, setMatchStatus] = useState({ state: 'idle', message: null });

  const formatCurrency = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 'N/A';
    return `$${n.toLocaleString()}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        if (!sku) throw new Error('Missing SKU');
        const data = await fetchPartBySku(sku);
        setPart(data);
      } catch (e) {
        setError(e.message || 'Failed to load part');
        setPart(null);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [sku]);

  const handleOpenCompare = async () => {
    setMatchStatus({ state: 'loading', message: null });
    const qs = new URLSearchParams();
    qs.set('mode', 'parts');
    qs.set('sku', sku);
    router.push(`/compare?${qs.toString()}`);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#053e7f] mx-auto mb-4" />
          <p className="text-gray-600">Loading part…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-10">
          <div className="bg-white rounded-xl shadow p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Part Details</h1>
            <p className="text-red-600">{error}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => router.push('/search-parts')}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Back to Search
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-10">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{part?.name || 'Unnamed Part'}</h1>
              <p className="text-sm text-gray-600">SKU: <span className="font-mono">{part?.sku}</span></p>
            </div>
            <button
              onClick={() => router.push('/search-parts')}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Back
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 mb-2">Pricing</h2>
              <p className="text-sm"><span className="font-medium">Unit Price:</span> {formatCurrency(part?.unit_price)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 mb-2">Origin</h2>
              <p className="text-sm"><span className="font-medium">Origin Country:</span> {part?.origin_country || 'Unknown'}</p>
              <p className="text-sm"><span className="font-medium">Domestic:</span> {part?.is_domestic === true ? 'Yes' : part?.is_domestic === false ? 'No' : 'Unknown'}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleOpenCompare}
              disabled={matchStatus.state === 'loading'}
              className="bg-[#053e7f] text-white px-4 py-3 rounded-lg hover:bg-[#042c5a] disabled:opacity-60"
            >
              {matchStatus.state === 'loading' ? 'Opening…' : 'Compare Similar Parts'}
            </button>
            {matchStatus.message && (
              <p className={matchStatus.state === 'error' ? 'text-red-600 text-sm' : 'text-gray-700 text-sm'}>
                {matchStatus.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}