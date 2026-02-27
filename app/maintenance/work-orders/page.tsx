import { redirect } from "next/navigation";

/**
 * Work orders are now part of the Invoice Generator module.
 * Redirect any old bookmarks / links.
 */
export default function WorkOrdersPage() {
  redirect("/maintenance/invoices");
}
