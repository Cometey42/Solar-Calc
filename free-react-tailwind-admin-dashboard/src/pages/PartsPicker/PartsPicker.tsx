import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../utils/api';

interface Part {
  sku: string;
  name: string;
  unit_price: number | null;
  origin_country: string;
  is_domestic: boolean;
  partType?: string;
}

interface TransformedPart extends Part {
  brand: string;
  price: number;
  domestic: boolean;
  manufacturer: string;
}

const PARTS_PER_PAGE = 6;

export default function PartsPicker() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterOrigin, setFilterOrigin] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [parts, setParts] = useState<TransformedPart[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Helper functions
  const extractBrand = (sku: string) => {
    if (!sku) return 'Unknown';
    const parts = sku.split(' ');
    return parts[0] || 'Unknown';
  };

  const mapOriginCountry = (country: string) => {
    const mapping: Record<string, string> = {
      'US': 'USA',
      'NONUS': 'Non-US',
      'UNKNOWN': 'Unknown Origin'
    };
    return mapping[country] || country || 'Unknown';
  };
  // Load all parts from backend
  useEffect(() => {
    const fetchAllParts = async () => {      try {
        setIsLoading(true);
        const response = await api.getParts('', 1000);
        
        // Response has 'items' array from /search endpoint
        const transformedParts: TransformedPart[] = (response.items || []).map((part: Part) => ({
          ...part,
          brand: extractBrand(part.sku),
          partType: part.partType || 'Unknown',
          price: part.unit_price || 0,
          domestic: part.is_domestic,
          manufacturer: mapOriginCountry(part.origin_country),
        }));

        setParts(transformedParts);
      } catch (error) {
        console.error('Failed to fetch parts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllParts();
  }, []);  // Live search with debouncing
  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) return;      try {
        setIsLoading(true);
        const response = await api.getParts(searchTerm, 100);
        
        // Response has 'items' array from /search endpoint
        const transformedParts: TransformedPart[] = (response.items || []).map((part: Part) => ({
          ...part,
          brand: extractBrand(part.sku),
          partType: part.partType || 'Unknown',
          price: part.unit_price || 0,
          domestic: part.is_domestic,
          manufacturer: mapOriginCountry(part.origin_country),
        }));

        setParts(transformedParts);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterOrigin]);

  // Filter parts
  const filteredParts = parts.filter(part => {
    const matchesType = filterType === 'all' || part.partType === filterType;
    const matchesOrigin = filterOrigin === 'all' ||
      (filterOrigin === 'domestic' && part.domestic) ||
      (filterOrigin === 'foreign' && !part.domestic);
    return matchesType && matchesOrigin;
  });

  // Pagination
  const totalPages = Math.ceil(filteredParts.length / PARTS_PER_PAGE);
  const paginatedParts = filteredParts.slice(
    (currentPage - 1) * PARTS_PER_PAGE,
    currentPage * PARTS_PER_PAGE
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading solar parts database...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-4">Parts Picker</h1>
          <p className="text-gray-600 dark:text-gray-400">Search and select solar parts for your project</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Parts
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, brand, SKU..."
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Part Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="Solar Panel">Solar Panel</option>
                <option value="Inverter">Inverter</option>
                <option value="Battery">Battery</option>
                <option value="Microinverter">Microinverter</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Origin
              </label>
              <select
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Origins</option>
                <option value="domestic">Domestic Only</option>
                <option value="foreign">Foreign Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-400">
            Showing {paginatedParts.length} of {filteredParts.length} parts
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>

        {/* Parts Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {paginatedParts.map((part) => (
            <div
              key={part.sku}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{part.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{part.sku}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  part.domestic
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {part.domestic ? 'Domestic' : 'Foreign'}
                </span>
              </div>              <div className="space-y-2 text-sm mb-4 text-gray-700 dark:text-gray-300">
                <p><span className="font-medium">Brand:</span> {part.brand}</p>
                <p><span className="font-medium">Type:</span> {part.partType}</p>
                <p><span className="font-medium">Price:</span> <span className="text-green-600 dark:text-green-400 font-bold">{part.price > 0 ? `$${part.price.toLocaleString()}` : 'N/A'}</span></p>
                <p><span className="font-medium">Made in:</span> {part.manufacturer}</p>
              </div>              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => navigate(`/parts/${encodeURIComponent(part.sku)}`)}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center font-semibold"
                >
                  View Details
                </button>
                <button
                  onClick={() => navigate(`/compare?mode=parts&sku=${part.sku}`)}
                  className="flex-1 bg-yellow-500 text-black py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors text-center font-semibold"
                >
                  Compare
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {paginatedParts.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No parts found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your filters</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
                setFilterOrigin('all');
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Pagination */}
        {filteredParts.length > PARTS_PER_PAGE && (
          <div className="flex justify-center items-center gap-4 mb-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <span className="text-gray-700 dark:text-gray-300">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
