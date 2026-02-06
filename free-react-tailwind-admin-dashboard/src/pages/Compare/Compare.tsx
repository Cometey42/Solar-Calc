import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';

interface Part {
  sku: string;
  name: string;
  unit_price: number | null;
  origin_country: string;
  is_domestic: boolean;
  weight_kg: number | null;
}

interface ComparisonResult {
  selected_sku: string | null;
  category: string;
  items: Part[];
}

export default function Compare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());

  // Auto-load comparison if SKU is provided in URL
  useEffect(() => {
    const sku = searchParams.get('sku');
    const mode = searchParams.get('mode');
    
    if (sku && mode === 'parts') {
      setSearchInput(sku);
      performComparison(sku, 'sku');
    }
  }, [searchParams]);

  const performComparison = async (value: string, type: 'sku' | 'search') => {
    if (!value.trim()) {
      setError('Please enter a SKU or search term');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (type === 'sku') {
        params.append('sku', value.trim());
      } else {
        params.append('q', value.trim());
      }
      params.append('limit', '50');

      const response = await fetch(`/api/parts/compare?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch comparison: ${response.statusText}`);
      }
      
      const data: ComparisonResult = await response.json();
      setComparisonResult(data);
      setSelectedParts(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
      setComparisonResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    performComparison(searchInput, 'search');
  };

  const handleSkuSearch = () => {
    performComparison(searchInput, 'sku');
  };

  const togglePartSelection = (sku: string) => {
    const newSelection = new Set(selectedParts);
    if (newSelection.has(sku)) {
      newSelection.delete(sku);
    } else {
      newSelection.add(sku);
    }
    setSelectedParts(newSelection);
  };

  const formatPrice = (price: number | null) => {
    if (price === null || price === 0) return 'N/A';
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      panel: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Solar Panel' },
      inverter: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', label: 'Inverter' },
      battery: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Battery' },
      microinverter: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Microinverter' },
      other: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', label: 'Other' },
    };
    const badge = badges[category] || badges.other;
    return <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>;
  };

  const selectedPartsData = comparisonResult?.items.filter(part => selectedParts.has(part.sku)) || [];
  const totalPrice = selectedPartsData.reduce((sum, part) => sum + (part.unit_price || 0), 0);
  const avgPrice = selectedPartsData.length > 0 ? totalPrice / selectedPartsData.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">⚖️ Parts Comparison Tool</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Compare similar parts by SKU or search term to find the best pricing options
        </p>
      </div>

      {/* Search Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search for Parts
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter SKU or search term..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleSkuSearch}
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
              >
                By SKU
              </button>
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-semibold"
              >
                Search
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              💡 Use "By SKU" to find exact alternatives for a specific part, or "Search" to find similar parts by keywords
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">❌ {error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading comparison results...</p>
        </div>
      )}

      {/* Comparison Results */}
      {!isLoading && comparisonResult && (
        <>
          {/* Header Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Comparison Results
                </h2>
                <div className="flex items-center gap-4 text-sm">
                  {comparisonResult.selected_sku && (
                    <span className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Base SKU:</span> {comparisonResult.selected_sku}
                    </span>
                  )}
                  <span className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Category:</span> {getCategoryBadge(comparisonResult.category)}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Results:</span> {comparisonResult.items.length} parts
                  </span>
                </div>
              </div>
              {selectedParts.size > 0 && (
                <button
                  onClick={() => setSelectedParts(new Set())}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Selected Parts Summary */}
          {selectedParts.size > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
                📊 Selected Parts Summary ({selectedParts.size} parts)
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Price</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatPrice(totalPrice)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average Price</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatPrice(avgPrice)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Price Range</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {selectedPartsData.length > 0 ? (
                      <>
                        {formatPrice(Math.min(...selectedPartsData.map(p => p.unit_price || 0)))} - {formatPrice(Math.max(...selectedPartsData.map(p => p.unit_price || 0)))}
                      </>
                    ) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Parts Table */}
          {comparisonResult.items.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Select
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Origin
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {comparisonResult.items.map((part, index) => (
                      <tr
                        key={part.sku}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          selectedParts.has(part.sku) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        } ${part.sku === comparisonResult.selected_sku ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedParts.has(part.sku)}
                            onChange={() => togglePartSelection(part.sku)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-4 text-sm font-mono text-gray-900 dark:text-white">
                          {part.sku}
                          {part.sku === comparisonResult.selected_sku && (
                            <span className="ml-2 text-xs bg-yellow-200 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">BASE</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                          {part.name}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`font-semibold ${
                            index === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                          }`}>
                            {formatPrice(part.unit_price)}
                          </span>
                          {index === 0 && (
                            <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
                              LOWEST
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            part.is_domestic
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {part.is_domestic ? '🇺🇸 Domestic' : '🌍 Foreign'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                          {part.weight_kg ? `${part.weight_kg} kg` : 'N/A'}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <button
                            onClick={() => navigate(`/parts/${encodeURIComponent(part.sku)}`)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No matching parts found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Try a different SKU or search term
              </p>
            </div>
          )}
        </>
      )}

      {/* Initial Empty State */}
      {!isLoading && !comparisonResult && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">⚖️</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Ready to Compare Parts
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Enter a SKU or search term above to find and compare similar parts from your catalog
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p className="mb-2">💡 <strong>By SKU:</strong> Find exact alternatives for a specific part number</p>
            <p><strong>Search:</strong> Find similar parts by keywords (e.g., "solar panel", "inverter")</p>
          </div>
        </div>
      )}
    </div>
  );
}
