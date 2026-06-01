'use client';

import type { ReactNode } from 'react';
import { AgGridProvider } from 'ag-grid-react';
import { AllCommunityModule } from 'ag-grid-community';

export default function GridProvider({ children }: { children: ReactNode }) {
  return (
    <AgGridProvider modules={[AllCommunityModule]}>
      {children}
    </AgGridProvider>
  );
}
