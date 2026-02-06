import { useEffect, useState, useCallback } from 'react';
import { api } from '../../utils/api';

interface Part {
  sku: string;
  name: string;
  unit_price: number | null;
  origin_country: string;
  is_domestic: boolean;
  weight_kg: number | null;
}

export default function PartsManagement() {
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('all');
  const [domesticFilter, setDomesticFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const filterParts = useCallback(() => {
    let filtered = parts;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(part =>
        part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Origin filter
    if (originFilter !== 'all') {
      filtered = filtered.filter(part => part.origin_country === originFilter);
    }

    // Domestic filter
    if (domesticFilter !== 'all') {
      const isDomestic = domesticFilter === 'domestic';
      filtered = filtered.filter(part => part.is_domestic === isDomestic);
    }

    setFilteredParts(filtered);
    setCurrentPage(1);
  }, [parts, searchTerm, originFilter, domesticFilter]);

  useEffect(() => {
    loadParts();
  }, []);

  useEffect(() => {
    filterParts();
  }, [filterParts]);
  const loadParts = async () => {
    try {
      setIsLoading(true);
      const response = await api.getParts('', 50); // Reduced from 100 to 50 for better performance
      const allParts = response.items || [];
      setParts(allParts);
      setFilteredParts(allParts);
    } catch (error) {
      console.error('Failed to load parts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueOrigins = Array.from(new Set(parts.map(p => p.origin_country))).sort();
  
  const totalPages = Math.ceil(filteredParts.length / ITEMS_PER_PAGE);
  const paginatedParts = filteredParts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getOriginLabel = (code: string) => {
    const labels: Record<string, string> = {
      'US': 'USA',
      'CN': 'China',
      'NONUS': 'Non-US',
      'UNKNOWN': 'Unknown',
      'KR': 'South Korea',
      'NO': 'Norway',
      'IN': 'India',
    };
    return labels[code] || code;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Parts Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Browse and manage your parts inventory - {filteredParts.length} parts
          </p>
        </div>
        <button
          disabled
          className="bg-gray-400 text-white px-6 py-3 rounded-lg cursor-not-allowed opacity-50"
          title="CRUD operations coming soon"
        >
          + Add New Part (Coming Soon)
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or SKU..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Origin Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Origin Country
            </label>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Origins</option>
              {uniqueOrigins.map(origin => (
                <option key={origin} value={origin}>
                  {getOriginLabel(origin)}
                </option>
              ))}
            </select>
          </div>

          {/* Domestic Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Domestic Status
            </label>
            <select
              value={domesticFilter}
              onChange={(e) => setDomesticFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Parts</option>
              <option value="domestic">Domestic Only</option>
              <option value="foreign">Foreign Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Parts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading parts...</p>
          </div>
        ) : filteredParts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No parts found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your filters or search terms
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Origin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Weight
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedParts.map((part) => (
                    <tr key={part.sku} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {part.sku}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {part.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {part.unit_price !== null ? `$${part.unit_price.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          part.origin_country === 'US' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          {getOriginLabel(part.origin_country)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          part.is_domestic
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                        }`}>
                          {part.is_domestic ? 'Domestic' : 'Foreign'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {part.weight_kg !== null ? `${part.weight_kg} kg` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => window.open(`/parts/${part.sku}`, '_blank')}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View
                        </button>
                        <button
                          disabled
                          className="text-gray-400 cursor-not-allowed"
                          title="Edit coming soon"
                        >
                          Edit
                        </button>
                        <button
                          disabled
                          className="text-gray-400 cursor-not-allowed"
                          title="Delete coming soon"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredParts.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredParts.length}</span> parts
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">CRUD Operations Coming Soon</p>
            <p>Add, Edit, and Delete functionality will be available once backend endpoints are implemented. For now, you can browse and view all parts in the catalog.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
