"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchArchiveProjects } from '../../api';

export default function ProjectArchives() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const formatCurrency = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 'N/A';
    return `$${n.toLocaleString()}`;
  };

  const formatPercent = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 'N/A';
    return `${n}%`;
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
    // Prefetch FEOC route to make navigation instant
    try { router?.prefetch?.('/feoc-calculator'); } catch {}

    const loadProjects = async () => {
      try {
        setIsLoading(true);
        // Fetch a larger batch once to allow client-side pagination
        // Backend caps per_page at 50.
        const data = await fetchArchiveProjects({ page: 1, perPage: 50 });
        const source = data.items || data.projects || [];

        const normalized = source.map((project) => ({
          ...project,
          projectId: String(project.projectId || project.id || project.project_id || ''),
          customerName: String(project.customerName || project.name || project.projectName || project.projectName || ''),
          location: project.location || 'Unknown',
          status: project.status || 'completed',
          systemSize: project.systemSize != null ? String(project.systemSize) : '',
          totalCost: project.totalCost ?? null,
          domesticContent: project.domesticContent ?? null,
          feocCompliant: project.feocCompliant ?? null,
          completedDate: project.completedDate ?? null,
          keyParts: Array.isArray(project.keyParts) ? project.keyParts : [],
          successFactors: Array.isArray(project.successFactors) ? project.successFactors : [],
          challenges: project.challenges ?? '',
          complianceDetails: project.complianceDetails ?? null,
        }));

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
    loadProjects();
  }, []); // Run once on mount

  // Apply filters
  useEffect(() => {
    let filtered = projects.filter(project => {
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
        (filters.feocCompliant === 'compliant' && project.feocCompliant === true) ||
        (filters.feocCompliant === 'non-compliant' && project.feocCompliant === false);

      const totalCostNum = typeof project.totalCost === 'number' ? project.totalCost : Number(project.totalCost);
      const hasTotalCost = Number.isFinite(totalCostNum);

      const matchesPriceRange = filters.priceRange === 'all' ||
        (filters.priceRange === 'under-30k' && hasTotalCost && totalCostNum < 30000) ||
        (filters.priceRange === '30k-50k' && hasTotalCost && totalCostNum >= 30000 && totalCostNum <= 50000) ||
        (filters.priceRange === 'over-50k' && hasTotalCost && totalCostNum > 50000);

      return matchesSearch && matchesSystemSize && matchesProjectType && matchesFeoc && matchesPriceRange;
    });

    setFilteredProjects(filtered);
    setTotalPages(Math.ceil(filtered.length / PROJECTS_PER_PAGE));
    setCurrentPage(1);
  }, [filters, projects]);

  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE
  );

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setShowDetails(true);
  };

  const handleUseTemplate = () => {
    try {
      // Diagnostic to confirm click handler fired
      console.log('[Archives] Use as Template clicked');
      const designFromProject = selectedProject ? (() => {
        const items = (selectedProject.keyParts || []).map((part) => ({
          name: part.type,
          manufacturer: part.manufacturer || 'Unknown',
          type: part.type?.toLowerCase(),
          quantity: part.count ?? 1,
            unit_price: part.unit_price ?? null,
          matched_sku: part.sku ?? null,
          origin_country: part.domestic ? 'US' : 'CN',
          is_domestic: !!part.domestic,
        }));
        const component_count = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
        return {
          design_id: selectedProject.projectId,
          pricing_method: 'template',
          component_count,
          summary: `Template generated from archived project ${selectedProject.customerName}`,
          items,
        };
      })() : null;

      const payload = {
        project: selectedProject ? {
          projectId: selectedProject.projectId,
          customerName: selectedProject.customerName,
          projectType: selectedProject.projectType,
          location: selectedProject.location,
          completedDate: selectedProject.completedDate,
          systemSize: selectedProject.systemSize,
          totalCost: selectedProject.totalCost,
          profitMargin: selectedProject.profitMargin,
          domesticContent: selectedProject.domesticContent,
          taxCreditAmount: selectedProject.taxCreditAmount,
          feocCompliant: selectedProject.feocCompliant,
          maxNetOutput: (parseFloat(selectedProject.systemSize) / 1000) || null,
          constructionStartDate: selectedProject.constructionStartDate || null,
          prevailingWageCompliant: selectedProject.prevailingWageCompliant || false,
        } : null,
        design: designFromProject,
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('feocTemplate', JSON.stringify(payload));
      }
      // Navigate after ensuring localStorage write has completed
      setTimeout(() => {
        try {
          router.push('/feoc-calculator');
        } catch (navErr) {
          console.warn('[Archives] router.push failed, falling back to location.href', navErr);
          if (typeof window !== 'undefined') window.location.href = '/feoc-calculator';
        }
      }, 0);
    } catch (e) {
      console.error('Failed to set template for FEOC calculator', e);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading project archives...</p>
            <p className="text-[11px] text-gray-400 mt-2">Debug marker: dummy compliant card enabled</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#053e7f] mb-2">Project Archives</h1>
          <p className="text-gray-600">Reference past successful projects for feasibility analysis</p>
          <p className="text-[11px] text-gray-400">Debug marker: dummy compliant card enabled</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Filter Past Projects</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({...prev, searchTerm: e.target.value}))}
                placeholder="Customer, location, ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">System Size (kW)</label>
              <input
                type="number"
                value={filters.systemSize}
                onChange={(e) => setFilters(prev => ({...prev, systemSize: e.target.value}))}
                placeholder="e.g. 10"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
              <select
                value={filters.projectType}
                onChange={(e) => setFilters(prev => ({...prev, projectType: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">FEOC Compliance</label>
              <select
                value={filters.feocCompliant}
                onChange={(e) => setFilters(prev => ({...prev, feocCompliant: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Projects</option>
                <option value="compliant">FEOC Compliant</option>
                <option value="non-compliant">Non-Compliant</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
              <select
                value={filters.priceRange}
                onChange={(e) => setFilters(prev => ({...prev, priceRange: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Ranges</option>
                <option value="under-30k">Under $30k</option>
                <option value="30k-50k">$30k - $50k</option>
                <option value="over-50k">Over $50k</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  systemSize: '',
                  projectType: 'all',
                  feocCompliant: 'all',
                  priceRange: 'all',
                  searchTerm: ''
                })}
                className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center">
            <p className="text-gray-600">
              Showing {paginatedProjects.length} of {filteredProjects.length} projects
            </p>
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        </div>

        {/* Project Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {paginatedProjects.map((project) => (
            <div
              key={project.projectId}
              onClick={() => handleProjectSelect(project)}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer border-2 hover:border-blue-300"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{project.customerName}</h3>
                    <p className="text-sm text-gray-500">{project.location}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    project.feocCompliant === true
                      ? 'bg-green-100 text-green-800'
                      : project.feocCompliant === false
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`} title={`SI:${project.complianceDetails?.steelIronCompliant} MP:${project.complianceDetails?.manufacturedProductsCompliant} PE:${project.complianceDetails?.projectEligible}`}>
                    {project.feocCompliant === true ? 'FEOC ✓' : project.feocCompliant === false ? 'FEOC ✗' : 'FEOC ?'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">System Size</p>
                      <p className="font-semibold">{project.systemSize ? `${project.systemSize} kW` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Project Type</p>
                      <p className="font-semibold capitalize">{project.projectType}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Total Cost</p>
                      <p className="font-bold text-green-600">{formatCurrency(project.totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Profit Margin</p>
                      <p className="font-bold text-blue-600">{formatPercent(project.profitMargin)}</p>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="text-gray-500">Domestic Content</p>
                    {Number.isFinite(Number(project.domesticContent)) ? (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${Number(project.domesticContent) >= 40 ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${Math.min(Number(project.domesticContent), 100)}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{Number(project.domesticContent)}% domestic</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-600 mt-1">N/A</p>
                    )}
                  </div>

                  <div className="text-sm">
                    <p className="text-gray-500">Customer Tax Credit</p>
                    <p className="font-bold text-purple-600">{formatCurrency(project.taxCreditAmount)}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <button className="w-full bg-[#053e7f] text-white py-2 rounded-lg hover:bg-[#042c5a] transition-colors font-medium">
                    View Full Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mb-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors"
            >
              Previous
            </button>
            <span className="text-gray-600">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow">
            <div className="text-4xl mb-4">📂</div>
            <h3 className="text-xl font-semibold mb-2">No projects found</h3>
            <p className="text-gray-600">Try adjusting your filters to find relevant past projects</p>
          </div>
        )}
      </div>

      {showDetails && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProject.customerName}</h2>
                  <p className="text-gray-600">{selectedProject.location} • Completed {selectedProject.completedDate}</p>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Project Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">System Size:</span> {selectedProject.systemSize} kW</p>
                    <p><span className="font-medium">Type:</span> {selectedProject.projectType}</p>
                    <p><span className="font-medium">Total Cost:</span> {formatCurrency(selectedProject.totalCost)}</p>
                    <p><span className="font-medium">Project ID:</span> {selectedProject.projectId}</p>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">Financial Performance</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Profit Margin:</span> {formatPercent(selectedProject.profitMargin)}</p>
                    <p><span className="font-medium">Customer Tax Credit:</span> {formatCurrency(selectedProject.taxCreditAmount)}</p>
                    <p><span className="font-medium">Domestic Content:</span> {formatPercent(selectedProject.domesticContent)}</p>
                    <p><span className="font-medium">FEOC Status:</span> {selectedProject.feocCompliant === true ? 'Compliant' : selectedProject.feocCompliant === false ? 'Non-Compliant' : 'Unknown'}</p>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">Key Components</h3>
                  <div className="space-y-2 text-sm">
                    {(Array.isArray(selectedProject.keyParts) ? selectedProject.keyParts : []).map((part, index) => (
                      <p key={index}>
                        <span className="font-medium">{part.type}:</span> {part.count}x
                        <span className={`ml-1 ${part.domestic ? 'text-green-600' : 'text-red-600'}`}>
                          ({part.domestic ? 'Domestic' : 'Foreign'})
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">✅ Success Factors</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {(Array.isArray(selectedProject.successFactors) ? selectedProject.successFactors : []).length ? (
                      <ul className="text-sm space-y-1">
                        {(Array.isArray(selectedProject.successFactors) ? selectedProject.successFactors : []).map((factor, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-green-500 mr-2">•</span>
                            {factor}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">N/A</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">⚠️ Challenges Overcome</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <ul className="text-sm space-y-1">
                      <li className="flex items-start">
                        <span className="text-yellow-500 mr-2">•</span>
                        {selectedProject.challenges || 'N/A'}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUseTemplate(); }} className="flex-1 bg-[#053e7f] text-white py-3 rounded-lg hover:bg-[#042c5a] transition-colors font-medium">
                  Use as Template
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
