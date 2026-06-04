import type { ReactNode } from 'react';
import './globals.css';
import GridProvider from '@/components/ag-grid-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <GridProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </GridProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}

