import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

export default function PasswordInput({ value, onChange, placeholder = "Password" }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
      />
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-sage-300 bg-white py-2.5 pl-9 pr-10 text-sm text-night-800 outline-none transition-all duration-200 focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-sage-400 transition-colors hover:text-mint-400"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
