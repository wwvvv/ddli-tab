import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DTab OS',
  description: '浏览器里的个人桌面：网址、官方应用、组件、相册与个性化外观。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
