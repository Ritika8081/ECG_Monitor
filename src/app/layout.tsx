import type { Metadata } from "next";
import "./globals.css";
import NavBar from '../components/NavBar';

export const metadata: Metadata = {
  title: "ECG Monitor",
  description: "ECG monitoring and analysis with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-hidden h-full">
      <body className="h-full overflow-hidden">
        <NavBar />
        <div className="pt-16 h-[100] overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
