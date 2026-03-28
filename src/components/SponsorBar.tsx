import Image from 'next/image'
import { SPONSORS } from '@/constants/sponsors'
import { PL } from '@/constants/pl'

export default function SponsorBar() {
  return (
    <div className="py-8 border-b border-white/10">
      <p
        className="text-center text-white/40 text-xs font-semibold uppercase tracking-widest mb-6"
        style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', letterSpacing: '0.15em' }}
      >
        {PL.sponsors.title}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
        {SPONSORS.map((sponsor) => (
          <a
            key={sponsor.name}
            href={sponsor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center opacity-50 hover:opacity-100 grayscale hover:grayscale-0 transition-all duration-300"
            title={sponsor.name}
          >
            <Image
              src={sponsor.logo}
              alt={sponsor.name}
              width={120}
              height={40}
              className="object-contain max-h-10"
              style={{ maxHeight: '40px', width: 'auto' }}
            />
          </a>
        ))}
      </div>
    </div>
  )
}
