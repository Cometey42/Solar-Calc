import { useEffect, useState } from 'react';
import { api } from '../../utils/api';

interface Stats {
  totalParts: number;
  totalProjects: number;
  totalComparisons: number;
  feocCompliantRate: number;
}

interface HealthStatus {
  status: string;
  database?: {
    status: string;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalParts: 0,
    totalProjects: 0,
    totalComparisons: 0,
    feocCompliantRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
        // Load health status
      const healthData = await api.getHealth();
      setHealth(healthData);      // Load basic stats (you can expand this based on your API)
      const parts = await api.getParts('', 1);
      const projectsData = await api.getProjects(1, 5); // Only load 5 projects for stats
      
      // Calculate FEOC compliance rate
      const projectsList = projectsData?.items || projectsData?.projects || [];
      const totalProjects = projectsList.length;
      const compliantProjects = projectsList.filter((p: { feocCompliant?: boolean | null; feoc?: boolean | null }) => 
        p.feocCompliant === true || p.feoc === true
      ).length;
      const feocCompliantRate = totalProjects > 0 
        ? Math.round((compliantProjects / totalProjects) * 100) 
        : 0;
      
      setStats({
        totalParts: parts?.total || 0,
        totalProjects: totalProjects,
        totalComparisons: 0, // Add comparisons count if available
        feocCompliantRate: feocCompliantRate,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Solar-Calc Admin Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage parts, run FEOC calculations, and view project archives
        </p>
      </div>

      {/* Main Solar Project Access */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              🌞 Main Solar Project Application
            </h2>
            <p className="text-blue-100 mb-4">
              Access the full solar calculation platform with all features
            </p>
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md"
            >
              Launch Solar Project
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <div className="text-white/80 text-sm bg-white/10 rounded-lg p-4 hidden md:block">
            <div className="font-semibold mb-2">Quick Access:</div>
            <div className="space-y-1 text-xs">
              <div>• Project Management</div>
              <div>• FEOC Calculator</div>
              <div>• Parts Catalog</div>
              <div>• Project Archives</div>
            </div>
          </div>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className={`p-4 rounded-lg ${
          health.status === 'healthy' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              health.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              System Status: {health.status}
            </h3>
          </div>
          {health.database && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Database: {health.database.status}
            </p>
          )}
        </div>
      )}

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Parts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Parts</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.totalParts.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Projects */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Projects</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.totalProjects.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* FEOC Compliance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">FEOC Compliant</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.feocCompliantRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Comparisons */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Comparisons</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.totalComparisons.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/feoc-calculator"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">FEOC Calculator</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Run compliance check</p>
            </div>
          </a>

          <a
            href="/parts"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-500 dark:hover:border-green-500 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Manage Parts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Add or edit parts</p>
            </div>
          </a>

          <a
            href="/project-archives"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-500 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">View Archives</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Browse past projects</p>
            </div>
          </a>
        </div>
      </div>

      {/* Integration Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-2">
          🚀 For Aurora Solar Developers
        </h2>
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
          <p><strong>Backend:</strong> Express server running on port 3000</p>
          <p><strong>Database:</strong> PostgreSQL with Prisma ORM</p>
          <p><strong>Setup:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>Install dependencies: <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">npm install</code></li>
            <li>Configure .env file with DATABASE_URL</li>
            <li>Run migrations: <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">npx prisma migrate dev</code></li>
            <li>Start backend: <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">npm run dev</code></li>
            <li>Start frontend: <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">npm run dev</code> (in this directory)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
