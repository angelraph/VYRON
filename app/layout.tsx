import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/shared/auth-provider";
import { Web3Provider } from "@/components/shared/web3-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "VYRON — Every Goal. Executed.",
  description:
    "VYRON is an autonomous execution agent that turns one high-level goal into a coordinated network of specialized Agent Service Providers — planned, matched, escrowed, and delivered without you lifting a finger.",
  metadataBase: new URL("https://vyron.ai"),
  openGraph: {
    title: "VYRON — Every Goal. Executed.",
    description:
      "The autonomous COO for the agent economy. One goal in, a fully executed outcome out.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <Web3Provider>
            <TooltipProvider delayDuration={150}>
              {children}
              <Toaster richColors theme="dark" position="bottom-right" />
            </TooltipProvider>
          </Web3Provider>
        </AuthProvider>
      </body>
    </html>
  );
}
