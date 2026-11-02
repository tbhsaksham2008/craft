import { Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase
      .from("site_announcements")
      .select("message,enabled")
      .eq("id", "global")
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data?.enabled || !data.message.trim()) return;
        setAnnouncement(data.message.trim());
        setVisible(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <aside className="border-b border-primary/20 bg-primary/15 px-4 py-2.5 text-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Megaphone className="size-4 shrink-0 text-ink" aria-hidden />
        <p className="min-w-0 flex-1 truncate font-medium">{announcement}</p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
          aria-label="Dismiss announcement"
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
