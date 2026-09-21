import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={
  title:'CAMINO · Centro Editorial',
  description:'Administración editorial de CAMINO',
  icons:{
    icon:'/centro-editorial-icon.png?v=20260921b',
    shortcut:'/centro-editorial-icon.png?v=20260921b',
  },
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
