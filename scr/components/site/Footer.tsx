import { Link } from "@tanstack/react-router";
import { Logo } from "./Navbar";
import { CopyIp } from "./ServerStatus";

const cols = [
  {
    title: "Store",
    links: [
      ["/store", "All products"],
      ["/ranks", "Ranks"],
      ["/coins", "Coins"],
      ["/crates", "Crate keys"],
      ["/bundles", "Bundles"],
      ["/cosmetics", "Cosmetics"],
      ["/offers", "Special offers"],
    ],
  },
  {
    title: "Help",
    links: [
      ["/support", "Support"],
      ["/faq", "FAQ"],
      ["/community", "Community"],
      ["/vote", "Vote"],
      ["/account", "Account"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/terms", "Terms of Service"],
      ["/privacy", "Privacy Policy"],
      ["/refunds", "Refund Policy"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-20 border-t bg-soft">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">A cozy survival multiplayer world. Build, explore and leave your legacy.</p>
          <CopyIp />
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="mb-3 text-base">{c.title}</h3>
            <ul className="space-y-2 text-sm">
              {c.links.map(([to, label]) => (
                <li key={to}><Link to={to} className="text-muted-foreground hover:text-foreground">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Craft SMP. Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
      </p>
    </footer>
  );
}
