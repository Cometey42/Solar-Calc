'use client';

import React from 'react';
import { useEffect, useState, useCallback } from "react";
import { fetchFEOCCalculatorData, fetchParts } from "../../api";

// FEOC Countries - Currently designated Foreign Entities of Concern
// Per IRA Section 13501: Equipment from these countries prohibited for ITC eligibility
// Effective Date: January 1, 2026 for solar/wind equipment
// Note: List may be expanded by Secretary of Energy per national security assessments
const FEOC_COUNTRIES = ['CN', 'RU', 'KP', 'IR']; // China, Russia, North Korea, Iran

export default function FEOCCalculator() {
  const [projectData, setProjectData] = useState({
    projectName: '',
    totalSystemSize: '', // in kW
    installationDate: '',
    customerName: '',
    projectType: 'residential', // 'residential' or 'commercial'
    installationYear: new Date().getFullYear(),
    constructionStartDate: '', // for <Jan 29, 2023 eligibility
    prevailingWageCompliant: false, // for full bonus eligibility
    maxNetOutput: '' // in MW
  });  const [selectedParts, setSelectedParts] = useState([]);
  const [availableParts, setAvailableParts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feocResults, setFEOCResults] = useState(null);
  const [showAddPart, setShowAddPart] = useState(false);
  const [autoCalculateTriggered, setAutoCalculateTriggered] = useState(false);

  // Load template data from Project Archives if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const templateData = window.localStorage.getItem('feocTemplate');
      if (templateData) {
        try {
          const { project, design } = JSON.parse(templateData);
          console.log('[FEOC] Loading template from Project Archives:', { project, design });
          
          // Load project data
          if (project) {
            setProjectData(prev => ({
              ...prev,
              projectName: project.customerName || prev.projectName,
              totalSystemSize: project.systemSize || prev.totalSystemSize,
              customerName: project.customerName || prev.customerName,
              projectType: project.projectType || prev.projectType,
              installationYear: prev.installationYear, // Keep current year
              constructionStartDate: project.constructionStartDate || prev.constructionStartDate,
              prevailingWageCompliant: project.prevailingWageCompliant || prev.prevailingWageCompliant,
              maxNetOutput: project.maxNetOutput || prev.maxNetOutput,
            }));
          }
            // Load design parts with proper transformation
          if (design && Array.isArray(design.items) && design.items.length > 0) {
            const partsWithIds = design.items.map((item, index) => ({
              id: Date.now() + index, // Unique ID for each part
              name: item.name || item.manufacturer || 'Unknown Part',
              sku: item.matched_sku || item.sku || 'N/A',
              manufacturer: item.manufacturer || 'Unknown',
              type: item.type || 'component',
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              origin_country: item.origin_country || (item.is_domestic ? 'US' : 'UNKNOWN'),
              isFEOC: FEOC_COUNTRIES.includes(item.origin_country),
              isForeign: item.origin_country !== 'US',
            }));
            setSelectedParts(partsWithIds);
            setFEOCResults(null); // Clear previous results to allow re-calculation
            setAutoCalculateTriggered(true); // Trigger auto-calculation
            console.log('[FEOC] Loaded parts from template:', partsWithIds.length);
          }
          
          // Clear template after loading to prevent duplicate loads
          window.localStorage.removeItem('feocTemplate');
        } catch (error) {
          console.error('[FEOC] Failed to load template data:', error);
        }
      }
    }
  }, []); // Run once on mount
  // Load available parts for selection
  useEffect(() => {
    const loadParts = async () => {
      try {
        setIsLoading(true);
        const { parts } = await fetchParts({ page: 1, limit: 20 }); // Reduced from 50 to 20
        // Transform parts to include FEOC data
        const partsWithFEOC = parts.map(part => ({
          ...part,
          isFEOC: FEOC_COUNTRIES.includes(part.origin_country),
          isForeign: part.origin_country !== 'US',
          feocClassification: 
            FEOC_COUNTRIES.includes(part.origin_country) ? 'FEOC (Prohibited 2026+)' :
            part.origin_country === 'US' ? 'Domestic (US)' : 
            part.origin_country === 'UNKNOWN' ? 'Unknown Origin' :
            'Foreign (Non-FEOC)',
          countryName: 
            part.origin_country === 'CN' ? 'China' :
            part.origin_country === 'RU' ? 'Russia' :
            part.origin_country === 'KP' ? 'North Korea' :
            part.origin_country === 'IR' ? 'Iran' :
            part.origin_country === 'US' ? 'USA' :
            part.origin_country === 'KR' ? 'South Korea' :
            part.origin_country === 'NO' ? 'Norway' :
            part.origin_country === 'IL' ? 'Israel' :
            part.origin_country === 'IN' ? 'India' :
            part.origin_country || 'Unknown'
        }));
        setAvailableParts(partsWithFEOC);
      } catch (error) {
        console.error('Failed to load parts:', error);
      } finally {
        setIsLoading(false);
      }    };    loadParts();
  }, []);

  // Get FEOC compliance requirements (2026+: 0% FEOC allowed)
  const getFEOCRequirement = useCallback(() => {
    const year = parseInt(projectData.installationYear) || new Date().getFullYear();
    
    return {
      maxAllowedFEOC: year >= 2026 ? 0 : 100, // 0% FEOC allowed starting 2026
      year: year,
      description: year >= 2026 
        ? 'FEOC Prohibited: 0% from China, Russia, N.Korea, Iran' 
        : 'No FEOC Restrictions (Pre-2026)'    };  }, [projectData.installationYear]);

  // Calculate FEOC compliance (foreign content only)
  const calculateFEOC = useCallback(async () => {
    if (selectedParts.length === 0) {
      alert('Please add parts to calculate FEOC compliance');
      return;
    }

    try {
      // Prepare items for backend API
      const items = selectedParts.map(part => ({
        name: part.name,
        sku: part.sku,
        type: part.type || '',
        origin_country: part.origin_country,
        isDomestic: part.origin_country === 'US',
        line_total: (part.unit_price || 0) * (part.quantity || 1)
      }));      // Call backend FEOC evaluation endpoint
      const response = await fetch('http://localhost:3000/feoc/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items,
          installationYear: projectData.installationYear
        })
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const backendResults = await response.json();
      
      // Calculate labor costs (20% of equipment cost)
      const totalValue = backendResults.totals.total_project_cost;
      const laborCosts = totalValue * 0.20;
      const totalProjectCost = totalValue + laborCosts;

      const requirements = getFEOCRequirement();

      // Map backend results to frontend format
      setFEOCResults({
        // Keep original part details for display
        partBreakdown: selectedParts.map(part => {
          const partTotalValue = (part.unit_price || 0) * (part.quantity || 1);
          const FEOC_COUNTRIES = ['CN', 'RU', 'KP', 'IR'];
          const isSteelIron = ['racking', 'mounting', 'foundation', 'structural', 'rail', 'foot'].some(keyword => 
            (part.name || part.sku || '').toLowerCase().includes(keyword)
          );
          return {
            ...part,
            partTotalValue,
            category: isSteelIron ? 'Steel/Iron' : 'Manufactured Products',
            isFEOC: FEOC_COUNTRIES.includes(part.origin_country),
            isForeign: part.origin_country !== 'US'
          };
        }),
        totalValue,
        laborCosts,
        totalProjectCost,
        steelIronValue: backendResults.totals.steel_total,
        steelIronForeignValue: backendResults.totals.steel_foreign_total,
        steelIronFEOCValue: backendResults.totals.steel_feoc_total,
        steelIronForeignPercentage: backendResults.percentages.steel_foreign_percent || 0,
        steelIronFEOCPercentage: backendResults.percentages.steel_feoc_percent || 0,
        manufacturedProductsValue: backendResults.totals.manufactured_total,
        manufacturedProductsForeignValue: backendResults.totals.manufactured_foreign_total,
        manufacturedProductsFEOCValue: backendResults.totals.manufactured_feoc_total,
        manufacturedProductsForeignPercentage: backendResults.percentages.manufactured_foreign_percent || 0,
        manufacturedProductsFEOCPercentage: backendResults.percentages.manufactured_feoc_percent || 0,
        totalForeignPercentage: backendResults.percentages.total_foreign_percent || 0,
        totalFEOCPercentage: backendResults.percentages.total_feoc_percent || 0,
        totalFEOCCost: backendResults.totals.total_feoc_cost,
        requirements,
        feocCompliant: backendResults.compliance.feocCompliant,
        feocDetected: backendResults.compliance.feocDetected,
        feocParts: backendResults.compliance.feocParts,
        feocCountries: backendResults.compliance.feocCountries,
        recommendations: generateFEOCRecommendations(
          backendResults.compliance.feocCompliant,
          backendResults.compliance.feocDetected,
          backendResults.compliance.feocParts || [],
          requirements,
          backendResults.percentages.total_feoc_percent || 0
        )      });
    } catch (error) {
      console.error('Error calculating FEOC:', error);
      alert('Error calculating FEOC compliance. Please check the console for details.');    }
  }, [selectedParts, projectData.installationYear, getFEOCRequirement]);

  // Auto-calculate FEOC when template is loaded from Project Archives
  useEffect(() => {
    if (autoCalculateTriggered && selectedParts.length > 0 && !feocResults) {
      console.log('[FEOC] Auto-calculating compliance for loaded template...');
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        calculateFEOC();
        setAutoCalculateTriggered(false); // Reset flag
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoCalculateTriggered, selectedParts, feocResults, calculateFEOC]);

  const generateFEOCRecommendations = (feocCompliant, feocDetected, feocParts, requirements, totalFEOCPct) => {
    const recommendations = [];
    
    if (requirements.year < 2026) {
      recommendations.push('ℹ️ PRE-2026 PROJECT: FEOC restrictions not yet in effect. No compliance required.');
    }
    
    if (feocDetected && requirements.year >= 2026) {
      recommendations.push(`🚨 FEOC DETECTED: Project contains parts from prohibited countries (${totalFEOCPct.toFixed(1)}% of project value)`);
      
      const feocCountries = [...new Set(feocParts.map(p => {
        if (p.origin_country === 'CN') return 'China';
        if (p.origin_country === 'RU') return 'Russia';
        if (p.origin_country === 'KP') return 'North Korea';
        if (p.origin_country === 'IR') return 'Iran';
        return p.origin_country;
      }))];
      
      recommendations.push(`⚠️ PROHIBITED COUNTRIES: ${feocCountries.join(', ')}`);
      recommendations.push(`❌ ACTION REQUIRED: Replace all FEOC parts with 2026 AVL-approved alternatives (Hyundai, QCells, REC, Silfab, etc.)`);
    }
    
    if (feocCompliant && requirements.year >= 2026) {
      recommendations.push('✅ FEOC COMPLIANT: Project meets 2026+ requirements (0% from China, Russia, N.Korea, Iran)');
      recommendations.push('✅ AVL APPROVED: All parts eligible for 2026+ installations');
    }
    
    return recommendations;
  };

  const addPartToProject = (part) => {
    const newPart = {
      ...part,
      quantity: 1,
      id: Date.now() + Math.random() // Simple ID for tracking
    };
    setSelectedParts(prev => [...prev, newPart]);
  };

  const updatePartQuantity = (partId, quantity) => {
    setSelectedParts(prev => 
      prev.map(part => 
        part.id === partId 
          ? { ...part, quantity: parseInt(quantity) || 1 }
          : part
      )
    );
  };

  const removePartFromProject = (partId) => {
    setSelectedParts(prev => prev.filter(part => part.id !== partId));
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading FEOC Calculator...</p>
          </div>
        </div>
      </main>    );
  }

  const feocReq = getFEOCRequirement();

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#053e7f] mb-2">FEOC Compliance Calculator</h1>
          <p className="text-gray-600">2026+ Foreign Entity of Concern (FEOC) Compliance Checker</p>
        </div>        {/* Project Information */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Project Information & FEOC Compliance</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <input
                type="text"
                value={projectData.projectName}
                onChange={(e) => setProjectData(prev => ({...prev, projectName: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">System Size (kW)</label>
              <input
                type="number"
                value={projectData.totalSystemSize}
                onChange={(e) => setProjectData(prev => ({...prev, totalSystemSize: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 10.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Installation Year</label>
              <input
                type="number"
                value={projectData.installationYear}
                onChange={(e) => setProjectData(prev => ({...prev, installationYear: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="2026"
                min="2023"
                max="2040"
              />            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Parts Selection */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">System Components</h2>
              <button
                onClick={() => setShowAddPart(!showAddPart)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showAddPart ? 'Hide Parts' : 'Add Parts'}
              </button>
            </div>

            {showAddPart && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Available Parts</h3>                <div className="max-h-60 overflow-y-auto space-y-2">
                  {availableParts.slice(0, 20).map((part) => (
                    <div key={part.sku} className={`flex justify-between items-center p-3 rounded border ${
                      part.isFEOC ? 'bg-red-50 border-red-300' : 'bg-white'
                    }`}>
                      <div className="flex-1">
                        <p className="font-medium">{part.name || part.sku}</p>
                        <p className="text-sm text-gray-600">
                          ${part.unit_price} | {part.countryName} | {part.feocClassification}
                        </p>
                        {part.isFEOC && (
                          <p className="text-xs text-red-600 font-medium mt-1">⚠️ FEOC - Prohibited 2026+</p>
                        )}
                      </div>
                      <button
                        onClick={() => addPartToProject(part)}
                        className={`px-3 py-1 rounded transition-colors ${
                          part.isFEOC 
                            ? 'bg-red-600 text-white hover:bg-red-700' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}            {/* Selected Parts */}
            <div>
              <h3 className="font-semibold mb-3">Selected Components ({selectedParts.length})</h3>
              {selectedParts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No components selected. Add parts to check FEOC compliance.</p>
              ) : (
                <div className="space-y-3">
                  {selectedParts.map((part) => (
                    <div key={part.id} className={`p-4 border-2 rounded-lg ${
                      part.isFEOC ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{part.name || part.sku}</h4>
                          <p className="text-sm text-gray-600 mb-2">
                            ${part.unit_price} each | {part.countryName} ({part.origin_country})
                          </p>
                          {part.isFEOC && (
                            <p className="text-sm text-red-600 font-medium mb-2">
                              ⚠️ FEOC: {part.feocClassification}
                            </p>
                          )}
                          <div className="flex items-center gap-4">
                            <div>
                              <label className="text-sm text-gray-600">Quantity:</label>
                              <input
                                type="number"
                                min="1"
                                value={part.quantity}
                                onChange={(e) => updatePartQuantity(part.id, e.target.value)}
                                className="ml-2 w-16 px-2 py-1 border rounded text-center"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removePartFromProject(part.id)}
                          className="text-red-600 hover:text-red-800 font-bold text-lg"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>            <div className="mt-6">
              <button
                onClick={calculateFEOC}
                disabled={selectedParts.length === 0}
                className="w-full bg-[#053e7f] text-white py-3 rounded-lg font-semibold hover:bg-[#042c5a] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Check FEOC Compliance
              </button>
            </div>
          </div>          {/* FEOC Compliance Results Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">FEOC Compliance Results</h2>
            
            {!feocResults ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-500">Add components and check FEOC compliance for 2026+ requirements</p>
              </div>
            ) : (
              <div className="space-y-6">                {/* FEOC Compliance Status */}
                <div className={`p-4 rounded-lg border-2 ${
                  feocResults.feocCompliant 
                    ? 'bg-green-100 border-green-200' 
                    : 'bg-red-100 border-red-200'
                }`}>
                  <div className="text-center">
                    <span className="text-3xl">
                      {feocResults.feocCompliant ? '✅' : '❌'}
                    </span>
                    <h3 className="font-bold text-lg mt-2">
                      {feocResults.feocCompliant 
                        ? 'FEOC COMPLIANT' 
                        : 'FEOC DETECTED - NOT COMPLIANT'}
                    </h3>
                    <p className="text-sm mt-1">
                      {feocResults.feocCompliant
                        ? '✅ No parts from prohibited countries (CN, RU, KP, IR)'
                        : `⚠️ ${feocResults.totalFEOCPercentage.toFixed(1)}% of project from FEOC countries`}
                    </p>
                  </div>
                </div>

                {/* FEOC Parts Details */}
                {feocResults.feocDetected && feocResults.feocParts && (
                  <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                    <h4 className="font-semibold text-red-800 mb-3">⚠️ Prohibited FEOC Parts Detected</h4>
                    <div className="space-y-2">
                      {feocResults.feocParts.map((part, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border border-red-300">
                          <p className="font-medium">{part.name || part.sku}</p>
                          <p className="text-sm text-gray-600">
                            Origin: {part.countryName} ({part.origin_country}) | 
                            Category: {part.category} | 
                            Value: ${part.partTotalValue.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-red-600 font-medium mt-3">
                      💡 Replace these parts with 2026 AVL-approved alternatives
                    </p>
                  </div>
                )}

                {/* Project Cost Summary */}
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-semibold mb-3">Project Cost Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Equipment Cost:</span>
                      <span className="font-semibold">${feocResults.totalValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Labor Cost (20%):</span>
                      <span className="font-semibold">${feocResults.laborCosts.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-bold">Total Project Cost:</span>
                      <span className="font-bold text-lg">${feocResults.totalProjectCost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Foreign Content Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border text-center ${
                    feocResults.steelIronFEOCPercentage > 0
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <h4 className="font-semibold">🔧 Steel/Iron Components</h4>
                    <p className="text-xs text-gray-600 mb-2">Racking, mounting, structural</p>
                    <p className={`text-2xl font-bold ${
                      feocResults.steelIronFEOCPercentage > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {feocResults.steelIronFEOCPercentage.toFixed(1)}% FEOC
                    </p>
                    <p className="text-xs mt-1">${feocResults.steelIronFEOCValue.toLocaleString()} / ${feocResults.steelIronValue.toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-lg border text-center ${
                    feocResults.manufacturedProductsFEOCPercentage > 0
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <h4 className="font-semibold">⚡ Manufactured Products</h4>
                    <p className="text-xs text-gray-600 mb-2">Panels, inverters, batteries</p>
                    <p className={`text-2xl font-bold ${
                      feocResults.manufacturedProductsFEOCPercentage > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {feocResults.manufacturedProductsFEOCPercentage.toFixed(1)}% FEOC
                    </p>
                    <p className="text-xs mt-1">${feocResults.manufacturedProductsFEOCValue.toLocaleString()} / ${feocResults.manufacturedProductsValue.toLocaleString()}</p>
                  </div>                </div>

                {/* Recommendations */}
                <div>
                  <h4 className="font-semibold mb-3">📋 Compliance Recommendations</h4>
                  <div className="space-y-2">
                    {feocResults.recommendations.map((rec, index) => (
                      <div key={index} className={`p-3 rounded border-l-4 ${
                        rec.includes('✅') ? 'bg-green-50 border-green-500' :
                        rec.includes('🚨') ? 'bg-red-50 border-red-500' :
                        rec.includes('⚠️') ? 'bg-yellow-50 border-yellow-500' :
                        'bg-blue-50 border-blue-500'
                      }`}>
                        <p className="text-sm">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export Options */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const reportData = {
                        projectData,
                        selectedParts,
                        feocResults,
                        generatedAt: new Date().toISOString()
                      };
                      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `dual-benefit-report-${projectData.projectName || 'project'}.json`;
                      a.click();
                    }}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Export Report
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Print Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}