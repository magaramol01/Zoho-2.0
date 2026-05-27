import type { ReactNode } from 'react';
import './globals.css';
import GridProvider from '@/components/ag-grid-provider';
import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <GridProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </GridProvider>
      </body>
    </html>
  );
}
