import { TEMPLATES } from '../templates/registry'
import styles from './TemplateSwitcher.module.css'

/**
 * Temporary preview control for comparing templates on a live menu.
 * Replace with the owner's stored template choice once `template_id` exists on
 * the restaurants table.
 */
export function TemplateSwitcher({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <span className={styles.label}>Preview</span>
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            className={`${styles.option} ${active === template.id ? styles.active : ''}`}
            onClick={() => onSelect(template.id)}
            title={template.description}
          >
            {template.name}
          </button>
        ))}
      </div>
    </div>
  )
}
