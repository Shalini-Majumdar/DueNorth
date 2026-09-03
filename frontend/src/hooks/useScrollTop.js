import { useEffect, useState } from "react";

export function useScrollTop(threshold = 300) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

  return { visible, scrollToTop };
}
