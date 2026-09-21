import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'CAMINO · Centro Editorial',description:'Administración editorial de CAMINO'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
