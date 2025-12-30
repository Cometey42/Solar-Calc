'use client';

import React from 'react';
import { useEffect, useState } from "react";
import { evaluateFeoc, fetchFEOCCalculatorData, fetchParts } from "../../api";

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
  });

  const [selectedParts, setSelectedParts] = useState([]);
  const [availableParts, setAvailableParts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feocResults, setFEOCResults] = useState(null);
  const [showAddPart, setShowAddPart] = useState(false);
  const [template, setTemplate] = useState(null);
  const [useSafeHarbor, setUseSafeHarbor] = useState(true);
  const [safeHarborPercents, setSafeHarborPercents] = useState(null);
  const [hasAutoRun, setHasAutoRun] = useState(false);

  const hasUnknownCompliance = Boolean(
    feocResults && (
      feocResults.steelIronCompliant == null ||
      feocResults.manufacturedProductsCompliant == null ||
      feocResults?.bonusEligibility?.eligible == null
    )
  );

  // Load available parts for selection
  useEffect(() => {
    const loadParts = async () => {
      try {
        setIsLoading(true);
        const { parts } = await fetchParts({ page: 1 });
        // Transform parts to include FEOC data
        const partsWithFEOC = parts.map(part => ({
          ...part,
          // Default FEOC values - in real implementation, this would come from your backend
          foreignContent: part.origin_country !== 'US' ? 100 : 0,
          isForeignEntity: part.origin_country !== 'US',
          feocClassification: part.origin_country === 'CN' ? 'China' : 
                           part.origin_country === 'US' ? 'Domestic' : 'Other Foreign'
        }));
        setAvailableParts(partsWithFEOC);
      } catch (error) {
        console.error('Failed to load parts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadParts();
  }, []);

  // Recalculate when Safe Harbor toggles or parts change (debounced)
  useEffect(() => {
    if (selectedParts.length === 0) return;
    const id = setTimeout(() => {
      void calculateFEOC();
    }, 250);
    return () => clearTimeout(id);
  }, [useSafeHarbor, safeHarborPercents, selectedParts]);

  // Load DOE safe harbor percentages from backend if available
  useEffect(() => {
    const loadSafeHarbor = async () => {
      try {
        const data = await fetchFEOCCalculatorData();
        if (data && data.safe_harbor) {
          setSafeHarborPercents(data.safe_harbor);
        }
      } catch (err) {
        console.warn('Safe harbor data not available; continuing with direct method');
      }
    };
    loadSafeHarbor();
  }, []);

  // Auto-run calculation when a template is present and parts are loaded
  useEffect(() => {
    if (template && selectedParts.length > 0 && !feocResults && !hasAutoRun) {
      void calculateFEOC();
      setHasAutoRun(true);
    }
  }, [template, selectedParts]);

  // Read template from Project Archives and prefill project + parts
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('feocTemplate') : null;
      if (!raw) return;
      const tpl = JSON.parse(raw);
      setTemplate(tpl);
      if (tpl.project) {
        setProjectData(prev => ({
          ...prev,
          projectName: tpl.project.customerName || prev.projectName,
          customerName: tpl.project.customerName || prev.customerName,
          projectType: tpl.project.projectType || prev.projectType,
          installationDate: tpl.project.completedDate || prev.installationDate,
          installationYear: tpl.project.completedDate ? new Date(tpl.project.completedDate).getFullYear() : prev.installationYear,
          totalSystemSize: tpl.project.systemSize ?? prev.totalSystemSize,
          maxNetOutput: tpl.project.maxNetOutput ?? prev.maxNetOutput,
          constructionStartDate: tpl.project.constructionStartDate ?? prev.constructionStartDate,
          prevailingWageCompliant: tpl.project.prevailingWageCompliant ?? prev.prevailingWageCompliant,
        }));
      }
      if (tpl.design?.items?.length) {
        const mapped = tpl.design.items.map((item) => ({
          name: item.name,
          manufacturer: item.manufacturer,
          type: item.type,
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? null,
          matched_sku: item.matched_sku,
          origin_country: item.origin_country || 'Unknown',
          feocClassification: item.origin_country === 'US' ? 'Domestic' : (item.origin_country === 'CN' ? 'China' : 'Other Foreign'),
          domesticContentPercentage: item.is_domestic ? 100 : 0,
          id: Date.now() + Math.random(),
        }));
        setSelectedParts(mapped);
      }
    } catch (e) {
      console.error('Failed to load template into FEOC calculator', e);
    }
  }, []);

  // Get domestic content requirements and eligibility based on IRS guidance
  const getDomesticContentRequirement = () => {
    const year = parseInt(projectData.installationYear) || new Date().getFullYear();
    
    // IRS escalating domestic content requirements for manufactured products
    let requiredDomestic = 40; // 2023-2024
    if (year >= 2025 && year <= 2026) requiredDomestic = 45;
    if (year >= 2027 && year <= 2028) requiredDomestic = 50;
    if (year >= 2029) requiredDomestic = 55;

    return {
      steelIronRequirement: 100, // All steel/iron must be 100% US manufactured
      manufacturedProductsRequirement: requiredDomestic,
      description: `Steel/Iron: 100% US | Manufactured Products: ${requiredDomestic}% domestic (${year})`
    };
  };

  // Check if project qualifies for full domestic content bonus
  const checkBonusEligibility = () => {
    const maxOutput = parseFloat(projectData.maxNetOutput) || 0;
    const constructionDate = new Date(projectData.constructionStartDate);
    const jan29_2023 = new Date('2023-01-29');

    // Three paths to full bonus eligibility:
    const smallProject = maxOutput < 1; // Less than 1MW
    const earlyConstruction = constructionDate < jan29_2023; // Started before Jan 29, 2023
    const prevailingWage = projectData.prevailingWageCompliant; // Meets prevailing wage requirements

    return {
      eligible: smallProject || earlyConstruction || prevailingWage,
      reasons: {
        smallProject,
        earlyConstruction,
        prevailingWage
      }
    };
  };

  // Calculate IRS-compliant domestic content bonus (backend-driven compliance)
  const calculateFEOC = async () => {
    if (selectedParts.length === 0) {
      alert('Please add parts to calculate domestic content bonus eligibility');
      return;
    }

    // Build evaluator items (send only what backend needs)
    const evalItems = selectedParts.map((part) => {
      const qty = part.quantity ?? 1;
      const unit = part.unit_price ?? part.unitPrice ?? null;
      const line = unit != null && qty != null ? Number(unit) * Number(qty) : null;
      return {
        name: part.name,
        type: part.type,
        quantity: qty,
        unit_price: unit,
        line_total: Number.isFinite(line) ? line : null,
        is_domestic: typeof part.is_domestic === 'boolean'
          ? part.is_domestic
          : (part.origin_country === 'US' ? true : part.origin_country === 'NONUS' ? false : null),
      };
    });

    let feocEval;
    try {
      feocEval = await evaluateFeoc({
        items: evalItems,
        project: {
          installationYear: projectData.installationYear,
          maxNetOutput: projectData.maxNetOutput,
          constructionStartDate: projectData.constructionStartDate,
          prevailingWageCompliant: projectData.prevailingWageCompliant,
        },
      });
    } catch (e) {
      console.error('FEOC evaluation failed', e);
      alert('FEOC evaluation failed. Make sure the backend is running and try again.');
      return;
    }

    const requirements = {
      steelIronRequirement: 100,
      manufacturedProductsRequirement: feocEval?.inputs?.requiredManufacturedDomesticPercent ?? getDomesticContentRequirement().manufacturedProductsRequirement,
      description: `Steel/Iron: 100% US | Manufactured Products: ${feocEval?.inputs?.requiredManufacturedDomesticPercent ?? getDomesticContentRequirement().manufacturedProductsRequirement}% domestic (${projectData.installationYear || new Date().getFullYear()})`
    };

    // Totals from selected parts for display + tax calculations
    const partBreakdown = selectedParts.map((part) => {
      const partTotalValue = (part.unit_price ?? 0) * (part.quantity ?? 1);
      return {
        ...part,
        partTotalValue,
      };
    });

    const totalValue = partBreakdown.reduce((acc, p) => acc + (p.partTotalValue || 0), 0);

    const steelIronValue = feocEval?.totals?.steel_total ?? 0;
    const steelIronDomesticValue = feocEval?.totals?.steel_domestic_total ?? 0;
    const steelIronDomesticPercentage = feocEval?.percentages?.steel_domestic_percent ?? null;
    const manufacturedProductsValue = feocEval?.totals?.manufactured_total ?? 0;
    const manufacturedProductsDomesticValue = feocEval?.totals?.manufactured_domestic_total ?? 0;
    let manufacturedProductsDomesticPercentage = feocEval?.percentages?.manufactured_domestic_percent ?? null;

    // Calculate labor costs (20% of equipment cost)
    const hasUnknownPricing = evalItems.some((x) => x.line_total == null);
    const laborCosts = hasUnknownPricing ? null : (totalValue * 0.20);
    const totalProjectCost = hasUnknownPricing ? null : (totalValue + laborCosts);

    // Compliance values (backend-driven; can be null if insufficient data)
    const steelIronCompliant = feocEval?.compliance?.steelIronCompliant ?? null;
    const manufacturedProductsCompliant = feocEval?.compliance?.manufacturedProductsCompliant ?? null;
    const bonusEligibility = {
      eligible: feocEval?.eligibility?.eligible ?? null,
      reasons: feocEval?.eligibility?.reasons ?? { smallProject: null, earlyConstruction: null, prevailingWage: null },
    };

    const domesticContentCompliant = steelIronCompliant === true && manufacturedProductsCompliant === true;

    // DOE Safe Harbor method: use default cost percentages instead of supplier direct cost
    if (useSafeHarbor && safeHarborPercents) {
      const categorize = (part) => {
        const name = (part.name || part.type || '').toLowerCase();
        if (name.includes('panel') || name.includes('module')) return 'modules';
        if (name.includes('inverter')) return 'inverters';
        if (name.includes('battery')) return 'batteries';
        if (name.includes('tracker')) return 'trackers';
        if (name.includes('racking') || name.includes('mount') || name.includes('rail')) return 'racking';
        return 'bos'; // balance of system / other manufactured products
      };

      let totalPercent = 0;
      let domesticPercent = 0;
      selectedParts.forEach((part) => {
        const cat = categorize(part);
        const pct = safeHarborPercents[cat] ?? 0;
        totalPercent += pct;
        const isDomestic = part.feocClassification === 'Domestic' || (part.domesticContentPercentage || 0) >= 100;
        if (isDomestic) domesticPercent += pct;
      });
      manufacturedProductsDomesticPercentage = totalPercent > 0 ? (domesticPercent / totalPercent) * 100 : manufacturedProductsDomesticPercentage;
    }

    // IRS Domestic Content Bonus Logic

    // Tax Credit Calculations (IRS Compliant)
    const baseITC = totalProjectCost == null ? null : (totalProjectCost * 0.30); // 30% base Investment Tax Credit
    const domesticContentBonus = (totalProjectCost == null)
      ? null
      : (domesticContentCompliant && bonusEligibility.eligible === true ? (totalProjectCost * 0.10) : 0); // 10% domestic content bonus
    const totalTaxCredit = (baseITC == null || domesticContentBonus == null) ? null : (baseITC + domesticContentBonus);

    // Residential Solar Credit (separate from ITC)
    let residentialCredit = null;
    if (projectData.projectType === 'residential') {
      const year = parseInt(projectData.installationYear) || new Date().getFullYear();
      let residentialRate = 0.30; // 30% through 2032
      if (year >= 2033) residentialRate = 0.26;
      if (year >= 2034) residentialRate = 0.22;
      if (year >= 2035) residentialRate = 0.10;

      residentialCredit = totalProjectCost == null ? null : (totalProjectCost * residentialRate);
    }

    setFEOCResults({
      partBreakdown,
      totalValue,
      laborCosts,
      totalProjectCost,
      steelIronValue,
      steelIronDomesticValue,
      steelIronDomesticPercentage,
      manufacturedProductsValue,
      manufacturedProductsDomesticValue,
      manufacturedProductsDomesticPercentage,
      requirements,
      bonusEligibility,
      // Compliance Status
      steelIronCompliant,
      manufacturedProductsCompliant,
      domesticContentCompliant,
      // Tax Credits (IRS Compliant)
      baseITC,
      domesticContentBonus,
      totalTaxCredit,
      residentialCredit,
      // Recommendations
      recommendations: generateIRSRecommendations(
        steelIronCompliant === true,
        manufacturedProductsCompliant === true,
        bonusEligibility,
        requirements,
        steelIronDomesticPercentage,
        manufacturedProductsDomesticPercentage
      )
    });
  };

  const generateIRSRecommendations = (steelCompliant, manufacturedCompliant, bonusEligible, requirements, steelPct, manufacturedPct) => {
    const recommendations = [];

    const fmtPct = (value) => {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return 'N/A';
      return `${n.toFixed(1)}%`;
    };
    
    // Eligibility Requirements
    if (bonusEligible?.eligible === false) {
      recommendations.push('🚨 PROJECT ELIGIBILITY: To qualify for the 10% domestic content bonus, this project must either be <1MW, have started construction before Jan 29, 2023, OR meet prevailing wage requirements.');
    }
    
    // Steel/Iron Compliance (100% requirement)
    if (steelCompliant === false) {
      recommendations.push(`🔧 STEEL/IRON: Replace foreign steel/iron components with 100% US manufactured alternatives (currently ${fmtPct(steelPct)}, need 100%)`);
    } else if (steelCompliant == null) {
      recommendations.push('ℹ️ STEEL/IRON: Insufficient data to determine steel/iron compliance (need domestic/foreign and cost data for steel/iron items).');
    }
    
    // Manufactured Products Compliance
    if (manufacturedCompliant === false) {
      recommendations.push(`⚡ MANUFACTURED PRODUCTS: Increase domestic content to ${requirements.manufacturedProductsRequirement}% for panels, inverters, batteries (currently ${fmtPct(manufacturedPct)})`);
    } else if (manufacturedCompliant == null) {
      recommendations.push('ℹ️ MANUFACTURED PRODUCTS: Insufficient data to determine manufactured products domestic content (need unit costs and origin/domestic flags).');
    }
    
    // DOE Safe Harbor Option
    if (manufacturedCompliant === false) {
      recommendations.push('📊 SAFE HARBOR OPTION: Consider using DOE default cost percentages instead of supplier direct cost data for easier compliance verification');
    }
    
    // Success Messages
    if (steelCompliant === true && manufacturedCompliant === true && bonusEligible?.eligible === true) {
      recommendations.push('✅ FULLY QUALIFIED: Project meets all requirements for the 10% domestic content bonus (40% total tax credit)!');
    } else if (steelCompliant === true && manufacturedCompliant === true) {
      recommendations.push('⚠️ CONTENT COMPLIANT: Domestic content requirements met, but check project eligibility criteria for full bonus');
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
      </main>
    );
  }

  const domesticReq = getDomesticContentRequirement();

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#053e7f] mb-2">IRS Domestic Content Bonus Calculator</h1>
          <p className="text-gray-600">30% Base ITC + 10% Domestic Content Bonus = 40% Total Tax Credit</p>
        </div>

        {template?.project && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">Template Loaded from Archives</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">Customer</p>
                <p className="font-semibold">{template.project.customerName}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">Location</p>
                <p className="font-semibold">{template.project.location}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">Project Type</p>
                <p className="font-semibold capitalize">{template.project.projectType}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">Project ID</p>
                <p className="font-semibold">{template.project.projectId}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">System Size (kW)</p>
                <p className="font-semibold">{template.project.systemSize}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">Total Cost</p>
                <p className="font-semibold">${template.project.totalCost?.toLocaleString?.() || template.project.totalCost}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">Profit Margin</p>
                <p className="font-semibold">{template.project.profitMargin}%</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">Domestic Content</p>
                <p className="font-semibold">{template.project.domesticContent}%</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">Customer Tax Credit</p>
                <p className="font-semibold">${template.project.taxCreditAmount?.toLocaleString?.() || template.project.taxCreditAmount}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-gray-600">FEOC Status</p>
                <p className="font-semibold">{template.project.feocCompliant ? 'Compliant' : 'Non-Compliant'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Project Information */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Project Information & IRS Eligibility</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Net Output (MW)</label>
              <input
                type="number"
                step="0.1"
                value={projectData.maxNetOutput}
                onChange={(e) => setProjectData(prev => ({...prev, maxNetOutput: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 0.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Installation Year</label>
              <input
                type="number"
                value={projectData.installationYear}
                onChange={(e) => setProjectData(prev => ({...prev, installationYear: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="2025"
                min="2023"
                max="2040"
              />
            </div>
          </div>
          
          {/* IRS Bonus Eligibility Criteria */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-blue-900">🎯 IRS Bonus Eligibility (Choose ONE)</h3>
            <p className="text-sm text-blue-700 mb-3">Project must meet domestic content requirements AND one of these criteria:</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium text-sm mb-2">📏 Small Project</h4>
                <p className="text-xs text-gray-600 mb-2">Less than 1MW maximum net output</p>
                <p className="text-sm font-semibold">
                  {(parseFloat(projectData.maxNetOutput) || 0) < 1 ? '✅ Qualifies' : '❌ Too large'}
                </p>
              </div>
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium text-sm mb-2">📅 Early Construction</h4>
                <input
                  type="date"
                  value={projectData.constructionStartDate}
                  onChange={(e) => setProjectData(prev => ({...prev, constructionStartDate: e.target.value}))}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                />
                <p className="text-xs text-gray-600">Started before Jan 29, 2023</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium text-sm mb-2">💼 Prevailing Wage</h4>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={projectData.prevailingWageCompliant}
                    onChange={(e) => setProjectData(prev => ({...prev, prevailingWageCompliant: e.target.checked}))}
                    className="mr-2"
                  />
                  <label className="text-sm">Meets IRA requirements</label>
                </div>
                <p className="text-xs text-gray-600">Prevailing wage & apprenticeship</p>
              </div>
            </div>
          </div>
          
          {/* Domestic Content Requirements */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-green-900">📊 Current Domestic Content Requirements</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium">🔧 Steel & Iron Components</h4>
                <p className="text-2xl font-bold text-green-600">100%</p>
                <p className="text-xs text-gray-600">All manufacturing processes must be in the US</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <h4 className="font-medium">⚡ Manufactured Products</h4>
                <p className="text-2xl font-bold text-green-600">{domesticReq.manufacturedProductsRequirement}%</p>
                <p className="text-xs text-gray-600">Panels, inverters, batteries ({projectData.installationYear})</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={useSafeHarbor} onChange={(e) => setUseSafeHarbor(e.target.checked)} />
                Use DOE Safe Harbor default cost percentages (Notice 2024-41)
              </label>
              {!safeHarborPercents && useSafeHarbor && (
                <p className="mt-1 text-[11px] text-gray-500">Safe harbor data not loaded from backend; using direct-cost method.</p>
              )}
            </div>
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
                <h3 className="font-semibold mb-3">Available Parts</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {availableParts.slice(0, 20).map((part) => (
                    <div key={part.sku} className="flex justify-between items-center p-3 bg-white rounded border">
                      <div className="flex-1">
                        <p className="font-medium">{part.name || part.sku}</p>
                        <p className="text-sm text-gray-600">
                          ${part.unit_price} | {part.feocClassification} | {part.foreignContent}% foreign
                        </p>
                      </div>
                      <button
                        onClick={() => addPartToProject(part)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Parts */}
            <div>
              <h3 className="font-semibold mb-3">Selected Components ({selectedParts.length})</h3>
              {selectedParts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No components selected. Add parts to begin dual-benefit analysis.</p>
              ) : (
                <div className="space-y-3">
                  {selectedParts.map((part) => (
                    <div key={part.id} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{part.name || part.sku}</h4>
                          <p className="text-sm text-gray-600 mb-2">
                            ${part.unit_price} each | {part.feocClassification}
                          </p>
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
                            <span className="text-sm">
                              Foreign Content: <span className={`font-semibold ${part.foreignContent > 25 ? 'text-red-600' : 'text-green-600'}`}>
                                {part.foreignContent}%
                              </span>
                            </span>
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
            </div>

            <div className="mt-6">
              <button
                onClick={calculateFEOC}
                disabled={selectedParts.length === 0}
                className="w-full bg-[#053e7f] text-white py-3 rounded-lg font-semibold hover:bg-[#042c5a] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Calculate Dual Benefits
              </button>
            </div>
          </div>

          {/* Enhanced Results Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">IRS Tax Credit Analysis</h2>
            
            {!feocResults ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-gray-500">Add components and calculate to see IRS domestic content bonus eligibility</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* IRS Compliance Status */}
                <div className={`p-4 rounded-lg border-2 ${
                  hasUnknownCompliance
                    ? 'bg-gray-100 border-gray-200'
                    : (feocResults.domesticContentCompliant && feocResults.bonusEligibility.eligible 
                      ? 'bg-green-100 border-green-200' 
                      : feocResults.domesticContentCompliant 
                        ? 'bg-yellow-100 border-yellow-200'
                        : 'bg-red-100 border-red-200')
                }`}>
                  <div className="text-center">
                    <span className="text-3xl">
                      {hasUnknownCompliance
                        ? '❔'
                        : (feocResults.domesticContentCompliant && feocResults.bonusEligibility.eligible ? '🎉' : 
                          feocResults.domesticContentCompliant ? '⚠️' : '❌')}
                    </span>
                    <h3 className="font-bold text-lg">
                      {hasUnknownCompliance
                        ? 'INSUFFICIENT DATA'
                        : (feocResults.domesticContentCompliant && feocResults.bonusEligibility.eligible 
                          ? 'FULLY QUALIFIED FOR BONUS' 
                          : feocResults.domesticContentCompliant 
                            ? 'CONTENT COMPLIANT - CHECK ELIGIBILITY'
                            : 'NOT COMPLIANT')}
                    </h3>
                    <p className="text-sm mt-1">
                      {hasUnknownCompliance
                        ? 'Add unit prices and domestic origin for all components'
                        : (feocResults.domesticContentCompliant && feocResults.bonusEligibility.eligible
                          ? '40% Total Tax Credit (30% Base + 10% Bonus)'
                          : '30% Base Tax Credit Only')}
                    </p>
                  </div>
                </div>

                {/* Tax Credit Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 text-center">30% Base ITC</h4>
                    <p className="text-2xl font-bold text-blue-600 text-center">
                      {feocResults.baseITC == null ? 'N/A' : `$${feocResults.baseITC.toLocaleString()}`}
                    </p>
                    <p className="text-xs text-center text-blue-600">Always Available</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${
                    (feocResults.domesticContentBonus || 0) > 0 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <h4 className="font-semibold text-center">10% Domestic Bonus</h4>
                    <p className={`text-2xl font-bold text-center ${
                      (feocResults.domesticContentBonus || 0) > 0 ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {feocResults.domesticContentBonus == null ? 'N/A' : `$${feocResults.domesticContentBonus.toLocaleString()}`}
                    </p>
                    <p className="text-xs text-center">
                      {feocResults.domesticContentBonus == null ? 'Unknown' : (feocResults.domesticContentBonus > 0 ? 'QUALIFIED' : 'Not Qualified')}
                    </p>
                  </div>
                </div>

                {/* Total Tax Credit */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border-2 border-blue-200">
                  <h3 className="font-bold text-center mb-2 text-xl">💰 TOTAL TAX CREDIT 💰</h3>
                  <p className="text-4xl font-bold text-center text-green-600">
                    {feocResults.totalTaxCredit == null ? 'N/A' : `$${feocResults.totalTaxCredit.toLocaleString()}`}
                  </p>
                  <p className="text-center text-sm text-gray-600 mt-2">
                    {(feocResults.totalTaxCredit == null || feocResults.totalProjectCost == null)
                      ? 'N/A'
                      : `${((feocResults.totalTaxCredit / feocResults.totalProjectCost) * 100).toFixed(0)}% of total project cost`}
                  </p>
                  {projectData.projectType === 'residential' && (
                    <div className="mt-4 p-3 bg-white rounded border">
                      <p className="text-sm text-center">
                        <strong>Residential Solar Credit:</strong> {feocResults.residentialCredit == null ? 'N/A' : `$${feocResults.residentialCredit.toLocaleString()}`}
                        <br />
                        <span className="text-xs text-gray-600">Separate from ITC - Available for homes</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Component Compliance Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border text-center ${
                    feocResults.steelIronCompliant == null
                      ? 'bg-gray-50 border-gray-200'
                      : (feocResults.steelIronCompliant 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200')
                  }`}>
                    <h4 className="font-semibold">🔧 Steel/Iron Components</h4>
                    <p className={`text-2xl font-bold ${
                      feocResults.steelIronCompliant == null ? 'text-gray-500' : (feocResults.steelIronCompliant ? 'text-green-600' : 'text-red-600')
                    }`}>
                      {feocResults.steelIronDomesticPercentage == null ? 'N/A' : `${feocResults.steelIronDomesticPercentage.toFixed(1)}%`}
                    </p>
                    <p className="text-xs">${feocResults.steelIronDomesticValue.toLocaleString()} / ${feocResults.steelIronValue.toLocaleString()}</p>
                    <p className="text-xs mt-1 font-medium">Need: 100% US</p>
                  </div>
                  <div className={`p-4 rounded-lg border text-center ${
                    feocResults.manufacturedProductsCompliant == null
                      ? 'bg-gray-50 border-gray-200'
                      : (feocResults.manufacturedProductsCompliant 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200')
                  }`}>
                    <h4 className="font-semibold">⚡ Manufactured Products</h4>
                    <p className={`text-2xl font-bold ${
                      feocResults.manufacturedProductsCompliant == null ? 'text-gray-500' : (feocResults.manufacturedProductsCompliant ? 'text-green-600' : 'text-red-600')
                    }`}>
                      {feocResults.manufacturedProductsDomesticPercentage == null ? 'N/A' : `${feocResults.manufacturedProductsDomesticPercentage.toFixed(1)}%`}
                    </p>
                    <p className="text-xs">${feocResults.manufacturedProductsDomesticValue.toLocaleString()} / ${feocResults.manufacturedProductsValue.toLocaleString()}</p>
                    <p className="text-xs mt-1 font-medium">Need: {feocResults.requirements.manufacturedProductsRequirement}%</p>
                  </div>
                </div>

                {/* Bonus Eligibility Status */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">🎯 Bonus Eligibility Check</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className={`p-2 rounded text-center ${
                      feocResults.bonusEligibility.reasons.smallProject ? 'bg-green-200' : 'bg-gray-200'
                    }`}>
                      Small Project: {feocResults.bonusEligibility.reasons.smallProject ? '✅' : '❌'}
                    </div>
                    <div className={`p-2 rounded text-center ${
                      feocResults.bonusEligibility.reasons.earlyConstruction ? 'bg-green-200' : 'bg-gray-200'
                    }`}>
                      Early Start: {feocResults.bonusEligibility.reasons.earlyConstruction ? '✅' : '❌'}
                    </div>
                    <div className={`p-2 rounded text-center ${
                      feocResults.bonusEligibility.reasons.prevailingWage ? 'bg-green-200' : 'bg-gray-200'
                    }`}>
                      Wage Compliant: {feocResults.bonusEligibility.reasons.prevailingWage ? '✅' : '❌'}
                    </div>
                  </div>
                </div>

                {/* Enhanced Recommendations */}
                <div>
                  <h4 className="font-semibold mb-3">Optimization Recommendations</h4>
                  <div className="space-y-2">
                    {feocResults.recommendations.map((rec, index) => (
                      <div key={index} className={`p-3 rounded border-l-4 ${
                        rec.includes('COMPANY') ? 'bg-green-50 border-green-500' :
                        rec.includes('CUSTOMER') ? 'bg-blue-50 border-blue-500' :
                        rec.includes('OPTIMAL') ? 'bg-yellow-50 border-yellow-500' :
                        'bg-gray-50 border-gray-500'
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