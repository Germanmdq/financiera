import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './styles.css';

export const metadata = { title: 'Cifra — Finanzas personales', description: 'Tu vida financiera explicada en lenguaje humano.' };

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="es"><body>{children}</body></html>;
}
