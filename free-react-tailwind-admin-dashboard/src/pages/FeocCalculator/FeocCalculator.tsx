import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../utils/api';

interface ProjectData {
  projectName: string;
  totalSystemSize: string;
  installationDate: string;
  customerName: string;
  projectType: string;
  installationYear: number;
  constructionStartDate: string;
  prevailingWageCompliant: boolean;
  maxNetOutput: string;
}

interface Part {
  id?: number;
  sku: string;
  name: string;
  type?: string;
  origin_country: string;
  unit_price: number;
  quantity?: number;
  isFEOC?: boolean;
  isForeign?: boolean;
  feocClassification?: string;
  countryName?: string;
}

interface SelectedPart extends Part {
  id: number;
  quantity: number;
}

interface FEOCRequirements {
  maxAllowedFEOC: number;
  year: number;
  description: string;
}

interface FEOCPartBreakdown extends Part {
  partTotalValue: number;
  category: string;
  isFEOC: boolean;
  isForeign: boolean;
}

interface FEOCResults {
  partBreakdown: FEOCPartBreakdown[];
  totalValue: number;
  laborCosts: number;
  totalProjectCost: number;
  steelIronValue: number;
  steelIronForeignValue: number;
  steelIronFEOCValue: number;
  steelIronForeignPercentage: number;
  steelIronFEOCPercentage: number;
  manufacturedProductsValue: number;
  manufacturedProductsForeignValue: number;
  manufacturedProductsFEOCValue: number;
  manufacturedProductsForeignPercentage: number;
  manufacturedProductsFEOCPercentage: number;
  totalForeignPercentage: number;
  totalFEOCPercentage: number;
  totalFEOCCost: number;
  requirements: FEOCRequirements;
  feocCompliant: boolean;
  feocDetected: boolean;
  feocParts: FEOCPartBreakdown[];
  feocCountries: string[];
  recommendations: string[];
}

