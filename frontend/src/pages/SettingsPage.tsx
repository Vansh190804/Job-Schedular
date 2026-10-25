import { Settings } from 'lucide-react'
import { Page } from '../components/shared'

export function SettingsPage() {
  return (
    <Page title="Settings" subtitle="Personalize the frontend experience.">
      <section className="panel settings-panel">
        <div className="panel-header">
          <div><h3>Appearance</h3><p className="muted">Schedulr uses a dark-first interface designed for long sessions.</p></div>
          <Settings size={18} className="panel-icon" />
        </div>
        <div className="setting-row">
          <div><strong>Theme</strong><small>Dark mode is the default and currently the only supported theme.</small></div>
          <span className="badge">Dark</span>
        </div>
      </section>
    </Page>
  )
}
