'use client';

import { useEffect, useState } from 'react';
import { fetchArchiveProjects } from '../../api';

export default function ProjectArchivesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchArchiveProjects({ page: 1, perPage: 12 })
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load archive projects');
        setLoading(false);
      });
  }, []);

  return (
    <div className="container mx-auto mt-20 p-4">
      <h1 className="text-2xl font-bold mb-4">Project Archives</h1>
      {loading && <p role="status">Loading…</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <div key={p.projectId} className="border rounded-lg p-4 shadow-sm bg-white">
            "use client";

            import { useEffect, useState } from "react";
            import { fetchArchiveProjects } from "../../api";

            export default function ProjectArchivesPage() {
              const [items, setItems] = useState([]);
              const [loading, setLoading] = useState(false);
              const [error, setError] = useState(null);

              useEffect(() => {
                setLoading(true);
                fetchArchiveProjects({ page: 1, perPage: 12 })
                  .then((data) => {
                    setItems(Array.isArray(data?.items) ? data.items : []);
                    setLoading(false);
                  })
                  .catch(() => {
                    setError("Failed to load archive projects");
                    setLoading(false);
                  });
              }, []);

              return (
                <div className="container mx-auto mt-20 p-4">
                  <h1 className="text-2xl font-bold mb-4">Project Archives</h1>
                  {loading && <p role="status">Loading…</p>}
                  {error && <p role="alert" className="text-red-600">{error}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((p) => (
                      <div key={p.projectId} className="border rounded-lg p-4 shadow-sm bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="font-semibold text-lg">{p.projectName || p.customerName}</h2>
                          'use client';

                          import { useEffect, useState } from "react";
                          import { fetchArchiveProjects } from "../../api";

                          export default function ProjectArchivesPage() {
                            const [items, setItems] = useState([]);
                            const [loading, setLoading] = useState(false);
                            const [error, setError] = useState(null);

                            useEffect(() => {
                              setLoading(true);
                              fetchArchiveProjects({ page: 1, perPage: 12 })
                                .then((data) => {
                                  setItems(Array.isArray(data?.items) ? data.items : []);
                                  setLoading(false);
                                })
                                .catch(() => {
                                  setError("Failed to load archive projects");
                                  setLoading(false);
                                });
                            }, []);

                            return (
                              <div className="container mx-auto mt-20 p-4">
                                <h1 className="text-2xl font-bold mb-4">Project Archives</h1>
                                {loading && <p role="status">Loading…</p>}
                                {error && <p role="alert" className="text-red-600">{error}</p>}

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {items.map((p) => (
                                    <div key={p.projectId} className="border rounded-lg p-4 shadow-sm bg-white">
                                      <div className="flex items-center justify-between mb-2">
                                        <h2 className="font-semibold text-lg">{p.projectName || p.customerName}</h2>
                                        {p.feocCompliant != null && (
                                          <span className={`text-xs px-2 py-1 rounded ${p.feocCompliant ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                            {p.feocCompliant ? "FEOC OK" : "FEOC Check"}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-600 mb-1">Project ID: {p.projectId}</div>
                                      {p.location && <div className="text-sm text-gray-600 mb-1">Location: {p.location}</div>}
                                      <div className="mt-2 text-sm">
                                        <div>System Size: {p.systemSize != null ? `${p.systemSize} kW` : "N/A"}</div>
                                        <div>Total Cost: {p.totalCost != null ? `$${p.totalCost.toLocaleString()}` : "N/A"}</div>
                                        <div>Domestic Content: {p.domesticContent != null ? `${p.domesticContent}%` : "N/A"}</div>
                                        <div>Tax Credit: {p.taxCreditAmount != null ? `$${p.taxCreditAmount.toLocaleString()}` : "N/A"}</div>
                                      </div>
                                      {Array.isArray(p.keyParts) && p.keyParts.length > 0 && (
                                        <div className="mt-3">
                                          <div className="font-semibold text-sm mb-1">Key Parts</div>
                                          <ul className="list-disc list-inside text-sm text-gray-700">
                                            {p.keyParts.map((k, i) => (
                                              <li key={i}>{k}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {p.completedDate && (
                                        <div className="mt-3 text-xs text-gray-500">Completed: {p.completedDate}</div>
                                      )}
                                      {p.status && <div className="mt-1 text-xs text-gray-500">Status: {p.status}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">⚠️ Challenges Overcome</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <ul className="text-sm space-y-1">
                      <li className="flex items-start">
                        <span className="text-yellow-500 mr-2">•</span>
                        {selectedProject.challenges}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <button className="flex-1 bg-[#053e7f] text-white py-3 rounded-lg hover:bg-[#042c5a] transition-colors font-medium">
                  Use as Template
                </button>
                <button className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium">
                  Export Details
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