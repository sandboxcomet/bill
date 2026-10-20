import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import Shell from "@/components/Shell";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://bill.wonglao.com"),
  title: {
    default: "WongLao Bill — แบ่งบิลให้ลงตัว",
    template: "%s | WongLao Bill",
  },
  description:
    "ใครกินอะไร จ่ายเท่านั้น แบ่งบิลกับเพื่อน คำนวณยอดรายคน และแชร์ลิงก์โอนผ่าน PromptPay",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f7f6",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip-link" href="#content">
          ข้ามไปยังเนื้อหา
        </a>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
