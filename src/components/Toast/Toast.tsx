import { dismissToast, useToast } from "./toast";
import styles from "./Toast.module.css";

export default function Toaster() {
  const message = useToast();
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message && (
        <div key={message.id} className={styles.slip}>
          <span>{message.text}</span>
          {message.action && (
            <button
              type="button"
              className={`caps ${styles.action}`}
              onClick={() => {
                message.action?.run();
                dismissToast();
              }}
            >
              {message.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
