import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { api } from '../../utils/api';

interface Part {
  sku: string;
  name: string;
  unit_price: number | null;
  origin_country: string;
  is_domestic: boolean;
}

export default function PartDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sku = id || '';

  const [part, setPart] = useState<Part | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const formatCurrency = (value: number | string | null) => {
    if (value === null || value === undefined) return 'N/A';
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 'N/A';
    return `$${n.toLocaleString()}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        if (!sku) throw new Error('Missing SKU');        const data = await api.getPartBySku(sku);
        setPart(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load part');
        setPart(null);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [sku]);

  const handleOpenCompare = () => {
    navigate(`/compare?mode=parts&sku=${sku}`);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading part…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-10">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Part Details</h1>
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => navigate('/search-parts')}
                className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
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
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-10">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{part?.name || 'Unnamed Part'}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">SKU: <span className="font-mono">{part?.sku}</span></p>
            </div>
            <button
              onClick={() => navigate('/search-parts')}
              className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Back
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Pricing</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Unit Price:</span> {formatCurrency(part?.unit_price || 0)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Origin</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Origin Country:</span> {part?.origin_country || 'Unknown'}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Domestic:</span> {part?.is_domestic === true ? 'Yes' : part?.is_domestic === false ? 'No' : 'Unknown'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleOpenCompare}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Compare Similar Parts
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
