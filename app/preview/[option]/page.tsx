import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

// Dynamic imports to avoid SSR issues
const Option1HeroDriven = dynamic(
  () => import("@/components/home-concepts/Option1HeroDriven"),
  { ssr: false }
);
const Option2ProductFirst = dynamic(
  () => import("@/components/home-concepts/Option2ProductFirst"),
  { ssr: false }
);
const Option3Scrollytelling = dynamic(
  () => import("@/components/home-concepts/Option3Scrollytelling"),
  { ssr: false }
);

const previews = {
  option1: {
    title: "Hero-Driven Layout",
    Component: Option1HeroDriven,
  },
  option2: {
    title: "Product-First Layout",
    Component: Option2ProductFirst,
  },
  option3: {
    title: "Scrollytelling Narrative",
    Component: Option3Scrollytelling,
  },
} as const;

type OptionKey = keyof typeof previews;

export default function PreviewPage({
  params,
}: {
  params: { option: string };
}) {
  const key = params.option as OptionKey;
  const preview = previews[key];

  if (!preview) {
    notFound();
  }

  const { Component, title } = preview;

  return (
    <div className="min-h-screen bg-[#060913]">
      {/* Preview Navigation */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-black/80 backdrop-blur-md border border-white/20 rounded-full p-2">
        {Object.entries(previews).map(([option, { title: optionTitle }]) => (
          <Link
            key={option}
            href={`/preview/${option}`}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              key === option
                ? "bg-[var(--primary)] text-black"
                : "text-gray-400 hover:text-white"
            }`}
            title={optionTitle}
          >
            {option.replace("option", "Option ")}
          </Link>
        ))}
      </nav>

      {/* Render the selected component */}
      <Component />
    </div>
  );
}