import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Gift,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CopyIp,
  ServerStatus,
  copyAddress,
} from "@/components/site/ServerStatus";
import { ProductGrid } from "@/components/site/ProductCard";
import { Reveal, SectionTitle } from "@/components/site/Reveal";
import {
  activeProducts,
  categories,
  isOnSale,
  productFromRecord,
  type Product,
} from "@/data/products";
import { faqs } from "@/data/faq";
import { seo } from "@/lib/seo";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () =>
    seo(
      "Ranks, Crates & Coins",
      "Enhance your Craft SMP adventure with exclusive ranks, crate keys, coins and cosmetics.",
    ),
  component: Index,
});

const blocks = [
  { c: "bg-primary", s: "size-10", p: "left-[6%] top-[18%]", d: "0s" },
  { c: "bg-lilac", s: "size-6", p: "left-[42%] top-[10%]", d: "1.2s" },
  { c: "bg-blush", s: "size-8", p: "left-[12%] bottom-[14%]", d: "2s" },
  { c: "bg-sky", s: "size-5", p: "right-[8%] top-[12%]", d: "0.6s" },
];

function Index() {
  const [all, setAll] = useState<Product[]>(() =>
    isSupabaseConfigured ? [] : activeProducts(),
  );
  const [catalogLoading, setCatalogLoading] = useState(isSupabaseConfigured);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let active = true;
    void supabase
      .from("products")
      .select("*")
      .eq("enabled", true)
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error) {
            setCatalogError(
              `Featured products could not be loaded: ${error.message}`,
            );
            setAll([]);
          } else {
            setAll((data ?? []).map((record) => productFromRecord(record)));
          }
          setCatalogLoading(false);
        },
        (error: unknown) => {
          if (!active) return;
          setCatalogError(
            error instanceof Error
              ? `Featured products could not be loaded: ${error.message}`
              : "Featured products could not be loaded.",
          );
          setAll([]);
          setCatalogLoading(false);
        },
      );
    return () => {
      active = false;
    };
  }, []);

  const featured = all.filter((p) => p.featured).slice(0, 6);
  const ranks = all.filter((p) => p.category === "ranks").slice(0, 4);
  const crates = all.filter((p) => p.category === "crates" && p.featured);
  const coins = all.filter((p) => p.category === "coins" && p.featured);
  const offers = all.filter(isOnSale).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-soft pixel-grid">
        {blocks.map((b, i) => (
          <span
            key={i}
            aria-hidden
            style={{ animationDelay: b.d }}
            className={`absolute ${b.p} ${b.s} ${b.c} rounded-md opacity-70 shadow-soft animate-float`}
          />
        ))}
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
              <Sparkles className="size-4 text-ink" /> Survival · Economy ·
              Community
            </span>
            <h1 className="mt-5 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              YOUR ADVENTURE.
              <br />
              <span className="text-gradient">YOUR LEGACY.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Enhance your journey on Craft SMP with exclusive ranks, amazing
              perks, exciting crate keys, and rewards made for true Minecraft
              adventurers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/store">
                  Explore Store <ArrowRight />
                </Link>
              </Button>
              <Button variant="glass" size="lg" onClick={copyAddress}>
                Join Craft SMP
              </Button>
            </div>
            <div className="mt-6">
              <CopyIp />
            </div>
          </div>
          <div className="relative">
            <div
              className="absolute -inset-6 rounded-[2.5rem] bg-brand opacity-50 blur-3xl animate-gradient"
              aria-hidden
            />
            <img
              src={hero}
              alt="A blocky adventurer on a floating island in a pastel sky"
              width={1280}
              height={1024}
              className="relative rounded-[2rem] border-4 border-card shadow-glow"
            />
            <div className="absolute -bottom-10 left-1/2 w-[90%] -translate-x-1/2 sm:left-auto sm:right-4 sm:w-auto sm:translate-x-0">
              <ServerStatus />
            </div>
          </div>
        </div>
        <div className="h-16" />
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <SectionTitle
          eyebrow="Shop by category"
          title="Everything for your journey"
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {categories.map((c, i) => (
            <Reveal key={c.id} delay={i * 70}>
              <Link
                to={c.path}
                className="group flex flex-col items-center rounded-2xl border bg-card p-5 text-center shadow-soft transition hover:-translate-y-1 hover:shadow-glow"
              >
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  className="size-20 object-contain transition group-hover:scale-110"
                />
                <h3 className="mt-3 text-lg">{c.label}</h3>
                <p className="text-xs text-muted-foreground">{c.blurb}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {(catalogLoading || catalogError) && (
        <div className="mx-auto max-w-7xl px-4 pt-10">
          {catalogLoading && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading featured products…
            </p>
          )}
          {catalogError && (
            <p
              role="alert"
              className="rounded-xl border border-destructive p-4 text-sm text-destructive"
            >
              {catalogError}
            </p>
          )}
        </div>
      )}
      {featured.length > 0 && (
        <Block
          eyebrow="Hand-picked"
          title="Featured items"
          to="/store"
          products={featured}
        />
      )}
      {ranks.length > 0 && (
        <Block
          eyebrow="Prestige"
          title="Popular ranks"
          to="/ranks"
          products={ranks}
        />
      )}
      {crates.length > 0 && (
        <Block
          eyebrow="Loot"
          title="Featured crates"
          to="/crates"
          products={crates}
        />
      )}
      {coins.length > 0 && (
        <Block
          eyebrow="Economy"
          title="Coin packages"
          to="/coins"
          products={coins}
        />
      )}
      {offers.length > 0 && (
        <Block
          eyebrow="Limited time"
          title="Special offers"
          to="/offers"
          products={offers}
        />
      )}

      {/* Why */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <SectionTitle
          eyebrow="Why Craft SMP?"
          title="A world worth building in"
        />
        <div className="grid gap-5 md:grid-cols-4">
          {[
            [
              ShieldCheck,
              "Fair play",
              "Perks that enhance — never break — survival balance.",
            ],
            [Zap, "Lag-free", "Tuned performance so your builds run smooth."],
            [
              Heart,
              "Friendly community",
              "Active staff and a welcoming player base.",
            ],
            [Gift, "Regular events", "Seasonal events, drops and giveaways."],
          ].map(([Icon, t, d], i) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <Reveal key={t as string} delay={i * 80}>
                <div className="h-full rounded-2xl border bg-card p-6 shadow-soft">
                  <div className="mb-4 grid size-12 place-items-center rounded-xl bg-brand">
                    <I className="size-6" />
                  </div>
                  <h3 className="text-lg">{t as string}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d as string}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* How */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionTitle eyebrow="Simple as 1-2-3" title="How to purchase" />
        <ol className="grid gap-5 md:grid-cols-3">
          {[
            "Pick your items and add them to your cart.",
            "Enter your exact Minecraft username at checkout.",
            "Rewards are delivered in-game once payment is verified.",
          ].map((s, i) => (
            <Reveal key={s} delay={i * 100}>
              <li className="glass h-full rounded-2xl p-6 shadow-soft">
                <span className="font-display text-4xl text-gradient">
                  0{i + 1}
                </span>
                <p className="mt-2">{s}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Community */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-brand animate-gradient p-10 text-center shadow-glow md:p-16">
            <MessageCircle className="mx-auto size-12" />
            <h2 className="mt-4 text-3xl md:text-5xl">Join the community</h2>
            <p className="mx-auto mt-3 max-w-lg">
              Chat with players, get event updates and find your next build
              buddy.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild variant="glass" size="lg">
                <Link to="/community">Community hub</Link>
              </Button>
              <Button variant="glass" size="lg" onClick={copyAddress}>
                Copy server IP
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <SectionTitle eyebrow="Questions?" title="Frequently asked" />
        <Accordion
          type="single"
          collapsible
          className="rounded-2xl border bg-card px-5 shadow-soft"
        >
          {faqs.slice(0, 5).map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <div className="mt-6 text-center">
          <Button asChild variant="link">
            <Link to="/faq">See all FAQs</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function Block({
  eyebrow,
  title,
  to,
  products,
}: {
  eyebrow: string;
  title: string;
  to: "/store" | "/ranks" | "/crates" | "/coins" | "/offers";
  products: ReturnType<typeof activeProducts>;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-ink">
            {eyebrow}
          </p>
          <h2 className="text-3xl md:text-4xl">{title}</h2>
        </div>
        <Button asChild variant="soft">
          <Link to={to}>
            View all <ArrowRight />
          </Link>
        </Button>
      </div>
      <Reveal>
        <ProductGrid products={products} />
      </Reveal>
    </section>
  );
}
