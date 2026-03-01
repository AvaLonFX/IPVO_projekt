"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SearchPlayers from "../components/nba_comp/SearchPlayers";
import HighlightClipCard from "@/components/HighlightClipCard";

type BestHighlight = {
  clip_id: number;
  rank: number;
  start_sec: number;
  end_sec: number;
  youtube_video_id: string;
  day?: string;
  daily_title?: string | null;

  id: number; // player_highlights id
  person_id: number | null;
  event: "dunk" | "three";
  score: number;
  event_conf?: number;
  player_conf?: number;

  player?: {
    PERSON_ID: number;
    player_full_name: string;
    TEAM_ABBREVIATION?: string;
    TEAM_NAME?: string;
  } | null;
};

export default function HomeLanding() {
  const router = useRouter();
  const [best, setBest] = useState<BestHighlight | null>(null);
  const [loadingBest, setLoadingBest] = useState(true);

  const goPlayer = (playerOrId: any) => {
    const id =
      playerOrId?.PERSON_ID ??
      playerOrId?.PLAYER_ID ??
      playerOrId?.id ??
      playerOrId;
    router.push(`/player/${id}`);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingBest(true);
        const res = await fetch("/api/highlights/best", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setBest(json?.best ?? null);
      } catch {
        if (!cancelled) setBest(null);
      } finally {
        if (!cancelled) setLoadingBest(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-4xl">
        {/* HERO */}
        <div className="flex flex-col items-center text-center">
          {/* LOGO */}
          <Image
            src="/slike_test/qnba_logo.png"
            alt="QNBA"
            width={160}
            height={160}
            priority
            className="h-50 w-50 object-contain"
          />

          {/* TITLE */}
          <h1 className="mt-4 text-3xl font-bold tracking-tight">QNBA</h1>

          <p className="mt-2 max-w-xl text-sm text-foreground/60">
            Search players, explore stats, track trends, and build your Dream
            Team.
          </p>

          {/* SEARCH */}
          <div className="mt-8 w-full">
            <div className="text-xs text-foreground/60 mb-1 text-left"></div>
            <SearchPlayers onPlayerClick={goPlayer} />
            <p className="mt-2 text-xs text-foreground/50">
              Tip: search any NBA player to open their profile card.
            </p>
          </div>
        </div>

        {/* HIGHLIGHT OF THE DAY */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Highlight of the day</h2>
            <span className="text-xs text-foreground/60">
              {best?.day ? best.day : ""}
            </span>
          </div>

          {loadingBest ? (
            <div className="mt-3 rounded-2xl border bg-card shadow-sm p-5">
              <div className="h-4 w-40 bg-foreground/10 rounded mb-3" />
              <div className="h-3 w-64 bg-foreground/10 rounded mb-6" />
              <div className="h-48 w-full bg-foreground/10 rounded-xl" />
            </div>
          ) : !best ? (
            <div className="mt-3 rounded-2xl border bg-card shadow-sm p-5">
              <div className="text-sm text-foreground/70 font-semibold">
                No highlight yet
              </div>
              <p className="mt-1 text-sm text-foreground/60">
                Add one row to <code className="px-1 border rounded">yt_daily_videos</code>,
                10 rows to <code className="px-1 border rounded">yt_video_clips</code>,
                and at least one row to <code className="px-1 border rounded">player_highlights</code>.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border bg-card shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-bold">
                    {best.player?.player_full_name ?? "Unknown player"}
                  </div>
                  <div className="mt-1 text-sm text-foreground/60">
                    Event:{" "}
                    <span className="font-semibold">
                      {best.event === "three" ? "3PT" : "Dunk"}
                    </span>
                    {" · "}
                    Score:{" "}
                    <span className="font-semibold">
                      {Number(best.score).toFixed(2)}
                    </span>
                    {" · "}
                    Rank:{" "}
                    <span className="font-semibold">#{best.rank}</span>
                  </div>

                  <div className="mt-2 text-xs text-foreground/50">
                    {best.daily_title ? best.daily_title : ""}
                    {best.player?.TEAM_ABBREVIATION
                      ? ` · ${best.player.TEAM_ABBREVIATION}`
                      : ""}
                  </div>
                </div>

                {best.person_id ? (
                  <button
                    onClick={() => router.push(`/player/${best.person_id}`)}
                    className="text-xs rounded-full border px-3 py-1 text-foreground/70 hover:bg-foreground/5"
                  >
                    Open player →
                  </button>
                ) : null}
              </div>

              <div className="mt-4">
                <HighlightClipCard
                  videoId={best.youtube_video_id}
                  startSec={best.start_sec}
                  endSec={best.end_sec}
                  title={best.daily_title ?? "Highlight"}
                />
              </div>

              <div className="mt-3 text-xs text-foreground/50">
                Conf: event{" "}
                {best.event_conf != null ? Number(best.event_conf).toFixed(2) : "—"}
                {" · "}player{" "}
                {best.player_conf != null ? Number(best.player_conf).toFixed(2) : "—"}
              </div>
            </div>
          )}
        </div>

        {/* FEATURES */}
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FeatureCard
            title="Player Explorer"
            desc="Open any player and dive into stats, bio, and trends."
            href="/dashboard"
            badge="Core"
          />
          <FeatureCard
            title="Dream Team Builder"
            desc="Save your favorite players and build your lineup."
            href="/dreamteam"
            badge="Popular"
          />
          <FeatureCard
            title="Analytics"
            desc="See what users search, add, and how funnels behave."
            href="/analytics"
            badge="Data"
          />
          <FeatureCard
            title="Guesser"
            desc="A fun guessing mode based on your player data."
            href="/guess"
            badge="Game"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  desc,
  href,
  badge,
}: {
  title: string;
  desc: string;
  href: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border bg-card shadow-sm p-5 block card-hover"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold">{title}</div>
        <span className="text-xs rounded-full border px-2 py-1 text-foreground/70">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground/60">{desc}</p>
      <div className="mt-4 text-sm font-semibold transition-transform duration-200 group-hover:translate-x-1">
        Open →
      </div>
    </Link>
  );
}

/** YouTube embed player that starts at startSec and pauses at endSec */
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

function HighlightPlayer({
  videoId,
  startSec,
  endSec,
}: {
  videoId: string;
  startSec: number;
  endSec: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const load = () =>
      new Promise<void>((resolve) => {
        if (window.YT?.Player) return resolve();
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
        window.onYouTubeIframeAPIReady = () => resolve();
      });

    let cancelled = false;

    (async () => {
      await load();
      if (cancelled || !containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { start: startSec, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            // optional: start paused at startSec
          },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = setInterval(() => {
                const t = playerRef.current?.getCurrentTime?.() ?? 0;
                if (t >= endSec) {
                  playerRef.current.pauseVideo();
                  clearInterval(timerRef.current);
                }
              }, 200);
            }
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (playerRef.current?.destroy) playerRef.current.destroy();
    };
  }, [videoId, startSec, endSec]);

  return <div ref={containerRef} className="w-full aspect-video" />;
}
