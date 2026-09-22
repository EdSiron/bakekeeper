import type { Metadata } from "next";
import { TimerProvider, FloatingTimer } from "@/context/TimerContext";

import "./globals.css";

export const metadata: Metadata = {
  title: "BakeKeeper",
  description: "A warm little recipe book",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#fff6e7",
          fontFamily: "'Mochibop', serif",
          margin: 0,
          padding: 0,
        }}
      >
        <TimerProvider>
          {children}
          <FloatingTimer />
        </TimerProvider>
      </body>
    </html>
  );
}