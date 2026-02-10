import "./globals.css";
import React from "react";

export const metadata = { title: "Logquim Manutenção", description: "OS + Estoque + Produtividade" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
