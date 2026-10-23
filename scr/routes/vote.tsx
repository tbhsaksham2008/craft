import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Vote } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InfoPage } from "@/components/site/InfoPage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { normalizeVotingUrl, type VotingSite } from "@/lib/voting-sites";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/vote")({
  head: () =>
    seo(
      "Vote",
      "Support Craft SMP by voting for the server on community listing sites.",
    ),
  component: VotePage,
});

function VotePage() {
  const [sites, setSites] = useState<VotingSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase
      .from("voting_sites")
      .select("id,name,url,description,enabled")
      .eq("enabled", true)
      .order("name")
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError(`Voting sites could not be loaded: ${queryError.message}`);
        } else {
          setSites((data ?? []) as VotingSite[]);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const safeSites = sites.flatMap((site) => {
    const url = normalizeVotingUrl(site.url);
    return url ? [{ ...site, url }] : [];
  });

  return (
    <InfoPage
      title="Vote for Craft SMP"
      sub="Enjoying your time on the server? Cast a vote on any of these community sites to help more players find us."
    >
      {!isSupabaseConfigured ? (
        <p className="rounded-2xl border bg-card p-6">
          Voting links are not available because the site database is not
          configured.
        </p>
      ) : loading ? (
        <p role="status" className="rounded-2xl border bg-card p-6">
          Loading voting sites…
        </p>
      ) : error ? (
        <p role="alert" className="rounded-2xl border border-destructive p-6 text-destructive">
          {error}
        </p>
      ) : safeSites.length ? (
        <ul className="!list-none !space-y-4 !pl-0">
          {safeSites.map((site) => (
            <li
              key={site.id}
              className="rounded-2xl border bg-card p-5 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky/50">
                    <Vote className="size-5" />
                  </span>
                  <div>
                    <h2 className="mt-0 text-xl font-semibold">{site.name}</h2>
                    {site.description && (
                      <p className="mt-1 text-sm">{site.description}</p>
                    )}
                  </div>
                </div>
                <Button asChild variant="hero">
                  <a href={site.url} target="_blank" rel="noopener noreferrer">
                    Vote now <ExternalLink />
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
          <Vote className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-xl font-semibold">Voting links coming soon</h2>
          <p className="mt-1">
            There are no voting sites configured right now. Check back later.
          </p>
        </div>
      )}
    </InfoPage>
  );
}
