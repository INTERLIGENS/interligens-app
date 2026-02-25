export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "fr" }];
}

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
