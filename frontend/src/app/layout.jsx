import '../index.css';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';

export const viewport = {
  themeColor: "#004038",
};

export const metadata = {
  title: "SaathiAI — AI Career Companion for India's Vocational Graduates",
  description: "SaathiAI is a WhatsApp-native AI companion that meets every ITI and PMKVY graduate where they are — in Hindi, the moment training ends. Built for Shiksha Hackathon 2026.",
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: "SaathiAI — AI Career Companion for India's Vocational Graduates",
    description: "12 million graduates. No one to guide them. Until now. SaathiAI delivers AI career guidance via WhatsApp — no app, no English, no bureaucracy.",
    type: "website",
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
