import "./globals.css";

export const metadata = { title: "FilaVis", description: "Painel de gestão de filas de regulação" };

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
