import { BrowserRouter as Router, Routes, Route } from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Dashboard from "./pages/Dashboard/Dashboard";
import FeocCalculator from "./pages/FeocCalculator/FeocCalculator";
import ProjectArchives from "./pages/ProjectArchives/ProjectArchives";
import SearchParts from "./pages/SearchParts/SearchParts";
import PartsPicker from "./pages/PartsPicker/PartsPicker";
import ProjectsList from "./pages/ProjectsList/ProjectsList";
import PartDetails from "./pages/PartDetails/PartDetails";
import PartsManagement from "./pages/PartsManagement/PartsManagement";
import Compare from "./pages/Compare/Compare";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route element={<AppLayout />}>
            <Route index path="/" element={<Dashboard />} />
            
            {/* Solar-Calc Pages */}
            <Route path="/feoc-calculator" element={<FeocCalculator />} />
            <Route path="/parts" element={<PartsManagement />} />
            <Route path="/parts-picker" element={<PartsPicker />} />
            <Route path="/search-parts" element={<SearchParts />} />
            <Route path="/project-archives" element={<ProjectArchives />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/parts/:id" element={<PartDetails />} />
            <Route path="/compare" element={<Compare />} />
          </Route>
          
          {/* Fallback Route */}
          <Route path="*" element={<div className="p-8 text-center"><h1 className="text-2xl font-bold">404 - Page Not Found</h1></div>} />
        </Routes>
      </Router>
    </>
  );
}
