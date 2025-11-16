"use client";

import Link from "next/link";
import { useState } from "react";

export default function PreviewIndex() {
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);

  const options = [
    {
      id: 1,
      name: "Hero-Driven",
      description: "Full viewport hero with animated metrics, live activity feed, and features grid",
      features: ["Animated volume counter", "Live swap feed", "Social proof band", "Features grid"],
      bestFor: "Experienced traders seeking quick access",
      route: "/preview/option1",
      color: "primary",
    },
    {
      id: 2,
      name: "Product-First",
      description: "Split hero with live swap interface, sticky metrics, and comparison table",
      features: ["Embedded swap UI", "Sticky metrics bar", "3-step process", "Competitor comparison"],
      bestFor: "New users discovering the platform",
      route: "/preview/option2",
      color: "secondary",
    },
    {
      id: 3,
      name: "Scrollytelling",
      description: "Full-screen narrative experience with scroll-triggered animations",
      features: ["Problem → Solution flow", "Parallax effects", "Interactive sections", "Progressive reveal"],
      bestFor: "Educational discovery experience",
      route: "/preview/option3",
      color: "accent",
    },
  ];

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="terminal-box border-2 border-[var(--primary)] p-8 mb-8">
          <div className="terminal-text text-sm text-[var(--muted)] mb-2 tracking-widest">
            [HOMEPAGE_CONCEPT_SELECTOR]
          </div>
          <h1 className="text-4xl font-bold terminal-text terminal-glow mb-4 uppercase">
            SWAPBACK <span className="text-[var(--primary)]">HOMEPAGE</span> CONCEPTS
          </h1>
          <p className="terminal-text text-[var(--muted)]">
            Select a concept to preview the full interface in action
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {options.map((option) => (
            <Link
              key={option.id}
              href={option.route}
              className="block"
              onMouseEnter={() => setHoveredOption(option.id)}
              onMouseLeave={() => setHoveredOption(null)}
            >
              <div
                className={`terminal-box border-2 p-6 h-full transition-all duration-300 ${
                  hoveredOption === option.id
                    ? `border-[var(--${option.color})] bg-[var(--${option.color})]/10 transform scale-105`
                    : `border-[var(--${option.color})]/30 hover:border-[var(--${option.color})]`
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="terminal-text text-2xl font-bold text-[var(--primary)]">
                    [OPTION_{option.id}]
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      hoveredOption === option.id
                        ? `bg-[var(--${option.color})] animate-pulse`
                        : `bg-[var(--${option.color})]/30`
                    }`}
                  />
                </div>

                {/* Title */}
                <h2 className={`terminal-text text-xl font-bold mb-3 uppercase text-[var(--${option.color})]`}>
                  {option.name}
                </h2>

                {/* Description */}
                <p className="terminal-text text-sm text-[var(--muted)] mb-4 leading-relaxed">
                  {option.description}
                </p>

                {/* Features List */}
                <div className="mb-4">
                  <div className="terminal-text text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">
                    Features:
                  </div>
                  <ul className="space-y-1">
                    {option.features.map((feature, idx) => (
                      <li key={idx} className="terminal-text text-xs text-[var(--muted)] flex items-center gap-2">
                        <span className={`text-[var(--${option.color})]`}>▸</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Best For */}
                <div className={`terminal-box border border-[var(--${option.color})]/30 bg-black p-3 mb-4`}>
                  <div className="terminal-text text-xs text-[var(--muted)] mb-1">BEST_FOR:</div>
                  <div className={`terminal-text text-xs text-[var(--${option.color})]`}>
                    {option.bestFor}
                  </div>
                </div>

                {/* CTA */}
                <div className="terminal-text text-sm uppercase tracking-wider text-center">
                  {hoveredOption === option.id ? (
                    <span className={`text-[var(--${option.color})] animate-pulse`}>
                      [LAUNCH_PREVIEW →]
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">[VIEW_CONCEPT]</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="terminal-box border-2 border-[var(--primary)]/30 p-6">
          <h3 className="terminal-text text-xl font-bold mb-4 uppercase text-[var(--primary)]">
            Quick Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full terminal-text text-sm">
              <thead>
                <tr className="border-b border-[var(--primary)]/30">
                  <th className="text-left py-3 px-4 text-[var(--muted)] font-normal">Criteria</th>
                  <th className="text-center py-3 px-4 text-[var(--primary)]">Option 1</th>
                  <th className="text-center py-3 px-4 text-[var(--secondary)]">Option 2</th>
                  <th className="text-center py-3 px-4 text-[var(--accent)]">Option 3</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "First Impression", values: ["🚀 Strong impact", "💼 Professional", "✨ Immersive"] },
                  { label: "Swap Interface", values: ["Link to /swap", "Embedded in hero", "Link at end"] },
                  { label: "Metrics Display", values: ["Hero + stats", "Sticky bar", "Integrated in story"] },
                  { label: "Best For", values: ["Experienced", "New users", "Discovery"] },
                  { label: "Dev Complexity", values: ["⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"] },
                  { label: "Mobile Support", values: ["✅ Excellent", "✅ Excellent", "⚠️ Complex"] },
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--primary)]/10">
                    <td className="py-3 px-4 text-[var(--muted)]">{row.label}</td>
                    <td className="py-3 px-4 text-center">{row.values[0]}</td>
                    <td className="py-3 px-4 text-center">{row.values[1]}</td>
                    <td className="py-3 px-4 text-center">{row.values[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 terminal-box border border-[var(--primary)]/30 p-4 text-center">
          <p className="terminal-text text-xs text-[var(--muted)]">
            [TIP] Testez chaque option en plein écran pour une meilleure expérience
          </p>
        </div>
      </div>
    </div>
  );
}
