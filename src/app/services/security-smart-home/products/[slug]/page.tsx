import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDivision, divisionPath } from '@/config/divisions';
import { products, getProduct, getPillar, productsInPillar, productPath } from '@/config/security';
import { themeVars } from '@/config/theme';
import { site, contactLinks } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { mediaMeta, imageSizes } from '@/lib/images';
import { Reveal } from '@/components/Reveal';
import { ArrowIcon, CheckIcon, PhoneIcon, WhatsAppIcon } from '@/components/icons';
import { breadcrumbJsonLd } from '@/lib/jsonld';

const SLUG = 'security-smart-home';
const division = getDivision(SLUG)!;

interface Params {
  params: { slug: string };
}

/** Every product becomes a static page at build time, straight from config. */
export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const product = getProduct(params.slug);
  if (!product) return {};
  const image = mediaMeta(product.image);
  const path = productPath(product.slug);

  return {
    title: `${product.name} | Security & Smart Home`,
    description: product.summary,
    alternates: { canonical: path },
    openGraph: {
      title: `${product.name} | ${site.name}`,
      description: product.summary,
      url: path,
      type: 'website',
      images: image ? [{ url: image.src, width: image.width, height: image.height }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const settings = await getSiteSettings();
  const { tel: telHref, wa: waHref } = contactLinks(settings);
  const product = getProduct(params.slug);
  if (!product) notFound();

  const image = mediaMeta(product.image);
  const pillar = getPillar(product.pillar);
  // Sibling products in the same pillar, for the "explore more" row.
  const siblings = productsInPillar(product.pillar).filter((p) => p.slug !== product.slug);

  return (
    <div style={themeVars(division.theme)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: division.name, path: divisionPath(SLUG) },
              { name: product.name, path: productPath(product.slug) },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.summary,
            category: pillar.name,
            brand: { '@type': 'Brand', name: 'Brinks Home Security' },
            image: image ? new URL(image.src, settings.url).toString() : undefined,
          }),
        }}
      />

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-gradient-to-b from-accent-soft to-transparent"
        />

        <div className="shell relative pb-16 pt-[calc(var(--header-h)+3rem)] md:pb-20 md:pt-[calc(var(--header-h)+5rem)]">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-caption text-ink-mute">
              <li>
                <Link href="/" className="transition-colors hover:text-accent-ink">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={divisionPath(SLUG)}
                  className="transition-colors hover:text-accent-ink"
                >
                  Security &amp; Smart Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-ink">{product.name}</li>
            </ol>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
            <div>
              <Link
                href={`${divisionPath(SLUG)}#products`}
                className="eyebrow-accent inline-flex items-center gap-1.5"
              >
                {pillar.name}
              </Link>
              <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(2.25rem,7vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
                {product.name}
              </h1>
              <p className="eyebrow-accent mt-4">{product.tagline}</p>
              <p className="mt-6 max-w-measure text-lead text-ink-soft">{product.summary}</p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link href={`${divisionPath(SLUG)}#build`} className="btn btn-accent">
                  Build My System
                  <ArrowIcon width={16} height={16} />
                </Link>
                <a href={telHref} data-cta="call" className="btn btn-ghost">
                  <PhoneIcon />
                  <span className="phone-number">{settings.contact.phoneDisplay}</span>
                </a>
              </div>
            </div>

            <div className="frame aspect-[4/3] w-full rounded-panel shadow-lift">
              {image ? (
                <Image
                  src={image.src}
                  alt={product.imageAlt}
                  width={image.width}
                  height={image.height}
                  sizes={imageSizes.split}
                  placeholder="blur"
                  blurDataURL={image.blurDataURL}
                  priority
                  className="frame-img"
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- body + specs */}
      <section className="bg-paper">
        <Reveal className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div data-reveal className="space-y-5">
              <p className="eyebrow">Overview</p>
              {product.body.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="max-w-prose text-body-lg text-ink-soft">
                  {paragraph}
                </p>
              ))}

              <div className="pt-4">
                <p className="eyebrow">What it does</p>
                <ul className="mt-4 grid gap-3">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckIcon width={18} height={18} className="mt-0.5 shrink-0 text-accent" />
                      <span className="text-body text-ink">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div data-reveal>
              <div className="card p-6 md:p-8">
                <p className="eyebrow">Good to know</p>
                <dl className="mt-5 divide-y divide-line">
                  {product.details.map((detail) => (
                    <div key={detail.label} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-4 py-3.5">
                      <dt className="text-caption font-semibold text-ink-mute">{detail.label}</dt>
                      <dd className="text-caption text-ink-soft">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
                {/* The placeholder specs are honest about being placeholders. */}
                <p className="mt-5 text-caption text-ink-mute">
                  Exact models and specifications are confirmed on the free consultation, matched
                  to your property.
                </p>
              </div>

              <a
                href={waHref}
                data-cta="whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost mt-4 w-full"
              >
                <WhatsAppIcon />
                Ask about the {product.name}
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* --------------------------------------------- more in this pillar */}
      {siblings.length > 0 ? (
        <section
          aria-labelledby="more-heading"
          className="border-t border-line bg-paper-sunk"
        >
          <div className="shell py-section">
            <Reveal className="mb-10">
              <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">More to {pillar.name.toLowerCase()}</p>
                  <h2 id="more-heading" className="display-3 mt-4 max-w-[18ch]">
                    Works with the rest of the system
                  </h2>
                </div>
                <Link
                  href={`${divisionPath(SLUG)}#products`}
                  className="inline-flex items-center gap-2 text-caption font-semibold text-ink underline decoration-line underline-offset-[6px] transition-colors hover:decoration-accent"
                >
                  All products
                  <ArrowIcon width={16} height={16} className="text-accent-ink" />
                </Link>
              </div>
            </Reveal>

            <Reveal as="ul" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {siblings.map((sibling) => {
                const siblingImage = mediaMeta(sibling.image);
                return (
                  <li key={sibling.slug} data-reveal>
                    <Link
                      href={productPath(sibling.slug)}
                      className="card card-interactive group flex h-full flex-col overflow-hidden focus-visible:outline-offset-4"
                    >
                      <div className="frame aspect-[16/10] w-full rounded-none">
                        {siblingImage ? (
                          <Image
                            src={siblingImage.src}
                            alt={sibling.imageAlt}
                            width={siblingImage.width}
                            height={siblingImage.height}
                            sizes={imageSizes.productCard}
                            placeholder="blur"
                            blurDataURL={siblingImage.blurDataURL}
                            className="frame-img"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="font-display text-card-title font-semibold text-ink">
                          {sibling.name}
                        </h3>
                        <p className="mt-2 text-body text-ink-soft">{sibling.tagline}</p>
                        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-caption font-semibold text-ink">
                          View details
                          <ArrowIcon
                            width={16}
                            height={16}
                            className="text-accent-ink transition-transform duration-300 ease-out-soft group-hover:translate-x-1"
                          />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </Reveal>
          </div>
        </section>
      ) : null}
    </div>
  );
}
