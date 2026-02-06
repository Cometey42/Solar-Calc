import { useEffect, useState } from 'react';

interface ComplianceDetails {
  domesticPercentage?: number;
  qualifiedParts?: Array<{ sku: string; name: string; isDomestic: boolean }>;
  notes?: string;
}

interface Project {
  projectId: string;
  projectName: string;
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
  created_at?: string;
  design_count?: number;
}

const PROJECTS_PER_PAGE = 12;

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        // Force fresh data by bypassing cache
        const response = await fetch('/api/archives/projects?_t=' + Date.now(), {
          headers: { 'Accept': 'application/json' }
        });        const data = await response.json();
        
        // Backend returns camelCase fields, no need to filter
        const projects = data.items || [];
        console.log('[ProjectsList] Loaded', projects.length, 'projects');
        setProjects(projects);
      } catch (e) {
        console.error('Failed to load projects', e);
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);
  // Filter projects
  const filteredProjects = projects.filter(project =>
    !searchTerm ||
    project.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.projectId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading projects...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">Projects List</h1>
          <p className="text-gray-600 dark:text-gray-400">Browse all solar installation projects</p>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search Projects
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or customer..."
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

        {/* Results Count */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center">
            <p className="text-gray-600 dark:text-gray-400">
              Showing {paginatedProjects.length} of {filteredProjects.length} projects
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        </div>        {/* Projects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {paginatedProjects.map((project) => (
            <div
              key={project.projectId}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 hover:border-blue-300 dark:hover:border-blue-600"
            >
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {project.projectName || project.customerName || 'Unnamed Project'}
                  </h3>
                  {project.customerName && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Customer: {project.customerName}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    ID: {project.projectId}
                  </p>
                  {project.design_count !== undefined && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {project.design_count} design{project.design_count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setSelectedProject(project);
                      setShowDetails(true);
                    }}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {paginatedProjects.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No projects found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? `No projects match "${searchTerm}"` : 'No projects available'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mb-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            <span className="text-gray-600 dark:text-gray-400">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Next
            </button>          </div>
        )}
      </div>      {/* Project Details Modal */}
      {showDetails && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedProject.customerName || selectedProject.projectName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">{selectedProject.location || 'Unknown Location'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedProject(null);
                  }}
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
              </div>

              {((Array.isArray(selectedProject.successFactors) && selectedProject.successFactors.length > 0) || 
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
              )}

              {/* Action Button */}
              <div className="mt-6">
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedProject(null);
                  }}
                  className="w-full bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
