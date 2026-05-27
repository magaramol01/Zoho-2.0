'use client';

import type { ReactNode } from 'react';
import { AgGridProvider } from 'ag-grid-react';
import { AllEnterpriseModule } from 'ag-grid-enterprise';

export default function GridProvider({ children }: { children: ReactNode }) {
  return (
    <AgGridProvider
      modules={[AllEnterpriseModule]}
      licenseKey={process.env.NEXT_PUBLIC_AG_GRID_LICENSE_KEY}
    >
      {children}
    </AgGridProvider>
  );
}
