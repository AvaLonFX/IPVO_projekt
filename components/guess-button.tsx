"use client";

import Link from "next/link";

export default function GuessButton() {
  return (
    <Link
      href="/guess"
      className="px-4 py-2 rounded-full border border-black hover:bg-black hover:text-white transition"
    >
      Guesser
    </Link>
  );
}
