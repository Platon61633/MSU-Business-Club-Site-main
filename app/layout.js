export const metadata = {
  title: 'Бизнес-клуб МГУ',
  description: 'Сайт Бизнес-клуба МГУ'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
