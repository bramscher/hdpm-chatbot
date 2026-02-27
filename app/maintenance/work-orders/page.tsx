import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { WorkOrderDashboard } from "./work-order-dashboard";

export default async function WorkOrdersPage() {
  const session = await getServerSession();

  if (!session?.user?.email?.endsWith("@highdesertpm.com")) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <WorkOrderDashboard
          userEmail={session.user.email!}
          userName={session.user.name || ""}
        />
      </div>
    </main>
  );
}
