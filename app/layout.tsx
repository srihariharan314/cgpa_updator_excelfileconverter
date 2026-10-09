import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "ResultFlow",
  description: "Student result screenshot to verified academic report"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}