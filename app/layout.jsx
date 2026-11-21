import './globals.css';

export const metadata = {
  title: 'FMV · Local 3D viewer',
  description: 'Open and inspect local 3D models.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
