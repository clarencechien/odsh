import React from 'react';
import { createRoot } from 'react-dom/client';
import '../host.css';
function App(){return <main><header><small>ATLED ENGERGY / REACT CUSTOMER PORTAL</small><h1>您的能源服務週報</h1><p>報表透過 iframe 嵌入，可在宿主內獨立切換篩選。</p></header><iframe title="ATLED Engergy weekly report" sandbox="allow-scripts" src="../../report.html" /></main>}
createRoot(document.getElementById('root')).render(<App/>);
