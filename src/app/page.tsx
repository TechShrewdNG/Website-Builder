import Image from 'next/image';
import Link from 'next/link';
import type { Session } from 'next-auth';

import { auth } from '@/lib/auth';
import Icon, { type IconName } from '@/components/Icon';

const CAPABILITIES = ['Import any HTML', 'Drag-and-drop editing', 'Export clean code', 'Publish in one click'];

const FEATURES: {
  eyebrow: string;
  heading: React.ReactNode;
  body: string;
  icon: IconName;
  image: string;
  imageAlt: string;
}[] = [
  {
    eyebrow: 'Import & edit',
    heading: (
      <>
        Bring in <em className="italic text-mktGold">any</em> site you already have.
      </>
    ),
    body: 'Upload a single HTML file, a folder, or a .zip of a template. Every class and stylesheet rule is preserved, local images and linked CSS are resolved automatically, and the whole thing becomes something you can click and drag — without redesigning it first.',
    icon: 'upload',
    image: '/marketing/import.png',
    imageAlt: 'The dashboard import panel, with options for an HTML file, a folder, or a .zip archive',
  },
  {
    eyebrow: 'Build from scratch',
    heading: (
      <>
        Or start with <em className="italic text-mktGold">nothing</em> and build up.
      </>
    ),
    body: 'Sections, columns, headings, images, lists, tables, sliders, tabs, accordions — drop them onto the canvas and arrange them by hand. Every widget ships real, accessible markup, not a black box you can never quite adjust.',
    icon: 'grid',
    image: '/marketing/build.png',
    imageAlt: 'The editor showing the widget palette on the left and a page under construction on the canvas',
  },
  {
    eyebrow: 'Style with precision',
    heading: (
      <>
        Style <em className="italic text-mktGold">one</em> element, or every element like it.
      </>
    ),
    body: 'Adjust a single element on its own, or open the rule editor and change every button on the site at once. Hover and focus states, per-breakpoint layout, and design tokens pulled straight from your palette — no stylesheet required.',
    icon: 'code',
    image: '/marketing/style.png',
    imageAlt: 'The style panel for a selected heading, with normal, hover, and focus states and layout controls',
  },
  {
    eyebrow: 'Publish or own it',
    heading: (
      <>
        Ship a link, or take the <em className="italic text-mktGold">code</em> with you.
      </>
    ),
    body: 'Publish instantly to a shareable URL with SEO, a sitemap, and social cards built in. Or export plain HTML, CSS, and images that run on any host, for as long as you want — nothing to keep paying for just to stay online.',
    icon: 'download',
    image: '/marketing/publish.png',
    imageAlt: 'A page published live at its own URL',
  },
];

const DIFFERENTIATORS = [
  {
    title: 'What you see is what ships',
    body: 'The exact markup in the editor is what gets published or exported. Nothing is rewritten behind the scenes on save.',
  },
  {
    title: 'Real code, not a black box',
    body: 'Every widget renders semantic HTML. Turn off JavaScript and sliders, tabs, and accordions still read correctly.',
  },
  {
    title: 'Your stylesheet stays yours',
    body: "Import a template and its original CSS is left untouched. Your edits layer on top, and any of them can be undone.",
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Import or start blank',
    body: 'Bring a template in — file, folder, or .zip — or open an empty page and build from nothing.',
  },
  {
    number: '02',
    title: 'Drag, drop, style',
    body: 'Arrange widgets on the canvas, tune every style down to one element, preview at any width.',
  },
  {
    number: '03',
    title: 'Publish or export',
    body: 'Get a live URL in one click, or download the code. Either way, what you built is yours.',
  },
];

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="mkt-theme relative min-h-dvh overflow-hidden">
      <Nav session={session} />

      <main>
        <Hero session={session} />
        <CapabilityStrip />
        <FeatureList />
        <Differentiators />
        <Process />
        <FinalCta session={session} />
      </main>

      <Footer />
    </div>
  );
}

