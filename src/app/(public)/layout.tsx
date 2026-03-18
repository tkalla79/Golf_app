import Navbar from '@/components/Navbar'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      <footer className="bg-[var(--color-primary)] text-white text-center py-4 mt-auto text-sm">
        &copy; {new Date().getFullYear()} Karolinka Golf Park &middot; Don Papa Match Play
      </footer>
    </>
  )
}