export default function FeocCalculator() {
  const [searchParams] = useSearchParams();
  
  const [projectData, setProjectData] = useState<ProjectData>({
    projectName: '',
    totalSystemSize: '',
    installationDate: '',
    customerName: '',
    projectType: 'residential',
    installationYear: new Date().getFullYear(),
    constructionStartDate: '',
    prevailingWageCompliant: false,
    maxNetOutput: ''
  });
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feocResults, setFEOCResults] = useState<FEOCResults | null>(null);
  const [showAddPart, setShowAddPart] = useState(false);
  const [autoCalculateTriggered, setAutoCalculateTriggered] = useState(false);
  
  // Load project data from URL parameters if present
  useEffect(() => {
    const projectName = searchParams.get('projectName');
    const customerName = searchParams.get('customerName');
    const systemSize = searchParams.get('systemSize');
    const projectType = searchParams.get('projectType');
    const completedDate = searchParams.get('completedDate');
    
    if (projectName || customerName) {
      setProjectData(prev => ({
        ...prev,
        projectName: projectName || '',
        customerName: customerName || '',
        totalSystemSize: systemSize || '',
        projectType: projectType || 'residential',
        installationDate: completedDate || '',
        installationYear: completedDate ? new Date(completedDate).getFullYear() : new Date().getFullYear(),
      }));
      
      // Show notification that project was loaded
      console.log('Loaded project from archives:', projectName || customerName);
    }
    
    // Load parts from localStorage if available (from Project Archives)
    const templateData = localStorage.getItem('feocTemplate');
    if (templateData) {
      try {
        const { project, design } = JSON.parse(templateData);
        console.log('[FEOC] Loading template from localStorage:', { project, design });
        
        const FEOC_COUNTRIES = ['CN', 'RU', 'KP', 'IR'];
          // Load parts with proper transformation
        if (design && Array.isArray(design.items) && design.items.length > 0) {          const partsWithIds = design.items.map((item: { name?: string; manufacturer?: string; type?: string; sku?: string; matched_sku?: string; quantity?: number; unit_price?: number; origin_country?: string; is_domestic?: boolean }, index: number) => {
            const originCountry = item.origin_country || (item.is_domestic ? 'US' : 'UNKNOWN');
            return {
              id: Date.now() + index,
              name: item.name || item.manufacturer || 'Unknown Part',
              sku: item.matched_sku || item.sku || 'N/A',
              manufacturer: item.manufacturer || 'Unknown',
              type: item.type || 'component',
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              origin_country: originCountry,
              isFEOC: FEOC_COUNTRIES.includes(originCountry),
              isForeign: originCountry !== 'US',
              countryName: getCountryName(originCountry),
              feocClassification: getFEOCClassification(originCountry, FEOC_COUNTRIES),
            };
          });
          
          setSelectedParts(partsWithIds);
          setAutoCalculateTriggered(true);
          console.log('[FEOC] Loaded parts from template:', partsWithIds.length);
        }
        
        // Clear template after loading
        localStorage.removeItem('feocTemplate');
      } catch (error) {
        console.error('[FEOC] Failed to load template:', error);
      }
    }
  }, [searchParams]);

  // Load available parts
  useEffect(() => {
    loadParts();
  }, []);const loadParts = async () => {
    try {
      setIsLoading(true);
      // Load initial set of parts (20 for faster page load)
      const data = await api.getParts('', 20);
      
      // Response has 'items' array, not 'parts'
      const parts = data.items || [];
      
      const FEOC_COUNTRIES = ['CN', 'RU', 'KP', 'IR'];
      const partsWithFEOC = parts.map((part: Part) => ({
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
          part.origin_country === 'NONUS' ? 'Non-US' :
          part.origin_country || 'Unknown'
      }));
      
      setAvailableParts(partsWithFEOC);
      console.log(`Loaded ${partsWithFEOC.length} parts from backend`);
    } catch (error) {
      console.error('Failed to load parts:', error);
      alert('Failed to load parts. Please ensure the backend is running on port 3000.');
    } finally {
      setIsLoading(false);
    }
  };

  const getFEOCRequirement = () => {
    const year = parseInt(projectData.installationYear.toString()) || new Date().getFullYear();
    
    return {
      maxAllowedFEOC: year >= 2026 ? 0 : 100,
      year: year,      description: year >= 2026 
        ? 'FEOC Prohibited: 0% from China, Russia, N.Korea, Iran' 
        : 'No FEOC Restrictions (Pre-2026)'
    };
  };

  // Helper function to get country name
  const getCountryName = (countryCode: string): string => {
    const countryMap: Record<string, string> = {
      'CN': 'China',
      'RU': 'Russia',
      'KP': 'North Korea',
      'IR': 'Iran',
      'US': 'USA',
      'KR': 'South Korea',
      'NO': 'Norway',
      'IL': 'Israel',
      'IN': 'India',
      'NONUS': 'Non-US'
    };
    return countryMap[countryCode] || 'Unknown';
  };
  // Helper function to get FEOC classification
  const getFEOCClassification = (countryCode: string, FEOC_COUNTRIES: string[]): string => {
    if (FEOC_COUNTRIES.includes(countryCode)) return 'FEOC (Prohibited 2026+)';
    if (countryCode === 'US') return 'Domestic (US)';
    if (countryCode === 'UNKNOWN') return 'Unknown Origin';
    return 'Foreign (Non-FEOC)';
  };

  const calculateFEOC = useCallback(async () => {
    if (selectedParts.length === 0) {
      alert('Please add parts to calculate FEOC compliance');
      return;
    }

    try {
      const items = selectedParts.map(part => ({
        name: part.name,
        sku: part.sku,
        type: part.type || '',
        origin_country: part.origin_country,
        isDomestic: part.origin_country === 'US',
        line_total: (part.unit_price || 0) * (part.quantity || 1)
      }));

      const response = await fetch('/api/feoc/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          installationYear: projectData.installationYear
        })
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const backendResults = await response.json();
      
      const totalValue = backendResults.totals.total_project_cost;
      const laborCosts = totalValue * 0.20;
      const totalProjectCost = totalValue + laborCosts;
      const requirements = getFEOCRequirement();

      setFEOCResults({
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
        feocCountries: backendResults.compliance.feocCountries,        recommendations: generateFEOCRecommendations(
          backendResults.compliance.feocCompliant,
          backendResults.compliance.feocDetected,
          backendResults.compliance.feocParts || [],
          requirements,
          backendResults.percentages.total_feoc_percent || 0
        )      });    } catch (error) {
      console.error('Error calculating FEOC:', error);
      alert('Error calculating FEOC compliance. Please check the console for details.');
    }
  }, [selectedParts, projectData.installationYear, getFEOCRequirement]);

  // Auto-calculate when parts are loaded from template
  useEffect(() => {
    if (autoCalculateTriggered && selectedParts.length > 0 && !feocResults) {
      console.log('[FEOC] Auto-calculating compliance for loaded template...');
      setTimeout(() => {
        calculateFEOC();
        setAutoCalculateTriggered(false);
      }, 500);
    }
  }, [autoCalculateTriggered, selectedParts, feocResults, calculateFEOC]);
  
  const generateFEOCRecommendations = (
    feocCompliant: boolean, 
    feocDetected: boolean, 
    feocParts: FEOCPartBreakdown[], 
    requirements: FEOCRequirements, 
    totalFEOCPct: number
  ): string[] => {
    const recommendations: string[] = [];
    
    if (requirements.year < 2026) {
      recommendations.push('ℹ️ PRE-2026 PROJECT: FEOC restrictions not yet in effect. No compliance required.');
    }
    
    if (feocDetected && requirements.year >= 2026) {      recommendations.push(`🚨 FEOC DETECTED: Project contains parts from prohibited countries (${totalFEOCPct.toFixed(1)}% of project value)`);
      
      const feocCountries = [...new Set(feocParts.map((p: FEOCPartBreakdown) => {
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

  const addPartToProject = (part: Part) => {
    const newPart: SelectedPart = {
      ...part,
      quantity: 1,
      id: Date.now() + Math.random()
    };
    setSelectedParts(prev => [...prev, newPart]);
  };

  const updatePartQuantity = (partId: number, quantity: string) => {
    setSelectedParts(prev => 
      prev.map(part => 
        part.id === partId 
          ? { ...part, quantity: parseInt(quantity) || 1 }
          : part
      )
    );
  };

  const removePartFromProject = (partId: number) => {
    setSelectedParts(prev => prev.filter(part => part.id !== partId));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading FEOC Calculator...</p>
        </div>      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          FEOC Compliance Calculator
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          2026+ Foreign Entity of Concern (FEOC) Compliance Checker
        </p>
      </div>

      {/* Project Loaded Banner */}
      {searchParams.get('projectName') && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Project loaded from archives:</strong> {projectData.customerName || projectData.projectName}
                {projectData.totalSystemSize && ` - ${projectData.totalSystemSize} kW`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Project Information & FEOC Compliance
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectData.projectName}
              onChange={(e) => setProjectData(prev => ({...prev, projectName: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter project name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              System Size (kW)
            </label>
            <input
              type="number"
              value={projectData.totalSystemSize}
              onChange={(e) => setProjectData(prev => ({...prev, totalSystemSize: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g. 10.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Installation Year
            </label>
            <input
              type="number"
              value={projectData.installationYear}
              onChange={(e) => setProjectData(prev => ({...prev, installationYear: parseInt(e.target.value)}))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="2026"
              min={2023}
              max={2040}
            />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Parts Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Components</h2>
            <button
              onClick={() => setShowAddPart(!showAddPart)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showAddPart ? 'Hide Parts' : 'Add Parts'}
            </button>
          </div>

          {showAddPart && (
            <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Available Parts</h3>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {availableParts.slice(0, 20).map((part) => (
                  <div 
                    key={part.sku} 
                    className={`flex justify-between items-center p-3 rounded border ${
                      part.isFEOC 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{part.name || part.sku}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        ${part.unit_price} | {part.countryName} | {part.feocClassification}
                      </p>
                      {part.isFEOC && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                          ⚠️ FEOC - Prohibited 2026+
                        </p>
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
          )}

          {/* Selected Parts */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Selected Components ({selectedParts.length})
            </h3>
            {selectedParts.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No components selected. Add parts to check FEOC compliance.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedParts.map((part) => (
                  <div 
                    key={part.id} 
                    className={`p-4 border-2 rounded-lg ${
                      part.isFEOC 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' 
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">{part.name || part.sku}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          ${part.unit_price} each | {part.countryName} ({part.origin_country})
                        </p>
                        {part.isFEOC && (
                          <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
                            ⚠️ FEOC: {part.feocClassification}
                          </p>
                        )}
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="text-sm text-gray-600 dark:text-gray-400">Quantity:</label>
                            <input
                              type="number"
                              min={1}
                              value={part.quantity}
                              onChange={(e) => updatePartQuantity(part.id, e.target.value)}
                              className="ml-2 w-16 px-2 py-1 border rounded text-center dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removePartFromProject(part.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold text-lg"
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
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Check FEOC Compliance
            </button>
          </div>
        </div>

        {/* FEOC Results Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            FEOC Compliance Results
          </h2>
          
          {!feocResults ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-500 dark:text-gray-400">
                Add components and check FEOC compliance for 2026+ requirements
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* FEOC Compliance Status */}
              <div className={`p-4 rounded-lg border-2 ${
                feocResults.feocCompliant 
                  ? 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                  : 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-700'
              }`}>
                <div className="text-center">
                  <span className="text-3xl">
                    {feocResults.feocCompliant ? '✅' : '❌'}
                  </span>
                  <h3 className="font-bold text-lg mt-2 text-gray-900 dark:text-white">
                    {feocResults.feocCompliant 
                      ? 'FEOC COMPLIANT' 
                      : 'FEOC DETECTED - NOT COMPLIANT'}
                  </h3>
                  <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                    {feocResults.feocCompliant
                      ? '✅ No parts from prohibited countries (CN, RU, KP, IR)'
                      : `⚠️ ${feocResults.totalFEOCPercentage.toFixed(1)}% of project from FEOC countries`}
                  </p>
                </div>
              </div>

              {/* Project Cost Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Project Cost Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>Equipment Cost:</span>
                    <span className="font-semibold">${feocResults.totalValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>Labor Cost (20%):</span>
                    <span className="font-semibold">${feocResults.laborCosts.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                    <span className="font-bold text-gray-900 dark:text-white">Total Project Cost:</span>
                    <span className="font-bold text-lg text-gray-900 dark:text-white">
                      ${feocResults.totalProjectCost.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">📋 Compliance Recommendations</h4>
                <div className="space-y-2">
                  {feocResults.recommendations.map((rec, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded border-l-4 ${
                        rec.includes('✅') ? 'bg-green-50 dark:bg-green-900/20 border-green-500' :
                        rec.includes('🚨') ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                        rec.includes('⚠️') ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' :
                        'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                      }`}
                    >
                      <p className="text-sm text-gray-800 dark:text-gray-200">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
