import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as Konsta } from 'konsta/react';
import './index.css';
import Dashboard from './Dashboard.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Konsta theme="ios">
      <Dashboard />
    </Konsta>
  </StrictMode>,
);
