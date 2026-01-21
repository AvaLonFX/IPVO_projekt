"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SearchPlayers from "../components/nba_comp/SearchPlayers";

export default function HomeLanding() {
  const router = useRouter();

  const goPlayer = (playerOrId: any) => {
    const id =
      playerOrId?.PERSON_ID ??
      playerOrId?.PLAYER_ID ??
      playerOrId?.id ??
      playerOrId;
    router.push(`/player/${id}`);
  };

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
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            QNBA
          </h1>

          <p className="mt-2 max-w-xl text-sm text-foreground/60">
            Search players, explore stats, track trends, and build your Dream Team.
          </p>

          {/* SEARCH */}
          <div className="mt-8 w-full">
            <div className="text-xs text-foreground/60 mb-1 text-left">
            </div>
            <SearchPlayers onPlayerClick={goPlayer} />
            <p className="mt-2 text-xs text-foreground/50">
              Tip: search any NBA player to open their profile card.
            </p>
          </div>

          {/* PRIMARY CTA */}
          
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
