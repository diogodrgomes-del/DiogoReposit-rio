import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "MARK SISTEM",
  description: "Sistema operacional da Agência Marktiva",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/*
          Tema aplicado antes da primeira pintura. Em <script> síncrono no head
          de propósito: em qualquer outro lugar a página pisca em branco antes
          de escurecer.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mark-tema');if(!t||t==='sistema'){t=matchMedia('(prefers-color-scheme: dark)').matches?'escuro':'claro'}document.documentElement.dataset.tema=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
