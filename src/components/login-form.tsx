"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui";
import { SignInError, demoEmailFor, signIn, signInAsDemo } from "@/lib/api/session";
import { ROLES, ROLE_LABELS } from "@/lib/domain/permissions";
import { reloadTo } from "@/lib/navigation";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-10 text-sm outline-none transition-colors placeholder:text-ink-3 focus:border-primary focus:ring-3 focus:ring-primary-soft aria-invalid:border-bad";

/** Where to go after signing in: the page that was asked for, if it is a local path. */
function destination() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Sign-in form over the mock auth service (`src/lib/api/session.ts`).
 * Accounts are the seeded users; the role picker fills in the demo account
 * for each role. Every role lands on its own home page (US-02).
 */
export function LoginForm() {
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState(() => demoEmailFor("student"));
  const [password, setPassword] = useState("learn-demo");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const chooseRole = (next: Role) => {
    setRole(next);
    setEmail(demoEmailFor(next));
    setErrors({});
  };

  const enter = () => reloadTo(destination());

  const signInWithPassword = async () => {
    setPending(true);
    setNotice(null);
    try {
      await signIn(email, password);
      enter();
    } catch (error) {
      setErrors({
        form: error instanceof SignInError ? error.message : "Something went wrong. Try again.",
      });
      setPending(false);
    }
  };

  /** MOCK: stands in for the school identity provider (FR-1.3) until Phase 1. */
  const signInWithSso = () => {
    setPending(true);
    reloadTo(destination(), () => signInAsDemo(role));
  };

  const submit = () => {
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address, like name@school.edu.";
    }
    if (password.length < 6) {
      nextErrors.password = "Your password must be at least 6 characters.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) void signInWithPassword();
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-ink-2">Sign in to pick up where you left off.</p>

      <fieldset className="mt-8">
        <legend className="mb-1.5 text-sm font-medium">Demo account</legend>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
          {ROLES.map((option) => (
            <label
              key={option}
              className="relative flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-ink-2 transition-colors hover:text-ink has-checked:bg-surface has-checked:text-ink has-checked:shadow-xs has-focus-visible:outline-2 has-focus-visible:outline-primary"
            >
              <input
                type="radio"
                name="demo-role"
                className="sr-only"
                checked={role === option}
                onChange={() => chooseRole(option)}
              />
              {ROLE_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <form
        noValidate
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <div className="relative">
            <Mail aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              placeholder="name@school.edu"
              className={INPUT_CLASS}
            />
          </div>
          {errors.email ? (
            <p id="login-email-error" className="mt-1.5 text-sm text-bad">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <button
              type="button"
              onClick={() => setNotice("Password reset isn't connected in this demo yet.")}
              className="text-sm font-medium text-primary-ink hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              className={cn(INPUT_CLASS, "pr-11")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
          {errors.password ? (
            <p id="login-password-error" className="mt-1.5 text-sm text-bad">
              {errors.password}
            </p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="size-4 accent-primary"
          />
          Keep me signed in on this device
        </label>

        {errors.form ? (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {errors.form}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
          {pending ? "Signing in…" : "Sign in"}
          {pending ? null : <ArrowRight aria-hidden className="size-4" />}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button variant="secondary" size="lg" disabled={pending} onClick={signInWithSso} className="w-full">
        Continue with school account (SSO)
      </Button>

      <p className="mt-6 text-center text-sm text-ink-2">
        New here?{" "}
        <button
          type="button"
          onClick={() => setNotice("Sign-up isn't connected in this demo yet — use the demo account above.")}
          className="font-medium text-primary-ink hover:underline"
        >
          Create an account
        </button>
      </p>

      <p role="status" className={cn("mt-4 rounded-lg px-3 py-2 text-center text-xs", notice ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-3")}>
        {notice ?? "Demo: pick a role to fill in its account. Any password of 6 or more characters works."}
      </p>
    </div>
  );
}
