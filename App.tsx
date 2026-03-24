import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InOut from './pages/InOut';
import ViewMovements from './pages/ViewMovements';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Config from './pages/Config';
import Audit from './pages/Audit';
import ViewAudit from './pages/ViewAudit';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'inout':
        return <InOut />;
      case 'inout_view':
        return <ViewMovements />;
      case 'inventory':
        return <Inventory />;
      case 'inventory_audit':
        return <Audit />;
      case 'inventory_view_audit':
        return <ViewAudit />;
      case 'reports':
        return <Reports />;
      case 'config':
        return <Config />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <DataProvider>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </Layout>
    </DataProvider>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;