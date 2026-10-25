import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoPage } from "@/components/site/InfoPage";
import { copyAddress } from "@/components/site/ServerStatus";
import { site } from "@/config/site";
import { seo } from "@/lib/seo";

const communityHighlights = [
  {
    icon: MessageCircle,
    title: "Meet players",
    description:
      "Say hello in-game, find people to build with, and make space for new players.",
  },
  {
    icon: Swords,
    title: "Play together",
    description:
      "Team up for survival, explore the world, and join community activities when they are announced.",
  },
  {
    icon: ShieldCheck,
    title: "Keep it fair",
    description:
      "Follow the server rules, respect other players, and report problems through the available support channels.",
  },
  {
    icon: HeartHandshake,
    title: "Build a welcoming place",
    description:
      "Be considerate in chat and gameplay. Harassment, cheating, and disruptive behavior can lead to moderation action.",
  },
];

export const Route = createFileRoute("/community")({
  head: () =>
    seo(
      "Community",
      "Join the Craft SMP community, connect in-game, and find server information.",
    ),
  component: () => (
    <InfoPage
      title="Craft SMP Community"
      sub="Survival is better together. Join the world, meet other players, and help make the server a welcoming place."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {communityHighlights.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-2xl border bg-card p-5 shadow-soft"
          >
            <Icon className="size-6 text-ink" />
            <h3 className="mt-2 text-lg font-semibold">{title}</h3>
            <p className="text-sm">{description}</p>
          </div>
        ))}
      </div>

      <h2>Join the server</h2>
      <p>
        Connect to <strong>{site.serverAddress}</strong> using Minecraft's
        Multiplayer screen. Select Add Server, enter the address, save, and
        connect. The server address is also available from the site's server
        status area.
      </p>
      <div className="flex flex-wrap gap-3">
        {site.discordUrl ? (
          <Button asChild variant="hero" size="lg">
            <a href={site.discordUrl} target="_blank" rel="noreferrer">
              Join the community Discord
            </a>
          </Button>
        ) : (
          <p className="rounded-xl border bg-muted px-4 py-3 text-sm">
            A community chat invite is not available on this site yet. You can
            still join in-game using the server address above.
          </p>
        )}
        <Button variant="glass" size="lg" onClick={copyAddress}>
          Copy server address
        </Button>
      </div>

      <h2>New to the server?</h2>
      <ol>
        <li>
          Join with the server address above and read the in-game rules or
          welcome information.
        </li>
        <li>
          Ask questions respectfully and take time to learn the server's
          features.
        </li>
        <li>
          Check the{" "}
          <Link to="/faq" className="text-ink underline">
            FAQ
          </Link>{" "}
          for store and joining questions.
        </li>
      </ol>

      <h2>Community activities</h2>
      <p>
        Community activities or events may be announced through available server
        channels. No particular event schedule is guaranteed. Check in-game
        announcements or the community link when one is configured.
      </p>

      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mt-0">Need help?</h2>
        <p>
          For account, payment, or order questions, use the{" "}
          <Link to="/support" className="text-ink underline">
            Support page
          </Link>
          . For gameplay concerns, follow the server's moderation guidance and
          use the official channels listed in-game.
        </p>
      </div>
    </InfoPage>
  ),
});
