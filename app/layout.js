import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://dump-archive.vercel.app"),
  title: "DUMP-ARCHIVE",
  description: "Where all kinds of images just get dumped in. (Literally a dump.)",
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://cdn.sanity.io" />
        <link rel="preconnect" href="https://eg4pfiee.api.sanity.io" />
      </head>
      <body className="is-intro-open">{children}</body>
    </html>
  );
}
