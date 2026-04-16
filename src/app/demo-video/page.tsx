export const metadata = {
  title: "Demo Recording | GridOps ETR",
  description: "Screen recording walkthrough of the GridOps ETR demo.",
};

export default function DemoVideoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-5xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Demo Recording
        </h1>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
          <video
            className="w-full"
            controls
            autoPlay
            playsInline
            preload="metadata"
            src="/demo-recording.mp4"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <p className="text-sm text-[#8a8f98]">
          GridOps ETR &mdash; outage restoration operations walkthrough.
        </p>
      </div>
    </main>
  );
}
