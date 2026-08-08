import Link from 'next/link';

import { auth } from '@/lib/auth';
import Icon, { type IconName } from '@/components/Icon';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'upload',
    title: 'Import and edit',
    body: 'Bring in a static template. Its stylesheet and class names are preserved, so it looks like itself before you change anything.',
  },
  {
    icon: 'grid',
    title: 'Build from scratch',
    body: 'Sections, columns, headings, images and buttons — plus sliders, tabs, accordions and counters that ship working markup.',
  },
  {
    icon: 'mobile',
    title: 'Responsive by breakpoint',
    body: 'Separate styles for desktop, tablet and mobile. Narrower screens inherit from wider ones until you override them.',
  },
  {
    icon: 'download',
    title: 'Output you own',
    body: 'Publish to a URL, or download plain HTML, CSS and images that run on any host. No runtime, no lock-in.',
  },
];

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="ws-grain relative min-h-dvh overflow-hidden">
      {/* Off-centre glow: gives the page a light source without a banner image. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-[58%] rounded-full opacity-[0.13] blur-[120px]"
        style={{ background: 'radial-gradient(circle, #d79b3c 0%, transparent 70%)' }}
      />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accentInk">
          <Icon name="grid" size={17} />
        </span>
        <span className="text-[14px] font-semibold">Website Builder</span>

        <nav className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <Link href="/dashboard" className="ws-btn-primary h-9">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="ws-btn h-9">
                Sign in
              </Link>
              <Link href="/register" className="ws-btn-primary h-9">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-28">
        <section className="max-w-2xl pt-16 sm:pt-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1 text-[12px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            Drag-and-drop editing for static HTML
          </p>

          <h1 className="text-balance text-[44px] font-semibold leading-[1.05] tracking-display text-white sm:text-[60px]">
            Edit any HTML site
            <br />
            <span className="text-accent">without touching the code.</span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-[16px] leading-relaxed text-muted">
            Import an existing template or start from a blank page, rearrange it visually, then
            publish it or download clean static files. The markup you get out is the markup you saw
            in the editor.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {session?.user ? (
              <Link href="/dashboard" className="ws-btn-primary h-11 px-5 text-[15px]">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/register" className="ws-btn-primary h-11 px-5 text-[15px]">
                  Create an account
                </Link>
                <Link href="/login" className="ws-btn h-11 px-5 text-[15px]">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Offset two-column grid rather than a row of equal cards. */}
        <section className="mt-24 grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <article key={feature.title} className={index % 2 === 1 ? 'sm:mt-10' : undefined}>
              <span className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-panel text-accent">
                <Icon name={feature.icon} size={17} />
              </span>
              <h2 className="text-[15px] font-semibold text-white">{feature.title}</h2>
              <p className="mt-2 max-w-sm text-pretty text-[13.5px] leading-relaxed text-muted">
                {feature.body}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-edge">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-6 text-[12px] text-faint">
          <span>Website Builder</span>
          <span aria-hidden="true">·</span>
          <span>
            Published sites live at <code className="text-muted">/s/&lt;slug&gt;</code>
          </span>
        </div>
      </footer>
    </div>
  );
}
