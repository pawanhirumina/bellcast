import { redirect } from "next/navigation";
import { ConnectForm } from "@/components/connect-form";
import { isAuthenticated } from "@/lib/session";

export default async function ConnectPage() {
  if (await isAuthenticated()) redirect("/app");
  return <ConnectForm />;
}
