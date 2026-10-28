import { t } from './strings'

const REPO_URL = 'https://github.com/doit2/pdf-diet'

export default function App() {
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 flex flex-col">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{t.appName}</h1>
        <p className="mt-2 text-lg text-stone-600">{t.tagline}</p>
        <div className="mt-8 rounded-2xl border-2 border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-stone-700">{t.comingSoon}</p>
          <p className="mt-3 text-sm text-teal-800">{t.privacy}</p>
        </div>
      </main>
      <footer className="w-full max-w-2xl mx-auto px-4 py-6 text-sm text-stone-500 flex gap-3">
        <a className="underline" href={REPO_URL} target="_blank" rel="noreferrer">{t.source}</a>
        <span>·</span>
        <span>{t.license}</span>
        <span>·</span>
        <span>v{__APP_VERSION__}</span>
      </footer>
    </div>
  )
}
