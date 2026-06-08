import styles from './cartSummary.module.css'

export default function CartSummary({ cartItems, onGoCart }) {
  const count = cartItems.reduce((acc, x) => acc + (x.quantity || 0), 0)
  return (
    <button type="button" className={styles.btn} onClick={onGoCart}>
      <span className={styles.title}>Cart</span>
      <span className={styles.badge}>{count} items</span>
    </button>
  )
}

