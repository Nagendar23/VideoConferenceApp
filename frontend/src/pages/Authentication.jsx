import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar, Alert } from '@mui/material'; // Keep Snackbar for now or replace with custom toast later if needed

const Authentication = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  // 0 = Login, 1 = Register
  const [formState, setFormState] = useState(location.state?.formState || 0);
  const [open, setOpen] = useState(false);

  const { handleRegister, handleLogin } = useContext(AuthContext);

  useEffect(() => {
    // Reset errors when switching modes
    setError("");
    setMessage("");
  }, [formState]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (formState === 0) {
        // LOGIN
        await handleLogin(email, password);
        navigate("/dashboard");
      } else {
        // REGISTER
        let result = await handleRegister(name, email, username, password);
        console.log(result);
        setUsername("");
        setName("");
        setPassword("");
        setEmail("");
        setMessage(result);
        setOpen(true);
        setError("");
        setFormState(0); // Switch to login after success
      }
    } catch (err) {
      console.log(err);
      let message = err.response?.data?.message || "An error occurred";
      setError(message);
    }
  };

  return (
    <div className='min-h-screen w-full bg-zinc-950 font-sans text-gray-100 flex items-center justify-center relative overflow-hidden p-6'>

      {/* BACKGROUND TEXTURE (Consistent with Landing Page) */}
      <div className="absolute inset-0 max-w-full z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md bg-zinc-900/60 border border-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className='text-3xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-blue-500'>
            {formState === 0 ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-zinc-400 text-sm">
            {formState === 0 ? "Enter your credentials to access your account" : "Join us and start collaborating securely"}
          </p>
        </div>

        {/* Toggle (Login / Register) */}
        <div className="flex bg-zinc-950/50 p-1.5 rounded-xl mb-8 border border-white/5">
          <button
            onClick={() => setFormState(0)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${formState === 0 ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setFormState(1)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${formState === 1 ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-5">

          {formState === 1 && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950/50 text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-zinc-600"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide ml-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-950/50 text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-zinc-600"
                  placeholder="@johndoe"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide ml-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950/50 text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-zinc-600"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950/50 text-white px-4 py-3 rounded-xl border border-zinc-800 focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all placeholder:text-zinc-600"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold shadow-lg shadow-sky-500/20 hover:opacity-90 hover:shadow-sky-500/40 hover:translate-y-[-1px] active:translate-y-[0px] transition-all duration-200 mt-2"
          >
            {formState === 0 ? "Sign In" : "Create Account"}
          </button>

        </form>

        {/* Footer Text */}
        <p className="mt-8 text-center text-zinc-500 text-sm">
          {formState === 0 ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setFormState(formState === 0 ? 1 : 0)}
            className="text-sky-400 font-semibold hover:text-sky-300 transition-colors"
          >
            {formState === 0 ? "Sign Up" : "Sign In"}
          </button>
        </p>

      </div>

      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>

    </div>
  );
}

export default Authentication;
