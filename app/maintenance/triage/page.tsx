import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { TriageDashboard } from "./triage-dashboard";

export default async function TriagePage() {
  const session = await getServerSession();

  if (!session?.user?.email?.endsWith("@highdesertpm.com")) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <TriageDashboard />
      </div>
    </main>
  );
}
