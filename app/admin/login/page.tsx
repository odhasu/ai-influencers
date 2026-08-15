import { redirect } from "next/navigation";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { AdminLoginForm } from "./login-form";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/dashboard");

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.mark}>AR</div>
        <p className={styles.eyebrow}>Funnel operations</p>
        <h1>Sign in to Authentic Resell</h1>
        <p className={styles.copy}>Manage leads, conversion data, follow-ups, and funnel settings.</p>
        <AdminLoginForm configured={isAdminConfigured()} />
      </section>
    </main>
  );
}
