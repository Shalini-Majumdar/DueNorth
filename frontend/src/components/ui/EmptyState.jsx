import { motion } from "framer-motion";

export default function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      {Icon ? <Icon size={48} className="text-sage-300" strokeWidth={1.5} /> : null}
      <p className="mt-4 text-lg text-sage-400">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-sage-400">{subtitle}</p> : null}
    </motion.div>
  );
}
