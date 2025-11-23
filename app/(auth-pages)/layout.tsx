// app/(auth-pages)/layout.tsx

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // nema max-w, nema flexa, nema ničeg što stišće
  return <div className="min-h-screen w-full">{children}</div>;
}
