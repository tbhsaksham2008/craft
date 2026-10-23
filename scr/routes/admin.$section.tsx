import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminPage, isAdminSection } from "@/routes/admin";

export const Route = createFileRoute("/admin/$section")({
  beforeLoad: ({ params }) => {
    if (!isAdminSection(params.section)) {
      throw redirect({ to: "/admin" });
    }
  },
  component: AdminSectionPage,
});

function AdminSectionPage() {
  const { section } = Route.useParams();
  const initialSection = isAdminSection(section) ? section : "overview";
  return <AdminPage key={section} initialSection={initialSection} />;
}
