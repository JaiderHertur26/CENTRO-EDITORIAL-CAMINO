import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Correo confirmado · CAMINO',
  description: 'Confirmación de correo para la cuenta CAMINO.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConfirmedEmailLayout({ children }: { children: ReactNode }) {
  return children;
}
