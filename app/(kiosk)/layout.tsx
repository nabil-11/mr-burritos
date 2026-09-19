export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light min-h-screen bg-gray-50" dir="ltr">
      {children}
    </div>
  )
}
