"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import styles from "./login.module.css";

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const result = (await response.json()) as { ok?: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setStatus("error");
      setMessage(result.message ?? "Sign in failed.");
      return;
    }

    window.location.assign("/dashboard");
  }

  if (!configured) {
    return (
      <div className={styles.configuration}>
        <LockKeyhole size={18} aria-hidden="true" />
        <p>
          Set <code>DASHBOARD_PASSWORD</code> and <code>DASHBOARD_SESSION_SECRET</code> in your deployment environment to enable production access.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        Dashboard password
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {status === "error" ? <p className={styles.error}>{message}</p> : null}
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? <LoaderCircle className={styles.spin} size={18} /> : null}
        <span>{status === "loading" ? "Signing in…" : "Open dashboard"}</span>
        {status !== "loading" ? <ArrowRight size={18} /> : null}
      </button>
    </form>
  );
}
