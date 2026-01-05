'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import CardManager with SSR disabled to avoid IndexedDB SSR issues
const CardManager = dynamic(() => import('./CardManager/page'), { ssr: false });

function App() {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-300">
      <CardManager />
    </div>
  );
}

export default App;