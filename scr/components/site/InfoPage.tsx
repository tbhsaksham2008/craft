import type { ReactNode } from "react";
import { PageHeader } from "./Reveal";

export function InfoPage({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string | undefined;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} sub={sub} />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl [&_h3]:mt-5 [&_h3]:text-lg [&_li]:text-muted-foreground [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </>
  );
}
