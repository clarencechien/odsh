import React from 'react';
import { createRoot } from 'react-dom/client';
import '../host.css';
function App(){return <main><header><small>ATLED ENGERGY / REACT CUSTOMER PORTAL</small><h1>您的能源服務週報</h1><p>固定週期的能源決策文件，整合摘要、模型效益與下一週行動。</p></header><iframe title="ATLED Engergy weekly report" sandbox="allow-scripts" src="../../report.html" /></main>}
createRoot(document.getElementById('root')).render(<App/>);
