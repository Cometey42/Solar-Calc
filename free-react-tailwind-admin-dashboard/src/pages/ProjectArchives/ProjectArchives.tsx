import { useEffect, useState } from 'react';

interface ComplianceDetails {
  domesticPercentage?: number;
  qualifiedParts?: Array<{ sku: string; name: string; isDomestic: boolean }>;
  notes?: string;
}

interface Project {
  projectId: string;
  customerName: string;
  location: string;
  status: string;
  systemSize: string;
  totalCost: number | null;
  domesticContent: number | null;
  feocCompliant: boolean | null;
  feoc: boolean | null;
  completedDate: string | null;
  keyParts: Array<{ 
    type: string; 
    count: number; 
    domestic: boolean;
    name?: string;
    manufacturer?: string;
    sku?: string;
    matched_sku?: string;
    quantity?: number;
    unit_price?: number;
    origin_country?: string;
    is_domestic?: boolean;
  }>;
  successFactors: string[];
  challenges: string;
  complianceDetails: ComplianceDetails;
  projectType?: string;
}

export default function ProjectArchives() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const formatCurrency = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return `$${value.toLocaleString()}`;
  };

  const formatPercent = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return `${value}%`;
  };

  // Filters
  const [filters, setFilters] = useState({
    systemSize: '',
    projectType: 'all',
    feocCompliant: 'all',
    priceRange: 'all',
    searchTerm: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PROJECTS_PER_PAGE = 12;

  // Load archived projects
  useEffect(() => {
    loadProjects();
  }, []);
  const loadProjects = async () => {
    try {
      setIsLoading(true);
      
      // Force fresh data by bypassing cache
      const response = await fetch('/api/archives/projects?_t=' + Date.now(), {
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      const source = data.items || data.projects || data || [];const normalized: Project[] = source
        .map((project: Record<string, unknown>) => ({
          ...project,
          projectId: String(project.projectId || project.id || project.project_id || ''),
          customerName: String(project.customerName || project.name || project.projectName || ''),
          location: project.location || 'Unknown',
          status: project.status || 'completed',
          systemSize: project.systemSize != null ? String(project.systemSize) : '',
          totalCost: project.totalCost ?? null,
          domesticContent: project.domesticContent ?? null,
          feocCompliant: project.feocCompliant ?? project.feoc ?? null,
          feoc: project.feoc ?? project.feocCompliant ?? null,
          completedDate: project.completedDate ?? null,
          keyParts: Array.isArray(project.keyParts) ? project.keyParts : [],
          successFactors: Array.isArray(project.successFactors) ? project.successFactors : [],
          challenges: project.challenges ?? '',          complianceDetails: project.complianceDetails ?? null,        }));
        // TEMPORARY: Disable filter to see ALL projects
        // .filter((project: Project) => {
        //   const hasCustomerName = project.customerName && project.customerName.trim() !== '';
        //   const systemSizeNum = project.systemSize ? parseFloat(project.systemSize) : 0;
        //   const hasSystemSize = !isNaN(systemSizeNum) && systemSizeNum > 0;
        //   const hasTotalCost = typeof project.totalCost === 'number' && project.totalCost > 0;
        //   return hasCustomerName && (hasSystemSize || hasTotalCost);
        // });

      console.log('[ProjectArchives] Loaded', normalized.length, 'projects');
      setProjects(normalized);
      setFilteredProjects(normalized);
      setTotalPages(Math.ceil(normalized.length / PROJECTS_PER_PAGE));
    } catch (error) {
      console.error('Failed to load archived projects:', error);
      setProjects([]);
      setFilteredProjects([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };
  // Apply filters
  useEffect(() => {
    const filtered = projects.filter(project => {
      const matchesSearch = !filters.searchTerm ||
        project.customerName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        project.location.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        project.projectId.toLowerCase().includes(filters.searchTerm.toLowerCase());

      const matchesSystemSize = !filters.systemSize || (
        parseFloat(project.systemSize) >= parseFloat(filters.systemSize) - 2 &&
        parseFloat(project.systemSize) <= parseFloat(filters.systemSize) + 2
      );

      const matchesProjectType = filters.projectType === 'all' || project.projectType === filters.projectType;

      const matchesFeoc = filters.feocCompliant === 'all' ||
        (filters.feocCompliant === 'compliant' && (project.feocCompliant === true || project.feoc === true)) ||
        (filters.feocCompliant === 'noncompliant' && (project.feocCompliant === false || project.feoc === false));

      const matchesPrice = filters.priceRange === 'all' ||
        (filters.priceRange === 'low' && project.totalCost && project.totalCost < 50000) ||
        (filters.priceRange === 'medium' && project.totalCost && project.totalCost >= 50000 && project.totalCost < 100000) ||
        (filters.priceRange === 'high' && project.totalCost && project.totalCost >= 100000);

      return matchesSearch && matchesSystemSize && matchesProjectType && matchesFeoc && matchesPrice;
    });

    setFilteredProjects(filtered);
    setTotalPages(Math.ceil(filtered.length / PROJECTS_PER_PAGE));
    setCurrentPage(1);
  }, [filters, projects]);

  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE
  );

  const handleViewDetails = (project: Project) => {
    setSelectedProject(project);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedProject(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Project Archives</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View completed solar installation projects and their compliance details
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Search projects..."
            value={filters.searchTerm}
            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          />
          <input
            type="number"
            placeholder="System size (kW)"
            value={filters.systemSize}
            onChange={(e) => setFilters(prev => ({ ...prev, systemSize: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          />
          <select
            value={filters.projectType}
            onChange={(e) => setFilters(prev => ({ ...prev, projectType: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
          <select
            value={filters.feocCompliant}
            onChange={(e) => setFilters(prev => ({ ...prev, feocCompliant: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All FEOC</option>
            <option value="compliant">Compliant</option>
            <option value="noncompliant">Non-Compliant</option>
          </select>
          <select
            value={filters.priceRange}
            onChange={(e) => setFilters(prev => ({ ...prev, priceRange: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Prices</option>
            <option value="low">&lt; $50k</option>
            <option value="medium">$50k - $100k</option>
            <option value="high">&gt; $100k</option>
          </select>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredProjects.length} of {projects.length} projects
          </p>
          <button
            onClick={() => setFilters({
              systemSize: '',
              projectType: 'all',
              feocCompliant: 'all',
              priceRange: 'all',
              searchTerm: ''
            })}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Projects Found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {projects.length === 0 
              ? 'No archived projects available yet.'
              : 'Try adjusting your filters to see more results.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedProjects.map((project) => (
              <div
                key={project.projectId}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {project.customerName}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{project.location}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    project.feocCompliant === true || project.feoc === true
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : project.feocCompliant === false || project.feoc === false
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}>
                    {project.feocCompliant === true || project.feoc === true ? 'FEOC ✓' :
                     project.feocCompliant === false || project.feoc === false ? 'FEOC ✗' : 'FEOC ?'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">System Size:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {project.systemSize} kW
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(project.totalCost)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Domestic Content:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatPercent(project.domesticContent)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleViewDetails(project)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-900 dark:text-white">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Details Modal */}
      {showDetails && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedProject.customerName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">{selectedProject.location}</p>
                </div>
                <button
                  onClick={handleCloseDetails}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Project Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Project ID:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{selectedProject.projectId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">System Size:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{selectedProject.systemSize} kW</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedProject.totalCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Domestic Content:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatPercent(selectedProject.domesticContent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">FEOC Compliant:</span>
                      <span className={`font-semibold ${
                        selectedProject.feocCompliant === true || selectedProject.feoc === true
                          ? 'text-green-600 dark:text-green-400'
                          : selectedProject.feocCompliant === false || selectedProject.feoc === false
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {selectedProject.feocCompliant === true || selectedProject.feoc === true ? '✓ Yes' :
                         selectedProject.feocCompliant === false || selectedProject.feoc === false ? '✗ No' : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedProject.keyParts && selectedProject.keyParts.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Key Components</h3>
                    <div className="space-y-2">
                      {selectedProject.keyParts.map((part, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{part.type}:</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {part.count}x {part.domestic ? '(Domestic)' : '(Foreign)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>              {((Array.isArray(selectedProject.successFactors) && selectedProject.successFactors.length > 0) || 
                (selectedProject.challenges && selectedProject.challenges !== 'N/A')) && (
                <div className="mt-6 space-y-4">
                  {Array.isArray(selectedProject.successFactors) && selectedProject.successFactors.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Success Factors</h3>
                      <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {selectedProject.successFactors.map((factor, idx) => (
                          <li key={idx}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedProject.challenges && selectedProject.challenges !== 'N/A' && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Challenges</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedProject.challenges}</p>
                    </div>
                  )}
                </div>
              )}              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    // Store parts data in localStorage for FEOC Calculator
                    if (selectedProject.keyParts && selectedProject.keyParts.length > 0) {
                      const partsTemplate = {
                        project: {
                          customerName: selectedProject.customerName,
                          projectId: selectedProject.projectId,
                          systemSize: selectedProject.systemSize,
                          projectType: selectedProject.projectType,
                          totalCost: selectedProject.totalCost,
                          completedDate: selectedProject.completedDate,
                        },
                        design: {
                          items: selectedProject.keyParts.map((part) => ({
                            name: part.name || part.type,
                            type: part.type || 'component',
                            manufacturer: part.manufacturer || 'Unknown',
                            sku: part.sku || part.matched_sku || 'N/A',
                            matched_sku: part.matched_sku || part.sku || null,
                            quantity: part.quantity || part.count || 1,
                            unit_price: part.unit_price || 0,
                            origin_country: part.origin_country || 'UNKNOWN',
                            is_domestic: part.is_domestic || (part.origin_country === 'US'),
                          }))
                        }
                      };
                      localStorage.setItem('feocTemplate', JSON.stringify(partsTemplate));
                      console.log('[Archives] Stored FEOC template:', partsTemplate);
                    }
                    // Navigate to FEOC Calculator
                    window.location.href = `/feoc-calculator?projectName=${encodeURIComponent(selectedProject.projectId || selectedProject.customerName)}&customerName=${encodeURIComponent(selectedProject.customerName)}&systemSize=${encodeURIComponent(selectedProject.systemSize || '')}&projectType=${encodeURIComponent(selectedProject.projectType || 'residential')}&totalCost=${encodeURIComponent(selectedProject.totalCost || '')}&completedDate=${encodeURIComponent(selectedProject.completedDate || '')}`;
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center font-semibold"
                >
                  📊 Re-run FEOC Calculator
                </button>
                <button
                  onClick={handleCloseDetails}
                  className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
