"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { compareParts, fetchProjects, fetchDesignDetails } from "../../api";

function ComparePageContent() {
  const searchParams = useSearchParams();
  const designIdParam = searchParams?.get('designId');
  const projectNameParam = searchParams?.get('projectName');
  const modeParam = searchParams?.get('mode');
  const skuParam = searchParams?.get('sku');
  const qParam = searchParams?.get('q');

  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [designDetails, setDesignDetails] = useState(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  const [partsCompare, setPartsCompare] = useState(null);
  const [partsCompareLoading, setPartsCompareLoading] = useState(false);
  const [partsCompareError, setPartsCompareError] = useState(null);

  const [filters, setFilters] = useState({
    systemSize: "",
    projectType: "all",
    feocCompliant: "all",
    priceRange: "all",
    searchTerm: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PROJECTS_PER_PAGE = 12;

  useEffect(() => {
    if (modeParam === 'parts') return;
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await fetchProjects({ page: currentPage, perPage: 50 });
        const source = data.items || [];
        const enhanced = source.map((project) => {
          const systemSize = project.systemSize ?? (Math.random() * 20 + 5).toFixed(1);
          const projectType = project.projectType ?? (Math.random() > 0.7 ? "commercial" : "residential");
          const domesticContent = project.domesticContent ?? Math.floor(Math.random() * 60 + 20);
          const keyParts = project.keyParts ?? [
            { type: "Solar Panels", count: Math.floor(Math.random() * 30 + 10), domestic: domesticContent > 50 },
            { type: "Inverter", count: Math.floor(Math.random() * 3 + 1), domestic: domesticContent > 40 },
            { type: "Racking", count: 1, domestic: domesticContent > 30 },
          ];
          const steelIronDomestic = keyParts.find((p) => p.type === "Racking")?.domestic || false;
          const feocCompliant = project.feocCompliant ?? (steelIronDomestic && domesticContent >= 45);
          return {
            projectId: project.project_id || project.projectId || `proj_${Math.random().toString(36).slice(2)}`,
            customerName: project.customerName || project.project_name || `Customer ${Math.floor(Math.random() * 1000)}`,
            location: project.location || "Unknown",
            systemSize,
            projectType,
            totalCost: (() => {
              const totalsSum = ((project.totals?.domestic_total ?? 0) + (project.totals?.non_domestic_total ?? 0) + (project.totals?.unknown_total ?? 0));
              const primary = (project.totalCost ?? totalsSum);
              return primary || Math.floor(Math.random() * 40000 + 20000);
            })(),
            profitMargin: project.profitMargin ?? (Math.random() * 15 + 10).toFixed(1),
            domesticContent,
            taxCreditAmount: project.taxCreditAmount ?? Math.floor(Math.random() * 20000 + 5000),
            completedDate: project.completedDate || new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            status: project.status || "completed",
            feocCompliant,
            keyParts,
            designs: project.designs || [],
            successFactors: project.successFactors || [
              "High domestic content achieved",
              "Early customer engagement",
              "Optimal part selection",
            ],
            challenges: project.challenges || "FEOC compliance verification",
          };
        });
        setProjects(enhanced);
        setFilteredProjects(enhanced);
        setTotalPages(Math.ceil(enhanced.length / PROJECTS_PER_PAGE));
      } catch (e) {
        console.error("Failed to load projects", e);
        setProjects([]);
        setFilteredProjects([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentPage]);

  // Parts comparison mode: /compare?mode=parts&sku=... or /compare?mode=parts&q=...
  useEffect(() => {
    const run = async () => {
      if (modeParam !== 'parts') return;
      if (!skuParam && !qParam) return;
      try {
        setPartsCompareLoading(true);
        setPartsCompareError(null);
        const data = await compareParts({ sku: skuParam || null, q: qParam || null, limit: 200 });
        setPartsCompare(data);
      } catch (e) {
        setPartsCompare(null);
        setPartsCompareError(e.message || 'Failed to compare parts');
      } finally {
        setPartsCompareLoading(false);
      }
    };
    void run();
  }, [modeParam, skuParam, qParam]);

  // Deep-link support from Parts Details: /compare?designId=...
  useEffect(() => {
    const run = async () => {
      if (!designIdParam) return;
      if (modeParam === 'parts') return;
      setShowDetails(true);
      setSelectedProject({
        customerName: projectNameParam || 'Selected Design',
        location: 'Unknown',
        completedDate: '',
        designs: [{ design_id: designIdParam }],
      });
      setDesignDetails(null);
      setDetailsError(null);
      try {
        setIsDetailsLoading(true);
        const details = await fetchDesignDetails(designIdParam);
        setDesignDetails(details);
      } catch (e) {
        console.error('Failed to fetch design details (deep-link)', e);
        setDetailsError('Failed to load design details');
      } finally {
        setIsDetailsLoading(false);
      }
    };
    void run();
  }, [designIdParam, projectNameParam]);

  const formatCurrency = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 'N/A';
    return `$${n.toLocaleString()}`;
  };

  if (modeParam === 'parts') {
    const selectedSku = partsCompare?.selected_sku || (skuParam || null);
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#053e7f] mb-2">Financing Compare</h1>
            <p className="text-gray-600">Compare similar parts side-by-side</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-700 text-sm">Selected SKU: <span className="font-mono">{selectedSku || 'N/A'}</span></p>
              {qParam && (
                <p className="text-gray-500 text-sm">Search: <span className="font-mono">{qParam}</span></p>
              )}
              {partsCompare?.category && (
                <p className="text-gray-500 text-sm">Category: {partsCompare.category}</p>
              )}
            </div>
            <button
              onClick={() => window.location.href = '/search-parts'}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Back to Search
            </button>
          </div>

          {partsCompareLoading && (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#053e7f] mx-auto mb-4" />
              <p className="text-gray-600">Loading comparison…</p>
            </div>
          )}
          {partsCompareError && (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-red-600">{partsCompareError}</p>
            </div>
          )}
          {partsCompare && !partsCompareLoading && (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">SKU</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Unit Price</th>
                    <th className="p-3 text-left">Origin</th>
                    <th className="p-3 text-left">Domestic?</th>
                    <th className="p-3 text-left">Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {(partsCompare.items || []).map((p) => (
                    <tr key={p.sku} className={p.sku === selectedSku ? 'border-t bg-blue-50' : 'border-t'}>
                      <td className="p-3 font-mono">{p.sku}</td>
                      <td className="p-3">{p.name || 'Unknown'}</td>
                      <td className="p-3">{formatCurrency(p.unit_price)}</td>
                      <td className="p-3">{p.origin_country || 'Unknown'}</td>
                      <td className="p-3">{p.is_domestic === true ? 'Yes' : p.is_domestic === false ? 'No' : 'Unknown'}</td>
                      <td className="p-3">{p.weight_kg ?? 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    );
  }

  useEffect(() => {
    let filtered = projects.filter((project) => {
      const matchesSearch =
        !filters.searchTerm ||
        project.customerName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        project.location.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        project.projectId.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const matchesSystemSize =
        !filters.systemSize ||
        (parseFloat(project.systemSize) >= parseFloat(filters.systemSize) - 2 &&
          parseFloat(project.systemSize) <= parseFloat(filters.systemSize) + 2);
      const matchesProjectType = filters.projectType === "all" || project.projectType === filters.projectType;
      const matchesFeoc =
        filters.feocCompliant === "all" ||
        (filters.feocCompliant === "compliant" && project.feocCompliant) ||
        (filters.feocCompliant === "non-compliant" && !project.feocCompliant);
      const matchesPriceRange =
        filters.priceRange === "all" ||
        (filters.priceRange === "under-30k" && project.totalCost < 30000) ||
        (filters.priceRange === "30k-50k" && project.totalCost >= 30000 && project.totalCost <= 50000) ||
        (filters.priceRange === "over-50k" && project.totalCost > 50000);
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

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setShowDetails(true);
    setDesignDetails(null);
    setDetailsError(null);
    const firstDesignId = project?.designs?.[0]?.design_id || project?.designs?.[0]?.id;
    if (firstDesignId) {
      try {
        setIsDetailsLoading(true);
        const details = await fetchDesignDetails(firstDesignId);
        setDesignDetails(details);
      } catch (e) {
        console.error("Failed to fetch design details", e);
        setDetailsError("Failed to load design details");
      } finally {
        setIsDetailsLoading(false);
      }
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading projects...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#053e7f] mb-2">Financing Compare</h1>
          <p className="text-gray-600">Filter and review comparable projects</p>
        </div>

        {/* Filters removed per request */}

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center">
            <p className="text-gray-600">Showing {paginatedProjects.length} of {filteredProjects.length} projects</p>
            <div className="text-sm text-gray-500">Page {currentPage} of {totalPages}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {paginatedProjects.map((project) => (
            <div
              key={project.projectId}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow border-2 hover:border-blue-300"
            >
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{project.customerName}</h3>
                  <p className="text-sm text-gray-700">Project Type: <span className="font-semibold capitalize">{project.projectType}</span></p>
                  <p className="text-sm text-gray-700">Project ID: <span className="font-mono">{project.projectId}</span></p>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <button onClick={() => handleProjectSelect(project)} className="w-full bg-[#053e7f] text-white py-2 rounded-lg hover:bg-[#042c5a] transition-colors font-medium">View Full Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mb-8">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors">Previous</button>
            <span className="text-gray-600">Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors">Next</button>
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
                <button onClick={() => setShowDetails(false)} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">✕</button>
              </div>
            </div>
             <div className="p-6">
              <div className="pt-4 border-t">
                {isDetailsLoading && <p className="text-gray-600">Loading design details…</p>}
                {detailsError && <p className="text-red-600">{detailsError}</p>}
                {designDetails && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2">Design Details</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded">
                        <p><span className="font-medium">Pricing Method:</span> {designDetails.pricing_method ?? 'N/A'}</p>
                        <p><span className="font-medium">Components:</span> {designDetails.component_count ?? 0}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p><span className="font-medium">Totals — Domestic:</span> ${designDetails.summary?.domestic_total ?? 'N/A'}</p>
                        <p><span className="font-medium">Totals — Non-Domestic:</span> ${designDetails.summary?.non_domestic_total ?? 'N/A'}</p>
                        <p><span className="font-medium">Totals — Unknown:</span> ${designDetails.summary?.unknown_total ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs border">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Manufacturer</th>
                            <th className="p-2 text-left">Type</th>
                            <th className="p-2 text-left">Qty</th>
                            <th className="p-2 text-left">SKU</th>
                            <th className="p-2 text-left">Unit</th>
                            <th className="p-2 text-left">Origin</th>
                            <th className="p-2 text-left">Domestic?</th>
                            <th className="p-2 text-left">Line</th>
                          </tr>
                        </thead>
                        <tbody>
                          {designDetails.items?.map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{item.name}</td>
                              <td className="p-2">{item.manufacturer}</td>
                              <td className="p-2">{item.type}</td>
                              <td className="p-2">{item.quantity}</td>
                              <td className="p-2">{item.matched_sku}</td>
                              <td className="p-2">{item.unit_price ?? 'N/A'}</td>
                              <td className="p-2">{item.origin_country ?? 'N/A'}</td>
                              <td className="p-2">{item.is_domestic ? 'Yes' : item.is_domestic === false ? 'No' : 'Unknown'}</td>
                              <td className="p-2">{item.line_total ?? 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t">
                <button onClick={() => setShowDetails(false)} className="w-full bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 transition-colors font-medium">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
//   useEffect(() => {
//     setLoading(true);
//     fetch(`${API_BASE_URL}/compare/projects?page=1&per_page=5&designs_per_project=2`)
//       .then((res) => res.json())
//       .then((data) => {
//         setProjects(data.items || []);
//         setLoading(false);
//       })
//       .catch((err) => {
//         setError("Failed to load projects");
//         setLoading(false);
//       });
//   }, []);

//   // Fetch details for a selected design
//   useEffect(() => {
//     if (!selectedDesign) return;
//     setLoading(true);
//     fetch(`${API_BASE_URL}/compare/${selectedDesign}`)
//       .then((res) => res.json())
//       .then((data) => {
//         setDesignDetails(data);
//         setLoading(false);
//       })
//       .catch((err) => {
//         setError("Failed to load design details");
//         setLoading(false);
//       });
//   }, [selectedDesign]);

//   return (
//     <main className="max-w-4xl mx-auto py-12 px-4">
//       <h1 className="text-3xl font-bold mb-6">Compare Projects & Designs</h1>
//       {loading && <p>Loading...</p>}
//       {error && <p className="text-red-600">{error}</p>}
//       <section className="mb-8">
//         <h2 className="text-xl font-semibold mb-2">Projects</h2>
//         {projects.length === 0 && !loading && <p>No projects found.</p>}
//         <ul className="space-y-4">
//           {projects.map((project) => (
//             <li key={project.project_id} className="border rounded p-4">
//               <div className="font-bold text-lg mb-1">{project.project_name}</div>
//               <div className="text-sm text-gray-500 mb-2">Project ID: {project.project_id}</div>
//               <div>
//                 <span className="font-semibold">Designs:</span>
//                 <ul className="ml-4 mt-2">
//                   {project.designs.map((design) => (
//                     <li key={design.design_id} className="mb-2">
//                       <button
//                         className="text-blue-700 underline mr-2"
//                         onClick={() => setSelectedDesign(design.design_id)}
//                       >
//                         {design.name}
//                       </button>
//                       <span className="text-xs text-gray-600">PPW: {design.ppw ?? "N/A"}, Base Price: ${design.base_system_price ?? "N/A"}</span>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//               <div className="mt-2">
//                 <span className="font-semibold">Totals:</span>
//                 <span className="ml-2 text-green-700">Domestic: ${project.totals?.domestic_total ?? "N/A"}</span>
//                 <span className="ml-2 text-red-700">Non-Domestic: ${project.totals?.non_domestic_total ?? "N/A"}</span>
//                 <span className="ml-2 text-gray-700">Unknown: ${project.totals?.unknown_total ?? "N/A"}</span>
//               </div>
//             </li>
//           ))}
//         </ul>
//       </section>
//       {designDetails && (
//         <section className="mt-8">
//           <h2 className="text-xl font-semibold mb-2">Design Details</h2>
//           <div className="mb-2">Design ID: {designDetails.design_id}</div>
//           <div className="mb-2">Pricing Method: {designDetails.pricing_method ?? "N/A"}</div>
//           <div className="mb-2">Price Per Watt: {designDetails.ppw ?? "N/A"}</div>
//           <div className="mb-2">Base System Price: ${designDetails.base_system_price ?? "N/A"}</div>
//           <div className="mb-2">Component Count: {designDetails.component_count ?? 0}</div>
//           <div className="mb-2">Incentives: {designDetails.incentives?.length ? designDetails.incentives.join(", ") : "None"}</div>
//           <h3 className="font-semibold mt-4 mb-2">Component Breakdown</h3>
//           <table className="w-full text-sm border">
//             <thead>
//               <tr className="bg-gray-100">
//                 <th className="p-2">Name</th>
//                 <th className="p-2">Manufacturer</th>
//                 <th className="p-2">Type</th>
//                 <th className="p-2">Quantity</th>
//                 <th className="p-2">SKU</th>
//                 <th className="p-2">Unit Price</th>
//                 <th className="p-2">Origin</th>
//                 <th className="p-2">Domestic?</th>
//                 <th className="p-2">Line Total</th>
//               </tr>
//             </thead>
//             <tbody>
//               {designDetails.items?.map((item, idx) => (
//                 <tr key={idx} className="border-t">
//                   <td className="p-2">{item.name}</td>
//                   <td className="p-2">{item.manufacturer}</td>
//                   <td className="p-2">{item.type}</td>
//                   <td className="p-2">{item.quantity}</td>
//                   <td className="p-2">{item.matched_sku}</td>
//                   <td className="p-2">{item.unit_price ?? "N/A"}</td>
//                   <td className="p-2">{item.origin_country ?? "N/A"}</td>
//                   <td className="p-2">{item.is_domestic ? "Yes" : item.is_domestic === false ? "No" : "Unknown"}</td>
//                   <td className="p-2">{item.line_total ?? "N/A"}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//           <div className="mt-4">
//             <span className="font-semibold">Totals:</span>
//             <span className="ml-2 text-green-700">Domestic: ${designDetails.summary?.domestic_total ?? "N/A"}</span>
//             <span className="ml-2 text-red-700">Non-Domestic: ${designDetails.summary?.non_domestic_total ?? "N/A"}</span>
//             <span className="ml-2 text-gray-700">Unknown: ${designDetails.summary?.unknown_total ?? "N/A"}</span>
//           </div>
//         </section>
//       )}
//     </main>
//   );
// }

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ComparePageContent />
    </Suspense>
  );
}