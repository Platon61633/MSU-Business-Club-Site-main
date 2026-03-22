export const metadata = {
  title: 'Бизнес-клуб МГУ',
  description: 'Сайт Бизнес-клуба МГУ'
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
