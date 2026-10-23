import { Link } from "@tanstack/react-router";
import { Menu, ShoppingCart, User, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";

export const navLinks = [
  { to: "/", label: "Home" },
  { to: "/store", label: "Store" },
  { to: "/ranks", label: "Ranks" },
  { to: "/crates", label: "Crates" },
  { to: "/coins", label: "Coins" },
  { to: "/community", label: "Community" },
  { to: "/vote", label: "Vote" },
  { to: "/support", label: "Support" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span
        className="grid size-9 grid-cols-2 grid-rows-2 gap-0.5 rounded-lg bg-card p-1 shadow-soft"
        aria-hidden
      >
        <span className="rounded-sm bg-primary" />
        <span className="rounded-sm bg-lilac" />
        <span className="rounded-sm bg-blush" />
        <span className="rounded-sm bg-sky" />
      </span>
      <span className="font-display text-xl">
        Craft<span className="text-gradient">SMP</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const { count, setOpen } = useCart();
  const { session, loading } = useAuth();
  const [mobile, setMobile] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4"
        aria-label="Main"
      >
        <Logo />
        <ul className="hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          {!loading && session && (
            <Button
              variant="glass"
              size="icon"
              className="relative"
              onClick={() => setOpen(true)}
              aria-label={`Open cart, ${count} items`}
            >
              <ShoppingCart />
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-blush px-1 text-xs font-bold">
                  {count}
                </span>
              )}
            </Button>
          )}
          <Button asChild variant="hero" className="hidden sm:inline-flex">
            <Link to="/account">
              <User /> Account
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobile((m) => !m)}
            aria-label="Toggle menu"
            aria-expanded={mobile}
          >
            {mobile ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>
      {mobile && (
        <div className="border-t bg-background lg:hidden animate-in slide-in-from-top-2">
          <ul className="mx-auto flex max-w-7xl flex-col p-3">
            {[...navLinks, { to: "/account", label: "Account" } as const].map(
              (l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={() => setMobile(false)}
                    className="block rounded-lg px-3 py-2.5 font-medium hover:bg-accent"
                  >
                    {l.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
