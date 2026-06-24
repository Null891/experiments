import "./globals.css";

export const metadata = {
  title: "The Mansion — R3F",
  description: "A walkable Roman/Victorian mansion of 75 experimental-website rooms.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
