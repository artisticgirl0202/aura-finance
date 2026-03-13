import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';
import Callback from './pages/Callback';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { AuthGate } from './components/ui/AuthGate';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/*" element={
            <AuthGate>
              <App />
            </AuthGate>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
