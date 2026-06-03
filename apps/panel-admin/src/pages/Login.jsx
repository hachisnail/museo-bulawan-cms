import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";

export default function Login() {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.username.trim() || !formData.password.trim()) {
      setError("Please provide both username and password.");
      triggerShake();
      return;
    }

    setIsLoading(true);

    try {
      const baseURL = import.meta.env.DEV
        ? ""
        : import.meta.env.VITE_API_BASE_URL || "";
      
      const res = await fetch(`${baseURL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Authentication failed. Please check your credentials."
        );
      }

      login(data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans selection:bg-zinc-900 selection:text-white">
      {/* --- Inline CSS for Shake Animation --- */}
      <style>{`
        @keyframes loginShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: loginShake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>

      {/* --- Left Column: Institutional Branding (Hidden on Mobile) --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center p-12 overflow-hidden border-r border-zinc-900">
        <div className="absolute inset-0 bg-black/30 z-10"></div>
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-700 via-zinc-950 to-black"></div>

        <div className="z-20 w-full max-w-md space-y-4">
          <div className="h-[2px] w-8 bg-zinc-500 rounded-full"></div>
          <div>
            <h2 className="text-3xl font-serif text-white tracking-tight leading-tight">
              Museo Bulawan
            </h2>
            <h3 className="text-sm font-semibold text-zinc-400 tracking-wider uppercase mt-1">
              Collection Management System
            </h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed font-light">
            Secure administrative terminal for collection registries, automated catalog data metadata structures, and physical curatorial zone configurations.
          </p>
        </div>
      </div>

      {/* --- Right Column: Clean, Dense Login Terminal --- */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-12 sm:px-16 md:px-20 bg-white relative">
        <div className="mx-auto w-full max-w-sm">
          
          {/* Brand Header */}
          <div className="flex flex-col mb-6">
            <div className="flex items-center gap-3">
              <img src="/LOGO.png" alt="Museo Bulawan" className="w-10 h-10 object-contain flex-shrink-0" />
              <div className="flex flex-col justify-center">
                <h1 className="text-base font-serif font-bold leading-tight text-zinc-900 tracking-tight">
                  Museo Bulawan
                </h1>
                <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                  Authorized Personnel Only
                </h2>
              </div>
            </div>
          </div>

          {/* Smooth Error Container */}
          <div className="transition-all duration-300 ease-in-out overflow-hidden mb-3">
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden rounded-lg border ${
                error
                  ? "opacity-100 max-h-20 border-red-200 bg-red-50/50 p-2.5"
                  : "opacity-0 max-h-0 border-transparent p-0"
              }`}
            >
              <div className="flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="font-medium leading-normal tracking-wide flex-1">{error}</span>
              </div>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className={`space-y-1.5 ${isShaking && (!formData.username || error) ? 'animate-shake' : ''}`}>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500 ${
                  error || (isShaking && !formData.username)
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                    : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                }`}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                value={formData.username}
                disabled={isLoading}
                placeholder="Enter admin username"
              />
            </div>

            <div className={`space-y-1.5 ${isShaking && (!formData.password || error) ? 'animate-shake' : ''}`}>
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-950 transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                className={`block w-full rounded-lg border px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-1 transition-all shadow-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500 ${
                  error || (isShaking && !formData.password)
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500' 
                    : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950'
                }`}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                value={formData.password}
                disabled={isLoading}
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-xs font-bold tracking-wider uppercase text-white shadow-md hover:bg-zinc-800 hover:-translate-y-[1px] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating
                  </>
                ) : (
                  <>
                    Login
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}