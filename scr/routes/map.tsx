import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, Globe as Globe2, Info, Map as MapIcon, Maximize2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyIp } from "@/components/site/ServerStatus";
import { InfoPage } from "@/components/site/InfoPage";
import { Reveal } from "@/components/site/Reveal";
import { site } from "@/config/site";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/map")({
  head: () =>
    seo(
      "Live Map",
      "Explore the Craft SMP world in real time with our live server map.",
    ),
  component: LiveMapPage,
});

function LiveMapPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <InfoPage
      title="Live Server Map"
      sub="Explore our world in real time — see where players are building, explore landmarks, and find your next adventure spot."
    >
      <Tabs defaultValue="map" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="map">
            <MapIcon className="mr-1.5 size-4" /> Live map
          </TabsTrigger>
          <TabsTrigger value="legend">
            <Info className="mr-1.5 size-4" /> Legend
          </TabsTrigger>
          <TabsTrigger value="tips">
            <Globe2 className="mr-1.5 size-4" /> Tips
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map">
          <div className="mt-4">
            {site.mapUrl ? (
              <div className="relative overflow-hidden rounded-2xl border shadow-soft">
                {!loaded && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      <p className="text-sm text-muted-foreground">
                        Loading map…
                      </p>
                    </div>
                  </div>
                )}
                <iframe
                  src={site.mapUrl}
                  title="Craft SMP live map"
                  className="h-[70vh] w-full"
                  onLoad={() => setLoaded(true)}
                />
                <div className="flex items-center justify-between border-t bg-card px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Map updates in real time as players move and build.
                  </p>
                  <Button asChild variant="soft" size="sm">
                    <a
                      href={site.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Maximize2 className="mr-1.5 size-4" /> Open full screen
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border bg-card p-10 text-center shadow-soft">
                <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-brand">
                  <MapIcon className="size-8" />
                </div>
                <h3 className="text-2xl">Map coming soon</h3>
                <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                  The live map isn't configured yet. Once your server's Dynmap
                  or BlueMap URL is set, an interactive map will appear here
                  showing player locations and world landmarks in real time.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <CopyIp />
                  <Button asChild variant="hero">
                    <Link to="/store">
                      Browse the store <ExternalLink className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="legend">
          <div className="mt-4 space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
            <h3 className="text-xl">Map markers &amp; colors</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="size-4 rounded-full bg-primary" />
                <span className="text-sm">Online players — shown as colored dots</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="size-4 rounded-full bg-blush" />
                <span className="text-sm">Player heads — face icons when zoomed in</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="size-4 rounded-full bg-lilac" />
                <span className="text-sm">Landmark pins — notable builds and warps</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="size-4 rounded-full bg-sky" />
                <span className="text-sm">Spawn point — the world's central hub</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="size-4 rounded-full bg-success" />
                <span className="text-sm">Safe zones — no-mob areas around spawn</span>
              </li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="tips">
          <div className="mt-4 space-y-6 rounded-2xl border bg-card p-6 shadow-soft">
            <div>
              <h3 className="flex items-center gap-2 text-xl">
                <Globe2 className="size-5" /> Navigating the map
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
                <li>Click and drag to pan around the world.</li>
                <li>Use the scroll wheel or pinch to zoom in and out.</li>
                <li>Use the layer toggle to switch between surface, flat, and cave views.</li>
                <li>Click a player marker to see their name and current coordinates.</li>
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-xl">
                <Users className="size-5" /> Finding your friends
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
                <li>Player markers update every few seconds with real-time positions.</li>
                <li>Use the player list sidebar to jump directly to someone's location.</li>
                <li>Offline players disappear from the map until they rejoin.</li>
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-xl">
                <MapIcon className="size-5" /> Exploring landmarks
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
                <li>Look for labeled pins marking community builds and event sites.</li>
                <li>Some landmarks have clickable links that show a description.</li>
                <li>Use the coordinate display to navigate to a spot in-game.</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </InfoPage>
  );
}
