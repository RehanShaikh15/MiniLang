import "./globals.css";

export const metadata = {
  title: "CompilerLab",
  description: "Interactive compiler inspector frontend demo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
