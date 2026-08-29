import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Dashboard from './Dashboard.jsx';
import Widget from './Widget.jsx';

const isWidget = window.location.pathname.replace(/\/+$/, '') === '/widget';
if (isWidget) document.documentElement.classList.add('is-widget');
else document.documentElement.classList.add('is-dash', 'dark');
if (new URLSearchParams(window.location.search).get('native') === '1') {
  document.documentElement.classList.add('is-native');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>{isWidget ? <Widget /> : <Dashboard />}</StrictMode>,
);
