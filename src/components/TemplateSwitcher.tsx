import { Layers, X } from 'lucide-react'
import { useState } from 'react'
import { TEMPLATES } from '../templates/registry'
import styles from './TemplateSwitcher.module.css'

/**
 * Temporary preview control for comparing templates on a live menu.
 * Replace with the owner's stored template choice once `template_id` exists on
 * the restaurants table.
 *
 * Collapsed by default: full-screen templates like Reel put their price and
 * call to action at the bottom of the viewport, exactly where an always-open
 * bar would sit.
 */
export function TemplateSwitcher({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = TEMPLATES.find((template) => template.id === active)

  if (!open) {
    return (
      <div className={styles.bar}>
        <button className={styles.trigger} onClick={() => setOpen(true)}>
          <Layers />
          <span>{current?.name ?? 'Preview'}</span>
        </button>
      </div>
    )
  }

  return (
    <div className={styles.bar}>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.label}>Preview template</span>
          <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close template preview">
            <X />
          </button>
        </div>
        <div className={styles.options}>
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              className={`${styles.option} ${active === template.id ? styles.active : ''}`}
              onClick={() => onSelect(template.id)}
            >
              <span className={styles.optionName}>{template.name}</span>
              {template.scroll && <span className={styles.optionScroll}>{template.scroll}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
