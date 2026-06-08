import styles from './topBar.module.css'

export default function TopBar({ mode, onReset }) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.brand}>KFC • Voice + Touch</div>
        <div className={styles.sub}>
          {mode === 'voice' ? 'Voice Mode' : mode === 'touch' ? 'Touch Mode' : 'Select Mode'}
        </div>
      </div>
      <div className={styles.right}>
        <button type="button" className={styles.reset} onClick={onReset}>
          Close Session
        </button>
      </div>
    </div>
  )
}

