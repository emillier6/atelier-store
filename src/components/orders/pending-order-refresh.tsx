"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const INTERVAL_MS = 2000;
const GIVE_UP_AFTER = 15; // tries, about 30 seconds

/**
 * Re-renders the success page until the webhook has written the order.
 * After about 30 seconds it stops and says where the order will appear.
 */
export function PendingOrderRefresh() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const waiting = tries < GIVE_UP_AFTER;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [router, tries, waiting]);

  return (
    <p role="status" className="text-body text-muted">
      {waiting
        ? "Your payment went through. Confirming your order…"
        : "Your payment went through, but confirming the order is taking longer than usual. It will appear in your account in a few minutes."}
    </p>
  );
}
