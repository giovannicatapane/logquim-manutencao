export const metadata = {
  title: "Logquim Manutenção",
  description: "Sistema de controle de manutenção e estoque",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