function Nav({ session }: { session: Session | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-mktBorder/15 bg-mktBg/85 backdrop-blur-md">
      <div
        className="mx-auto flex max-w-6xl items-center gap-3"
        style={{ paddingInline: 'var(--mkt-gutter)', paddingBlock: '1.1rem' }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-mktGold text-mktBg">
          <Icon name="grid" size={16} />
        </span>
        <span className="font-head text-[13px] font-bold uppercase tracking-[0.12em] text-mktText">
          Website Builder
        </span>

        <nav className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <Link href="/dashboard" className="mkt-btn-primary h-9 px-4 text-[12px]">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-9 items-center px-3 font-head text-[11px] font-bold uppercase tracking-[0.14em] text-mktTextMuted transition-colors hover:text-mktText sm:inline-flex"
              >
                Sign in
              </Link>
              <Link href="/register" className="mkt-btn-primary h-9 px-4 text-[12px]">
                Start building
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Hero({ session }: { session: Session | null }) {
  return (
    <section className="relative">
      <div
        className="mkt-glow -top-32 left-1/2 h-[560px] w-[900px] -translate-x-1/2 bg-mktPurple/25"
        aria-hidden="true"
      />
      <div
        className="mkt-glow -top-10 right-[8%] h-[300px] w-[300px] bg-mktGold/10"
        aria-hidden="true"
      />

      <div
        className="relative mx-auto max-w-4xl text-center"
        style={{ paddingInline: 'var(--mkt-gutter)', paddingTop: 'clamp(6rem, 14vw, 9rem)', paddingBottom: '5rem' }}
      >
        <p className="mkt-eyebrow mb-7 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-mktGold/50" aria-hidden="true" />
          Drag-and-drop · real HTML · no lock-in
          <span className="h-px w-8 bg-mktGold/50" aria-hidden="true" />
        </p>

        <h1 className="font-display text-balance text-[clamp(2.6rem,7vw,5.5rem)] font-light leading-[1.05] tracking-[-0.02em] text-mktText">
          Build your dream website
          <br />
          <em className="italic text-mktGold">yourself.</em>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-pretty text-[16px] leading-relaxed text-mktTextMuted">
          Import a template you already have, or start from a blank page. Drag sections into
          place, tune every style down to a single element, then publish — or export the same
          clean HTML and CSS you saw in the editor.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {session?.user ? (
            <Link href="/dashboard" className="mkt-btn-primary h-12 px-6 text-[13px]">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/register" className="mkt-btn-primary h-12 px-6 text-[13px]">
                Start building — free
              </Link>
              <Link href="/login" className="mkt-btn-ghost h-12 px-6 text-[13px]">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function CapabilityStrip() {
  return (
    <section className="border-y border-mktBorder/15 bg-mktBgSection/60">
      <div
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4"
        style={{ paddingInline: 'var(--mkt-gutter)', paddingBlock: '1.75rem' }}
      >
        {CAPABILITIES.map((label) => (
          <span key={label} className="font-head text-[11px] font-bold uppercase tracking-[0.18em] text-mktTextMuted">
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

function FeatureList() {
  return (
    <section style={{ paddingBlock: 'var(--mkt-section-py)' }}>
      <div className="mx-auto max-w-6xl" style={{ paddingInline: 'var(--mkt-gutter)' }}>
        <div className="flex flex-col gap-20">
          {FEATURES.map((feature, index) => {
            const reversed = index % 2 === 1;
            return (
              <article
                key={feature.eyebrow}
                className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${reversed ? 'md:[&>*:first-child]:order-2' : ''}`}
              >
                <div>
                  <p className="mkt-eyebrow mb-4">{feature.eyebrow}</p>
                  <h2 className="font-display text-balance text-[clamp(1.9rem,3.4vw,2.7rem)] font-light leading-[1.15] text-mktText">
                    {feature.heading}
                  </h2>
                  <p className="mt-5 max-w-md text-pretty text-[14.5px] leading-relaxed text-mktTextMuted">
                    {feature.body}
                  </p>
                </div>

                <div
                  className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-mktBorder/20 bg-mktBgSection p-5"
                  style={{ boxShadow: '0 2px 40px rgba(107,33,200,0.1)' }}
                >
                  {/* object-contain, not object-cover: these are screenshots of
                      the real product, at whatever aspect ratio they were
                      captured — cropping one at random risks cutting off the
                      exact detail the section is illustrating. */}
                  <Image
                    src={feature.image}
                    alt={feature.imageAlt}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-contain p-3 opacity-95 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-mktGold/40 bg-mktBg/80 text-mktGold backdrop-blur-sm"
                  >
                    <Icon name={feature.icon} size={16} />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Differentiators() {
  return (
    <section className="border-y border-mktBorder/15 bg-mktBgSection" style={{ paddingBlock: 'var(--mkt-section-py)' }}>
      <div className="mx-auto max-w-5xl" style={{ paddingInline: 'var(--mkt-gutter)' }}>
        <p className="mkt-eyebrow mb-4 text-center">Why it's built this way</p>
        <h2 className="mx-auto max-w-lg text-balance text-center font-display text-[clamp(1.8rem,3vw,2.4rem)] font-light leading-[1.2] text-mktText">
          A builder that hands you back <em className="italic text-mktGold">control</em>, not a
          subscription.
        </h2>

        <div className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-3">
          {DIFFERENTIATORS.map((item) => (
            <div key={item.title}>
              <div className="mb-4 h-px w-10 bg-mktGold" aria-hidden="true" />
              <h3 className="font-head text-[13px] font-bold uppercase tracking-[0.06em] text-mktText">
                {item.title}
              </h3>
              <p className="mt-3 text-pretty text-[13.5px] leading-relaxed text-mktTextMuted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section style={{ paddingBlock: 'var(--mkt-section-py)' }}>
      <div className="mx-auto max-w-5xl" style={{ paddingInline: 'var(--mkt-gutter)' }}>
        <p className="mkt-eyebrow mb-4 text-center">How it works</p>
        <h2 className="text-balance text-center font-display text-[clamp(1.8rem,3vw,2.4rem)] font-light leading-[1.2] text-mktText">
          Three steps between you and <em className="italic text-mktGold">live</em>.
        </h2>

        <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => (
            <div key={step.number} className="border-t border-mktBorder/25 pt-6">
              <span className="font-display text-[2.2rem] font-light italic leading-none text-mktGold">
                {step.number}
              </span>
              <h3 className="mt-4 font-head text-[13px] font-bold uppercase tracking-[0.06em] text-mktText">
                {step.title}
              </h3>
              <p className="mt-3 text-pretty text-[13.5px] leading-relaxed text-mktTextMuted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ session }: { session: Session | null }) {
  if (session?.user) return null;

  return (
    <section className="relative overflow-hidden border-t border-mktBorder/15 bg-mktBgSection">
      <div className="mkt-glow left-1/2 top-1/2 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 bg-mktPurple/20" aria-hidden="true" />

      <div
        className="relative mx-auto max-w-2xl text-center"
        style={{ paddingInline: 'var(--mkt-gutter)', paddingBlock: 'var(--mkt-section-py)' }}
      >
        <h2 className="font-display text-balance text-[clamp(2rem,4.5vw,3.2rem)] font-light leading-[1.15] text-mktText">
          Your dream website.
          <br />
          <em className="italic text-mktGold">Built by you.</em>
        </h2>
        <p className="mx-auto mt-5 max-w-sm text-pretty text-[14.5px] leading-relaxed text-mktTextMuted">
          No credit card. No code required. Just drag, drop, and publish.
        </p>
        <Link href="/register" className="mkt-btn-primary mt-8 inline-flex h-12 px-6 text-[13px]">
          Create your account
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-mktBorder/15">
      <div
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-mktTextMuted"
        style={{ paddingInline: 'var(--mkt-gutter)', paddingBlock: '1.75rem' }}
      >
        <span className="font-head font-bold uppercase tracking-[0.1em]">Website Builder</span>
        <span aria-hidden="true">·</span>
        <span>
          Published sites live at <code className="text-mktCream">/s/&lt;slug&gt;</code>
        </span>
      </div>
    </footer>
  );
}
