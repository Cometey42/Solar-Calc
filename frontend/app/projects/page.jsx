'use client';

import React from 'react';
import { useEffect, useState } from "react";
import { fetchProjects, fetchDesignDetails } from "../../api";

export default function Projects() {
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [designLoading, setDesignLoading] = useState(false);
    const [projectsError, setProjectsError] = useState(null);
    const [designError, setDesignError] = useState(null);
    const [selectedDesign, setSelectedDesign] = useState(null);
    const [designDetails, setDesignDetails] = useState(null);

    useEffect(() => {
        setProjectsLoading(true);
        setProjectsError(null);
        fetchProjects({ page: 1, perPage: 10 })
            .then((data) => {
                setProjects(data.items || []);
                setProjectsLoading(false);
            })
            .catch((err) => {
                setProjectsError("Failed to load projects");
                setProjectsLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!selectedDesign) {
            setDesignDetails(null);
            return;
        }
        setDesignLoading(true);
        setDesignError(null);
        fetchDesignDetails(selectedDesign)
            .then((data) => {
                setDesignDetails(data);
                setDesignLoading(false);
            })
            .catch((err) => {
                setDesignError("Failed to load design details");
                setDesignLoading(false);
            });
    }, [selectedDesign]);

    // Helper function to format currency
    const formatCurrency = (amount) => {
        if (amount === null || amount === undefined || amount === "N/A") return "N/A";
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    return (
        <div className="container mx-auto mt-20 p-4 border rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-4" tabIndex="0">Projects</h1>
            <h2 className="sr-only">Project List</h2>
            {projectsLoading && <p role="status" aria-live="polite" tabIndex="0">Loading projects...</p>}
            {projectsError && <p className="text-red-600" role="alert" aria-live="assertive" tabIndex="0">{projectsError}</p>}
            <ul className="space-y-4" role="list">
                {projects.length === 0 && !projectsLoading && <li>No projects found.</li>}
                {projects.map((project) => (
                    <li key={project.project_id} className="border rounded p-4" role="listitem" tabIndex="0">
                        <div className="font-bold text-lg mb-1" tabIndex="0">{project.project_name}</div>
                        <div className="text-sm text-gray-500 mb-2">Project ID: {project.project_id}</div>
                        <div className="mt-2">
                            <span className="font-semibold">Totals:</span>
                            <span className="ml-2 text-green-700">Domestic: {formatCurrency(project.totals?.domestic_total)}</span>
                            <span className="ml-2 text-red-700">Non-Domestic: {formatCurrency(project.totals?.non_domestic_total)}</span>
                            <span className="ml-2 text-gray-700">Unknown: {formatCurrency(project.totals?.unknown_total)}</span>
                        </div>
                        {project.designs && project.designs.length > 0 && (
                            <div className="mt-4">
                                <span className="font-semibold">Designs:</span>
                                <ul className="ml-4 mt-2">
                                    {project.designs.map((design) => (
                                        <li key={design.design_id} className="mb-2">
                                            <button
                                                className="text-blue-700 underline mr-2"
                                                onClick={() => setSelectedDesign(design.design_id)}
                                                aria-label={`View design details for ${design.name} in ${project.project_name}`}
                                            >
                                                View {design.name}
                                            </button>
                                            <span className="sr-only">Press Enter to view details</span>
                                            <span className="text-xs text-gray-600">PPW: {design.ppw ?? "N/A"}, Base Price: {formatCurrency(design.base_system_price)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            {designLoading && <p role="status" aria-live="polite" className="mt-4">Loading design details...</p>}
            {designError && <p className="text-red-600 mt-4" role="alert" aria-live="assertive">{designError}</p>}
            {designDetails && (
                <div className="mt-8 border rounded-lg p-6 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Design Details</h2>
                        <button
                            onClick={() => setSelectedDesign(null)}
                            className="text-gray-500 hover:text-gray-700 text-xl"
                            aria-label="Close design details"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="mb-2">Design ID: {designDetails.design_id}</div>
                    <div className="mb-2">Pricing Method: {designDetails.pricing_method ?? "N/A"}</div>
                    <div className="mb-2">Price Per Watt: {designDetails.ppw ?? "N/A"}</div>
                    <div className="mb-2">Base System Price: {formatCurrency(designDetails.base_system_price)}</div>
                    <div className="mb-2">Component Count: {designDetails.component_count ?? 0}</div>
                    <h3 className="font-semibold mt-4 mb-2">Component Breakdown</h3>
                    <table className="w-full text-sm border">
                        <caption className="sr-only">Component breakdown showing details for each item in the design</caption>
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2">Name</th>
                                <th className="p-2">Manufacturer</th>
                                <th className="p-2">Type</th>
                                <th className="p-2">Quantity</th>
                                <th className="p-2">SKU</th>
                                <th className="p-2">Unit Price</th>
                                <th className="p-2">Origin</th>
                                <th className="p-2">Domestic?</th>
                                <th className="p-2">Line Total</th>
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
                                    <td className="p-2">{formatCurrency(item.unit_price)}</td>
                                    <td className="p-2">{item.origin_country ?? "N/A"}</td>
                                    <td className="p-2">{item.is_domestic ? "Yes" : item.is_domestic === false ? "No" : "Unknown"}</td>
                                    <td className="p-2">{formatCurrency(item.line_total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4">
                        <span className="font-semibold">Totals:</span>
                        <span className="ml-2 text-green-700">Domestic: {formatCurrency(designDetails.summary?.domestic_total)}</span>
                        <span className="ml-2 text-red-700">Non-Domestic: {formatCurrency(designDetails.summary?.non_domestic_total)}</span>
                        <span className="ml-2 text-gray-700">Unknown: {formatCurrency(designDetails.summary?.unknown_total)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}