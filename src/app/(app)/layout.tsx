import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <Sidebar user={user} />
      <main className="px-4 py-5 md:ml-64 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
