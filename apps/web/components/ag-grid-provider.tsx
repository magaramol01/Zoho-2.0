'use client';

import { useEffect, type ReactNode } from 'react';
import { AgGridProvider } from 'ag-grid-react';
import { AllEnterpriseModule } from 'ag-grid-enterprise';

function isAgGridTrialLicenseMessage(args: unknown[]) {
  return args.some((arg) => {
    if (typeof arg !== 'string') {
      return false;
    }

    const message = arg.trim();
    return (
      /^\*+$/.test(message) ||
      message.includes('License Key Not Found') ||
      message.includes('For Trial Use Only') ||
      message.includes('features are unlocked for trial') ||
      message.includes('trial license key') ||
      message.includes('AG Grid Enterprise License')
    );
  });
}

export default function GridProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      if (isAgGridTrialLicenseMessage(args)) {
        return;
      }

      originalConsoleError(...args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  return (
    <AgGridProvider modules={[AllEnterpriseModule]}>
      {children}
    </AgGridProvider>
  );
}
