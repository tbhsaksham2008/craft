import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  Gamepad2,
  Gem,
  KeyRound,
  LockKeyhole,
  Mail,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import heroImage from "@/assets/hero.jpg";
import { formatPrice, site } from "@/config/site";
import { isValidMinecraftName } from "@/lib/minecraft";
import { isSupabaseConfigured, oauthProviders, supabase } from "@/lib/supabase";
import { seo } from "@/lib/seo";

type Order = {
  id: string;
  status: string;
  total_paise: number;
  created_at: string;
  minecraft_username: string;
};

export const Route = createFileRoute("/account")({
  head: () =>
    seo(
      "Account",
      "Sign in to view your Craft SMP orders and delivery status.",
    ),
  component: AccountPage,
});

function AccountPage() {
  const [session, setSession] =
    useState<
      Awaited<
        ReturnType<NonNullable<typeof supabase>["auth"]["getSession"]>
      >["data"]["session"]
    >(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(
      ({ data }) => {
        setSession(data.session);
      },
      (error: unknown) => {
        setError(
          error instanceof Error
            ? `Could not restore your session: ${error.message}`
            : "Could not restore your session.",
        );
      },
    );
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setOrders([]);
      setIsAdmin(false);
      setUsername("");
      return;
    }
    let active = true;
    void supabase
      .from("profiles")
      .select("minecraft_username,role")
      .eq("id", session.user.id)
      .single()
      .then(
        ({ data, error: profileError }) => {
          if (!active) return;
          if (profileError)
            setError(`Could not load your profile: ${profileError.message}`);
          else {
            setUsername(data.minecraft_username ?? "");
            setIsAdmin(data.role === "admin");
          }
        },
        (profileError: unknown) => {
          if (active)
            setError(
              profileError instanceof Error
                ? profileError.message
                : "Could not load your profile.",
            );
        },
      );
    void supabase
      .from("orders")
      .select("id,status,total_paise,created_at,minecraft_username")
      .order("created_at", { ascending: false })
      .then(
        ({ data, error: queryError }) => {
          if (!active) return;
          if (queryError)
            setError(`Could not load order history: ${queryError.message}`);
          else setOrders(data ?? []);
        },
        (queryError: unknown) => {
          if (active)
            setError(
              queryError instanceof Error
                ? queryError.message
                : "Could not load order history.",
            );
        },
      );
    return () => {
      active = false;
    };
  }, [session]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        { email, password },
      );
      if (authError) throw authError;
      setSession(data.session);
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Sign in failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const signUp = async () => {
    if (!supabase) return;
    if (username && !isValidMinecraftName(username)) {
      setError(
        "Minecraft usernames are 3–16 letters, numbers, or underscores.",
      );
      return;
    }
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { minecraft_username: username } },
      });
      if (authError) throw authError;
      if (data.session) setSession(data.session);
      else
        setNotice(
          "Check your email to confirm your account before signing in.",
        );
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Account creation failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const signInWithOAuth = async (
    provider: (typeof oauthProviders)[number]["id"],
  ) => {
    if (!supabase) return;
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/account` },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "OAuth sign-in could not be started.",
      );
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw authError;
      setSession(null);
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Sign out failed.",
      );
    }
  };

  const saveUsername = async () => {
    if (!supabase || !session) return;
    if (username && !isValidMinecraftName(username)) {
      setError(
        "Minecraft usernames are 3–16 letters, numbers, or underscores.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          minecraft_username: username || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);
      if (updateError) throw updateError;
      setNotice("Minecraft username saved.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not save your Minecraft username.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="account-page">
      {!session && (
        <div className="mx-auto flex min-h-[72vh] max-w-6xl items-center px-4 py-16">
          <div className="account-enter mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_32px_100px_-44px_oklch(0.45_0.16_290/0.45)] backdrop-blur-xl md:grid-cols-[1.05fr_0.95fr]">
            <div className="relative hidden min-h-[620px] overflow-hidden bg-ink md:block">
              <img
                src={heroImage}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#15122b]/90 via-[#30214c]/25 to-[#15122b]/10" />
              <div className="absolute left-8 top-8 flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-xl">
                <Sparkles className="size-4 text-lilac" /> Your next chapter
                starts here
              </div>
              <div className="absolute inset-x-0 bottom-0 p-10 text-white">
                <p className="font-display text-sm uppercase tracking-[0.24em] text-white/65">
                  CRAFT SMP · SURVIVAL, REIMAGINED
                </p>
                <h1 className="mt-4 max-w-lg text-5xl leading-[1.05]">
                  Find your place in a world of your own.
                </h1>
                <p className="mt-4 max-w-md leading-7 text-white/75">
                  Pick up where you left off, keep your rewards close, and make
                  every adventure yours.
                </p>
                <div className="mt-8 flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-white/15">
                    <Gamepad2 className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      The world is waiting
                    </p>
                    <p className="text-xs text-white/60">
                      {site.serverAddress}
                    </p>
                  </div>
                  <ArrowDownRight className="ml-auto size-5 text-white/60" />
                </div>
              </div>
              <span
                className="account-orb account-orb-one"
                aria-hidden="true"
              />
              <span
                className="account-orb account-orb-two"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
              <Link
                to="/"
                className="mb-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="grid size-8 grid-cols-2 grid-rows-2 gap-0.5 rounded-lg bg-brand p-1 shadow-soft">
                  <i className="rounded-sm bg-primary" />
                  <i className="rounded-sm bg-lilac" />
                  <i className="rounded-sm bg-blush" />
                  <i className="rounded-sm bg-sky" />
                </span>
                Craft<span className="-ml-2 text-gradient">SMP</span>
              </Link>
              <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand text-foreground shadow-soft">
                {authMode === "signin" ? (
                  <KeyRound className="size-5" />
                ) : (
                  <Sparkles className="size-5" />
                )}
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink">
                PLAYER PORTAL
              </p>
              <h1 className="mt-2 text-4xl">
                {authMode === "signin" ? "Welcome back" : "Join the adventure"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {authMode === "signin"
                  ? "Your inventory, your orders, your world. Pick up right where you left off."
                  : "Create your account to save your profile and keep every reward in one place."}
              </p>

              {!isSupabaseConfigured && (
                <div
                  role="status"
                  className="mt-5 rounded-xl border border-blush bg-blush/20 p-3 text-xs leading-5 text-foreground/80"
                >
                  Account sign-in is not connected yet. Configure Supabase to
                  enable player accounts.
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="mt-6 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <X className="mt-0.5 size-4 shrink-0" />
                  {error}
                </div>
              )}
              {notice && (
                <div
                  role="status"
                  className="mt-6 flex gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success"
                >
                  <Check className="mt-0.5 size-4 shrink-0" />
                  {notice}
                </div>
              )}

              <form
                key={authMode}
                onSubmit={
                  authMode === "signin"
                    ? submitAuth
                    : (event) => {
                        event.preventDefault();
                        void signUp();
                      }
                }
                className="account-form-enter mt-7 space-y-4"
              >
                {authMode === "signup" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="signup-minecraft"
                      className="text-xs font-semibold"
                    >
                      Minecraft username{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional for now)
                      </span>
                    </Label>
                    <div className="relative">
                      <Gamepad2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-minecraft"
                        autoComplete="off"
                        maxLength={16}
                        value={username}
                        onChange={(event) =>
                          setUsername(event.target.value.trim())
                        }
                        placeholder="Your in-game name"
                        className="h-12 rounded-xl border-border/70 bg-white/80 pl-10 transition-shadow focus-visible:ring-2 focus-visible:ring-lilac/60"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                      className="h-12 rounded-xl border-border/70 bg-white/80 pl-10 transition-shadow focus-visible:ring-2 focus-visible:ring-lilac/60"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password" className="text-xs font-semibold">
                      Password
                    </Label>
                    {authMode === "signin" && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!supabase || !email) {
                            setError("Enter your email address first.");
                            return;
                          }
                          setError("");
                          setNotice("");
                          const { error: resetError } =
                            await supabase.auth.resetPasswordForEmail(email, {
                              redirectTo: `${window.location.origin}/account`,
                            });
                          if (resetError) setError(resetError.message);
                          else
                            setNotice(
                              "Password reset instructions are on their way to your email.",
                            );
                        }}
                        className="text-xs font-medium text-ink transition-colors hover:text-foreground"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        authMode === "signin"
                          ? "current-password"
                          : "new-password"
                      }
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className="h-12 rounded-xl border-border/70 bg-white/80 px-10 transition-shadow focus-visible:ring-2 focus-visible:ring-lilac/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={busy || !isSupabaseConfigured}
                  className="group mt-2 h-12 w-full rounded-xl"
                >
                  {busy
                    ? "One moment…"
                    : authMode === "signin"
                      ? "Sign in to your account"
                      : "Create your account"}
                  {!busy && (
                    <ArrowRight className="transition-transform group-hover:translate-x-1" />
                  )}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Or continue with
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {oauthProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    type="button"
                    variant="outline"
                    disabled={busy || !isSupabaseConfigured}
                    onClick={() => void signInWithOAuth(provider.id)}
                    className="h-11 rounded-xl bg-white/70 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-soft"
                  >
                    {provider.id === "google" ? (
                      <GoogleMark />
                    ) : (
                      <DiscordMark />
                    )}
                    <span>{provider.label}</span>
                  </Button>
                ))}
              </div>

              <p className="mt-7 text-center text-sm text-muted-foreground">
                {authMode === "signin"
                  ? "New around here?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  disabled={!isSupabaseConfigured}
                  onClick={() => {
                    setAuthMode(authMode === "signin" ? "signup" : "signin");
                    setError("");
                    setNotice("");
                  }}
                  className="font-semibold text-ink underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authMode === "signin"
                    ? "Create an account"
                    : "Sign in instead"}
                </button>
              </p>
              <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" />
                Your account is protected and your details stay private.
              </div>
            </div>
          </div>
          <div className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 px-2 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Craft SMP</span>
            <div className="flex items-center gap-5">
              <Link
                to="/support"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <CircleHelp className="size-3.5" />
                Need help?
              </Link>
              <Link
                to="/store"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                Explore the store <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {isSupabaseConfigured && session && (
        <AccountDashboard
          email={session.user.email ?? ""}
          orders={orders}
          username={username}
          isAdmin={isAdmin}
          error={error}
          notice={notice}
          busy={busy}
          onUsernameChange={setUsername}
          onSaveUsername={() => void saveUsername()}
          onSignOut={() => void signOut()}
        />
      )}
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.91 3.27-4.73 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.16A11 11 0 0 0 1 12c0 1.78.43 3.46 1.16 4.95l3.68-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.02 14.97 1 12 1a11 11 0 0 0-9.84 6.05l3.68 2.84C6.71 7.29 9.14 5.36 12 5.36Z"
      />
    </svg>
  );
}

function DiscordMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 fill-[#5865F2]"
    >
      <path d="M19.73 5.02A18.3 18.3 0 0 0 15.24 3.6c-.2.36-.43.85-.59 1.23a17 17 0 0 0-5.3 0c-.16-.38-.4-.87-.6-1.23a18.2 18.2 0 0 0-4.5 1.43C1.4 9.3.63 13.5 1.02 17.65a18.1 18.1 0 0 0 5.53 2.8c.44-.6.83-1.24 1.17-1.92-.64-.24-1.25-.54-1.82-.9l.45-.36c3.5 1.64 7.3 1.64 10.76 0l.46.36c-.58.36-1.19.66-1.83.9.34.68.73 1.32 1.17 1.92a18 18 0 0 0 5.54-2.8c.46-4.8-.78-8.97-3.27-12.63ZM8.92 14.98c-1.05 0-1.92-.96-1.92-2.14s.84-2.14 1.92-2.14c1.08 0 1.93.96 1.91 2.14 0 1.18-.84 2.14-1.91 2.14Zm6.16 0c-1.05 0-1.92-.96-1.92-2.14s.84-2.14 1.92-2.14c1.08 0 1.93.96 1.91 2.14 0 1.18-.83 2.14-1.91 2.14Z" />
    </svg>
  );
}

function AccountDashboard({
  email,
  orders,
  username,
  isAdmin,
  error,
  notice,
  busy,
  onUsernameChange,
  onSaveUsername,
  onSignOut,
}: {
  email: string;
  orders: Order[];
  username: string;
  isAdmin: boolean;
  error: string;
  notice: string;
  busy: boolean;
  onUsernameChange: (value: string) => void;
  onSaveUsername: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <header className="account-enter relative overflow-hidden rounded-[2rem] border border-white/70 bg-brand p-7 shadow-glow sm:p-10">
        <div className="absolute -right-12 -top-20 size-64 rounded-full bg-white/25 blur-3xl" />
        <div className="absolute -bottom-28 right-1/3 size-64 rounded-full bg-blush/50 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">
              <Sparkles className="size-4" /> PLAYER PORTAL
            </p>
            <h1 className="mt-3 text-4xl sm:text-5xl">
              Welcome back<span className="text-gradient">, adventurer.</span>
            </h1>
            <p className="mt-3 max-w-xl text-foreground/70">
              Your journey, purchases, and in-game identity—all in one place.
            </p>
          </div>
          <Button
            variant="glass"
            onClick={onSignOut}
            className="rounded-xl bg-white/50"
          >
            Sign out <ArrowRight className="size-4" />
          </Button>
        </div>
        <div className="account-orb account-orb-one" aria-hidden="true" />
      </header>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-success"
        >
          {notice}
        </p>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="account-enter account-stagger-1 rounded-2xl border bg-card p-5 shadow-soft transition-transform hover:-translate-y-1">
          <span className="grid size-10 place-items-center rounded-xl bg-sky/50 text-ink">
            <PackageCheck className="size-5" />
          </span>
          <p className="mt-4 text-2xl font-bold">{orders.length}</p>
          <p className="text-sm text-muted-foreground">Orders placed</p>
        </div>
        <div className="account-enter account-stagger-2 rounded-2xl border bg-card p-5 shadow-soft transition-transform hover:-translate-y-1">
          <span className="grid size-10 place-items-center rounded-xl bg-lilac/40 text-ink">
            <Gem className="size-5" />
          </span>
          <p className="mt-4 text-2xl font-bold">
            {formatPrice(
              orders
                .filter((order) => order.status === "paid")
                .reduce((sum, order) => sum + order.total_paise, 0) / 100,
            )}
          </p>
          <p className="text-sm text-muted-foreground">Total adventures</p>
        </div>
        <div className="account-enter account-stagger-3 rounded-2xl border bg-card p-5 shadow-soft transition-transform hover:-translate-y-1">
          <span className="grid size-10 place-items-center rounded-xl bg-blush/50 text-ink">
            <Gamepad2 className="size-5" />
          </span>
          <p className="mt-4 truncate text-lg font-bold">
            {username || "Not linked yet"}
          </p>
          <p className="text-sm text-muted-foreground">Minecraft profile</p>
        </div>
        <div className="account-enter account-stagger-4 rounded-2xl border bg-card p-5 shadow-soft transition-transform hover:-translate-y-1">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/40 text-ink">
            <ShieldCheck className="size-5" />
          </span>
          <p className="mt-4 truncate text-lg font-bold">{email}</p>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Administrator" : "Craft SMP member"}
          </p>
        </div>
      </div>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <section className="account-enter account-stagger-2 rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2 className="text-xl">Your profile</h2>
              <p className="text-xs text-muted-foreground">Make it yours.</p>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <Label
              htmlFor="profile-minecraft"
              className="text-xs font-semibold"
            >
              Minecraft username
            </Label>
            <div className="flex gap-2">
              <Input
                id="profile-minecraft"
                maxLength={16}
                value={username}
                onChange={(event) =>
                  onUsernameChange(event.target.value.trim())
                }
                placeholder="Your in-game name"
                className="h-11 rounded-xl bg-background"
              />
              <Button
                onClick={onSaveUsername}
                disabled={busy}
                className="h-11 rounded-xl px-5"
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Java Edition · 3–16 letters, numbers, or underscores
            </p>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-xl border bg-soft p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-white/70 text-ink">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Email address
              </p>
              <p className="truncate text-sm font-medium">{email}</p>
            </div>
            <Check className="ml-auto size-4 shrink-0 text-success" />
          </div>
          {isAdmin && (
            <Button
              asChild
              variant="outline"
              className="mt-5 w-full rounded-xl"
            >
              <Link to="/admin">
                Open admin dashboard <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </section>

        <section className="account-enter account-stagger-3 rounded-2xl border bg-card p-6 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink">
                THE GOODIES
              </p>
              <h2 className="mt-1 text-2xl">Your order history</h2>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {orders.length} total
            </span>
          </div>
          {orders.length ? (
            <ul className="mt-5 divide-y">
              {orders.map((order, index) => (
                <li
                  key={order.id}
                  className="group flex flex-wrap items-center gap-4 py-4 transition-colors hover:bg-soft/60"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-brand/60 text-ink transition-transform group-hover:scale-105">
                    <PackageCheck className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" },
                      )}{" "}
                      · {order.minecraft_username}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatPrice(order.total_paise / 100)}
                    </p>
                    <span
                      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${order.status === "paid" ? "bg-success/10 text-success" : order.status === "pending" ? "bg-primary/30 text-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${order.status === "paid" ? "bg-success" : "bg-current"}`}
                      />
                      {order.status}
                    </span>
                  </div>
                  {index === 0 && (
                    <span className="sr-only">Most recent order</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed bg-soft/70 px-6 py-10 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white shadow-soft">
                <PackageCheck className="size-6 text-ink" />
              </span>
              <h3 className="mt-4 text-lg">Your next adventure awaits</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
                Your purchases will show up here, ready when you are.
              </p>
              <Button asChild variant="hero" className="group mt-5 rounded-xl">
                <Link to="/store">
                  Explore the store{" "}
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          )}
          <Link
            to="/support"
            className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Need a hand with an order? Get support{" "}
            <ArrowRight className="size-3.5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
