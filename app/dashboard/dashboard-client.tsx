"use client";

import {
  ArrowUpRight,
  AtSign,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  CircleDollarSign,
  Download,
  ExternalLink,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  MousePointerClick,
  Phone,
  Plus,
  PlayCircle,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DashboardEvent, DashboardLead, DashboardPayload, LeadStatus, ReferralLink } from "@/lib/dashboard-data";
import type { FunnelSettings } from "@/lib/funnel-settings";
import styles from "./dashboard.module.css";

type Tab = "overview" | "leads" | "referrals" | "settings";
type ReferralDraft = {
  id?: string;
  label: string;
  platform: string;
  placement: string;
  code: string;
  destinationPath: string;
  notes: string;
  isActive: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

const statusLabels: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  booked: "Booked",
  won: "Won",
  lost: "Lost"
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function percentage(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function hasInstagramHandle(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed && trimmed !== "not_provided");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function emptyReferralDraft(): ReferralDraft {
  return {
    label: "Instagram profile",
    platform: "Instagram",
    placement: "Profile bio",
    code: "instagram-profile",
    destinationPath: "/waitlist",
    notes: "",
    isActive: true,
    utmSource: "instagram",
    utmMedium: "social",
    utmCampaign: "waitlist",
    utmContent: "profile-bio",
    utmTerm: ""
  };
}

function draftFromReferralLink(link: ReferralLink): ReferralDraft {
  return {
    id: link.id,
    label: link.label,
    platform: link.platform,
    placement: link.placement,
    code: link.code,
    destinationPath: link.destination_path,
    notes: link.notes,
    isActive: link.is_active,
    utmSource: link.utm_source,
    utmMedium: link.utm_medium,
    utmCampaign: link.utm_campaign,
    utmContent: link.utm_content,
    utmTerm: link.utm_term
  };
}

function referralUrl(link: ReferralLink | ReferralDraft, origin = "") {
  const destination = "destination_path" in link ? link.destination_path : link.destinationPath;
  const code = link.code;
  const params = new URLSearchParams({ ref: code });
  const utmSource = "utm_source" in link ? link.utm_source : link.utmSource;
  const utmMedium = "utm_medium" in link ? link.utm_medium : link.utmMedium;
  const utmCampaign = "utm_campaign" in link ? link.utm_campaign : link.utmCampaign;
  const utmContent = "utm_content" in link ? link.utm_content : link.utmContent;
  const utmTerm = "utm_term" in link ? link.utm_term : link.utmTerm;

  if (utmSource) params.set("utm_source", utmSource);
  if (utmMedium) params.set("utm_medium", utmMedium);
  if (utmCampaign) params.set("utm_campaign", utmCampaign);
  if (utmContent) params.set("utm_content", utmContent);
  if (utmTerm) params.set("utm_term", utmTerm);

  return `${origin}${destination}?${params.toString()}`;
}

function parseReferralUrlInput(value: string, origin: string, current: ReferralDraft): ReferralDraft {
  const trimmed = value.trim();
  if (!trimmed) return current;

  if (!trimmed.includes("/") && !trimmed.includes("?") && !trimmed.includes(".")) {
    const code = slugify(trimmed);
    return code ? { ...current, code } : current;
  }

  try {
    const url = new URL(trimmed, origin || "http://localhost:3001");
    const code = slugify(url.searchParams.get("ref") ?? current.code);
    const destinationPath = url.pathname.startsWith("/") ? url.pathname : current.destinationPath;

    return {
      ...current,
      code: code || current.code,
      destinationPath,
      utmSource: url.searchParams.get("utm_source") ?? current.utmSource,
      utmMedium: url.searchParams.get("utm_medium") ?? current.utmMedium,
      utmCampaign: url.searchParams.get("utm_campaign") ?? current.utmCampaign,
      utmContent: url.searchParams.get("utm_content") ?? current.utmContent,
      utmTerm: url.searchParams.get("utm_term") ?? current.utmTerm
    };
  } catch {
    return current;
  }
}

function referralStatsFor(link: ReferralLink, leads: DashboardLead[], events: DashboardEvent[]) {
  const leadMatches = leads.filter((lead) => lead.referral_code === link.code || lead.referral_link_id === link.id);
  const eventMatches = events.filter((event) => event.referral_code === link.code || event.referral_link_id === link.id);
  const sessions = (eventName: string) =>
    new Set(eventMatches.filter((event) => event.event_name === eventName).map((event) => event.session_id)).size;

  return {
    views: sessions("landing_viewed"),
    starts: sessions("form_started"),
    leads: leadMatches.length,
    booked: leadMatches.filter((lead) => lead.lead_status === "booked").length,
    won: leadMatches.filter((lead) => lead.lead_status === "won").length,
    lost: leadMatches.filter((lead) => lead.lead_status === "lost").length,
    closed: leadMatches.filter((lead) => lead.lead_status === "won" || lead.lead_status === "lost").length
  };
}

export function DashboardClient({
  initialPayload,
  developmentBypass
}: {
  initialPayload: DashboardPayload;
  developmentBypass: boolean;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [leads, setLeads] = useState(initialPayload.leads);
  const [referralLinks, setReferralLinks] = useState(initialPayload.referralLinks);
  const [referralDraft, setReferralDraft] = useState<ReferralDraft>(emptyReferralDraft());
  const [savingReferral, setSavingReferral] = useState(false);
  const [deletingReferralId, setDeletingReferralId] = useState<string | null>(null);
  const [settings, setSettings] = useState(initialPayload.settings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [selectedLead, setSelectedLead] = useState<DashboardLead | null>(null);
  const [leadDraft, setLeadDraft] = useState<DashboardLead | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState("");

  const analytics = useMemo(() => {
    const sessions = (eventName: string) =>
      new Set(initialPayload.events.filter((event) => event.event_name === eventName).map((event) => event.session_id))
        .size;
    const visits = sessions("landing_viewed");
    const starts = sessions("form_started");
    const submissions = new Set(
      initialPayload.events
        .filter((event) => event.event_name === "form_submit_succeeded")
        .map((event) => event.session_id)
    ).size;
    const today = dayKey(new Date());
    const todayLeads = leads.filter((lead) => lead.created_at.slice(0, 10) === today).length;
    const highIntent = leads.filter((lead) => ["$1K - $3K USD", "$3K+ USD"].includes(lead.budget_range)).length;
    const visitorEvents = initialPayload.events.filter((event) => event.event_name === "page_viewed");
    const uniqueVisitors = new Set(visitorEvents.map((event) => event.visitor_id || event.session_id)).size;
    const returningVisitors = new Set(
      visitorEvents
        .filter((event) => event.metadata.is_returning_visitor === true)
        .map((event) => event.visitor_id || event.session_id)
    ).size;
    const bookings = sessions("booking_completed");
    const payments = sessions("payment_succeeded");
    const abandons = sessions("form_abandoned");
    const vslStarts = sessions("vsl_started");
    const vslCompletions = sessions("vsl_completed");
    const engagementEvents = initialPayload.events.filter((event) => event.event_name === "page_engagement_recorded");
    const averageEngagedMs = engagementEvents.length
      ? engagementEvents.reduce((sum, event) => {
          const value = event.metadata.engaged_ms;
          return sum + (typeof value === "number" ? value : event.elapsed_ms ?? 0);
        }, 0) / engagementEvents.length
      : 0;

    const trend = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (6 - offset));
      const key = dayKey(date);
      return {
        key,
        label: date.toLocaleDateString("en", { weekday: "short" }),
        count: leads.filter((lead) => lead.created_at.slice(0, 10) === key).length
      };
    });

    const byStatus = (Object.keys(statusLabels) as LeadStatus[]).map((status) => ({
      status,
      count: leads.filter((lead) => lead.lead_status === status).length
    }));
    const sources = new Map<string, number>();
    leads.forEach((lead) => {
      const referral = referralLinks.find((link) => link.id === lead.referral_link_id || link.code === lead.referral_code);
      const source = referral?.label || lead.referral_code || lead.utm_source || "Direct / unknown";
      sources.set(source, (sources.get(source) ?? 0) + 1);
    });

    return {
      visits,
      starts,
      submissions,
      todayLeads,
      highIntent,
      uniqueVisitors,
      returningVisitors,
      bookings,
      payments,
      abandons,
      vslStarts,
      vslCompletions,
      averageEngagedMs,
      conversion: visits ? (submissions / visits) * 100 : 0,
      startRate: visits ? (starts / visits) * 100 : 0,
      bookingRate: submissions ? (bookings / submissions) * 100 : 0,
      vslCompletionRate: vslStarts ? (vslCompletions / vslStarts) * 100 : 0,
      funnelStages: [
        ["Landing views", visits],
        ["Form starts", starts],
        ["Applications", submissions],
        ["Bookings", bookings],
        ["Won", leads.filter((lead) => lead.lead_status === "won").length]
      ] as Array<[string, number]>,
      trend,
      byStatus,
      topSources: [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }, [initialPayload.events, leads, referralLinks]);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "all" || lead.lead_status === statusFilter;
      const matchesSearch =
        !term ||
        [lead.full_name, lead.email, lead.phone_number, lead.instagram, lead.referral_code ?? "", lead.utm_source ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [leads, search, statusFilter]);

  function openLead(lead: DashboardLead) {
    setSelectedLead(lead);
    setLeadDraft({ ...lead, tags: [...lead.tags] });
  }

  async function saveLead() {
    if (!leadDraft) return;
    setSavingLead(true);
    setNotice("");
    const response = await fetch(`/api/admin/leads/${leadDraft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadStatus: leadDraft.lead_status,
        notes: leadDraft.notes,
        followUpAt: leadDraft.follow_up_at,
        assignedTo: leadDraft.assigned_to,
        tags: leadDraft.tags
      })
    });
    const result = (await response.json()) as { ok?: boolean; lead?: DashboardLead; message?: string };
    setSavingLead(false);
    if (!response.ok || !result.ok || !result.lead) {
      setNotice(result.message ?? "Lead update failed.");
      return;
    }
    setLeads((current) => current.map((lead) => (lead.id === result.lead?.id ? result.lead : lead)));
    setSelectedLead(result.lead);
    setLeadDraft({ ...result.lead, tags: [...result.lead.tags] });
    setNotice("Lead updated.");
  }

  async function saveSettings() {
    setSavingSettings(true);
    setNotice("");
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    const result = (await response.json()) as { ok?: boolean; settings?: FunnelSettings; message?: string };
    setSavingSettings(false);
    if (!response.ok || !result.ok || !result.settings) {
      setNotice(result.message ?? "Settings update failed.");
      return;
    }
    setSettings(result.settings);
    setNotice("Settings saved. The public funnel is now using them.");
  }

  async function saveReferralLink() {
    setSavingReferral(true);
    setNotice("");
    const response = await fetch("/api/admin/referral-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(referralDraft)
    });
    const result = (await response.json()) as { ok?: boolean; referralLink?: ReferralLink; message?: string };
    setSavingReferral(false);
    if (!response.ok || !result.ok || !result.referralLink) {
      setNotice(result.message ?? "Referral link update failed.");
      return;
    }

    const savedReferralLink = result.referralLink;
    setReferralLinks((current) => {
      const exists = current.some((link) => link.id === savedReferralLink.id);
      if (exists) return current.map((link) => (link.id === savedReferralLink.id ? savedReferralLink : link));
      return [savedReferralLink, ...current];
    });
    setReferralDraft(draftFromReferralLink(savedReferralLink));
    setNotice("Referral link saved.");
  }

  async function deleteReferralLink(id: string) {
    setDeletingReferralId(id);
    setNotice("");
    const response = await fetch("/api/admin/referral-links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const result = (await response.json()) as { ok?: boolean; message?: string };
    setDeletingReferralId(null);
    if (!response.ok || !result.ok) {
      setNotice(result.message ?? "Referral link delete failed.");
      return;
    }
    setReferralLinks((current) => current.filter((link) => link.id !== id));
    if (referralDraft.id === id) setReferralDraft(emptyReferralDraft());
    setNotice("Referral link deleted.");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.assign("/admin/login");
  }

  return (
    <div className={styles.app} data-private>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>LR</div>
          <div>
            <strong>Funnel OS</strong>
            <span>{settings.campaignName}</span>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Dashboard sections">
          <button className={activeTab === "overview" ? styles.active : ""} onClick={() => setActiveTab("overview")}>
            <BarChart3 size={18} /> Overview
          </button>
          <button className={activeTab === "leads" ? styles.active : ""} onClick={() => setActiveTab("leads")}>
            <Users size={18} /> Leads <span className={styles.navCount}>{leads.length}</span>
          </button>
          <button className={activeTab === "referrals" ? styles.active : ""} onClick={() => setActiveTab("referrals")}>
            <Link2 size={18} /> Referral links <span className={styles.navCount}>{referralLinks.length}</span>
          </button>
          <button className={activeTab === "settings" ? styles.active : ""} onClick={() => setActiveTab("settings")}>
            <Settings2 size={18} /> Funnel settings
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <a href="/waitlist" target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> View public funnel
          </a>
          {!developmentBypass ? (
            <button onClick={logout}>
              <LogOut size={16} /> Sign out
            </button>
          ) : (
            <span className={styles.devBadge}>Local admin bypass</span>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <p>Funnel operations</p>
            <h1>{activeTab === "overview" ? "Overview" : activeTab === "leads" ? "Lead pipeline" : activeTab === "referrals" ? "Referral links" : "Funnel settings"}</h1>
          </div>
          <div className={styles.topbarActions}>
            {notice ? <span className={styles.notice}>{notice}</span> : null}
            {activeTab === "leads" ? (
              <a className={styles.secondaryButton} href="/api/admin/export">
                <Download size={17} /> Export CSV
              </a>
            ) : null}
          </div>
        </header>

        {initialPayload.error ? <div className={styles.errorBanner}>{initialPayload.error}</div> : null}

        {activeTab === "overview" ? (
          <OverviewTab leads={leads} analytics={analytics} />
        ) : activeTab === "leads" ? (
          <LeadsTab
            leads={filteredLeads}
            search={search}
            statusFilter={statusFilter}
            onSearch={setSearch}
            onStatusFilter={setStatusFilter}
            onOpenLead={openLead}
          />
        ) : activeTab === "referrals" ? (
          <ReferralLinksTab
            links={referralLinks}
            leads={leads}
            events={initialPayload.events}
            draft={referralDraft}
            saving={savingReferral}
            deletingId={deletingReferralId}
            onDraftChange={setReferralDraft}
            onSave={saveReferralLink}
            onDelete={deleteReferralLink}
            onEdit={(link) => setReferralDraft(draftFromReferralLink(link))}
          />
        ) : (
          <SettingsTab
            settings={settings}
            webhookConfigured={initialPayload.webhookConfigured}
            saving={savingSettings}
            onChange={setSettings}
            onSave={saveSettings}
          />
        )}
      </main>

      {selectedLead && leadDraft ? (
        <LeadDrawer
          lead={leadDraft}
          saving={savingLead}
          onChange={setLeadDraft}
          onClose={() => {
            setSelectedLead(null);
            setLeadDraft(null);
          }}
          onSave={saveLead}
        />
      ) : null}
    </div>
  );
}

function OverviewTab({
  leads,
  analytics
}: {
  leads: DashboardLead[];
  analytics: {
    visits: number;
    starts: number;
    submissions: number;
    todayLeads: number;
    highIntent: number;
    uniqueVisitors: number;
    returningVisitors: number;
    bookings: number;
    payments: number;
    abandons: number;
    vslStarts: number;
    vslCompletions: number;
    averageEngagedMs: number;
    conversion: number;
    startRate: number;
    bookingRate: number;
    vslCompletionRate: number;
    funnelStages: Array<[string, number]>;
    trend: Array<{ key: string; label: string; count: number }>;
    byStatus: Array<{ status: LeadStatus; count: number }>;
    topSources: Array<[string, number]>;
  };
}) {
  const maxTrend = Math.max(1, ...analytics.trend.map((day) => day.count));
  const maxStatus = Math.max(1, ...analytics.byStatus.map((item) => item.count));
  const maxFunnel = Math.max(1, ...analytics.funnelStages.map(([, count]) => count));

  return (
    <div className={styles.content}>
      <section className={styles.metricsGrid}>
        <MetricCard icon={Users} label="Total leads" value={String(leads.length)} detail={`${analytics.todayLeads} today`} />
        <MetricCard icon={MousePointerClick} label="Unique visitors" value={String(analytics.uniqueVisitors)} detail={`${analytics.visits} landing views`} />
        <MetricCard icon={RefreshCw} label="Returning visitors" value={String(analytics.returningVisitors)} detail="Consented visitors" />
        <MetricCard icon={Target} label="Form start rate" value={percentage(analytics.startRate)} detail={`${analytics.starts} starts`} />
        <MetricCard icon={CheckCircle2} label="Conversion rate" value={percentage(analytics.conversion)} detail={`${analytics.highIntent} high-intent leads`} />
        <MetricCard icon={CalendarCheck} label="Booking rate" value={percentage(analytics.bookingRate)} detail={`${analytics.bookings} bookings`} />
        <MetricCard icon={PlayCircle} label="VSL completion" value={percentage(analytics.vslCompletionRate)} detail={`${analytics.vslStarts} starts`} />
        <MetricCard icon={Clock3} label="Average engagement" value={`${Math.round(analytics.averageEngagedMs / 1000)}s`} detail="Active page time" />
        <MetricCard icon={CircleDollarSign} label="Payments" value={String(analytics.payments)} detail="Server-confirmed" />
      </section>

      <section className={styles.overviewGrid}>
        <article className={styles.panelWide}>
          <div className={styles.panelHeader}>
            <div><p>Performance</p><h2>Leads over the last 7 days</h2></div>
            <span>{analytics.trend.reduce((sum, day) => sum + day.count, 0)} leads</span>
          </div>
          <div className={styles.trendChart}>
            {analytics.trend.map((day) => (
              <div className={styles.trendDay} key={day.key}>
                <span className={styles.barValue}>{day.count}</span>
                <div className={styles.barTrack}><div style={{ height: `${Math.max(5, (day.count / maxTrend) * 100)}%` }} /></div>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><p>Pipeline</p><h2>Lead status</h2></div></div>
          <div className={styles.breakdownList}>
            {analytics.byStatus.map((item) => (
              <div key={item.status}>
                <span>{statusLabels[item.status]} <strong>{item.count}</strong></span>
                <div><i style={{ width: `${(item.count / maxStatus) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><p>Funnel</p><h2>Stage conversion</h2></div></div>
          <div className={styles.breakdownList}>
            {analytics.funnelStages.map(([label, count]) => (
              <div key={label}>
                <span>{label} <strong>{count}</strong></span>
                <div><i style={{ width: `${(count / maxFunnel) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><p>Behavior</p><h2>Drop-off signals</h2></div></div>
          <div className={styles.sourceList}>
            <div><span>1</span><p>Form abandons</p><strong>{analytics.abandons}</strong></div>
            <div><span>2</span><p>VSL starts</p><strong>{analytics.vslStarts}</strong></div>
            <div><span>3</span><p>VSL completions</p><strong>{analytics.vslCompletions}</strong></div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><p>Acquisition</p><h2>Top lead sources</h2></div></div>
          <div className={styles.sourceList}>
            {analytics.topSources.length ? analytics.topSources.map(([source, count], index) => (
              <div key={source}><span>{index + 1}</span><p>{source}</p><strong>{count}</strong></div>
            )) : <p className={styles.emptyText}>Source data appears when leads arrive with UTM parameters.</p>}
          </div>
        </article>

        <article className={styles.panelWide}>
          <div className={styles.panelHeader}><div><p>Recent activity</p><h2>Newest applications</h2></div></div>
          <div className={styles.recentList}>
            {leads.slice(0, 5).map((lead) => (
              <div key={lead.id}>
                <div className={styles.avatar}>{lead.full_name.slice(0, 2).toUpperCase()}</div>
                <div><strong>{lead.full_name}</strong><span>{lead.email}</span></div>
                <span className={`${styles.status} ${styles[lead.lead_status]}`}>{statusLabels[lead.lead_status]}</span>
                <p>{new Date(lead.created_at).toLocaleDateString()}</p>
              </div>
            ))}
            {!leads.length ? <p className={styles.emptyText}>No applications yet. New submissions will appear here automatically.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricIcon}><Icon size={18} /></div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span><ArrowUpRight size={14} /> {detail}</span>
    </article>
  );
}

function LeadsTab({
  leads,
  search,
  statusFilter,
  onSearch,
  onStatusFilter,
  onOpenLead
}: {
  leads: DashboardLead[];
  search: string;
  statusFilter: LeadStatus | "all";
  onSearch: (value: string) => void;
  onStatusFilter: (value: LeadStatus | "all") => void;
  onOpenLead: (lead: DashboardLead) => void;
}) {
  return (
    <div className={styles.content}>
      <section className={styles.leadsPanel}>
        <div className={styles.filters}>
          <label className={styles.search}><Search size={17} /><input value={search} placeholder="Search name, email, phone or source" onChange={(event) => onSearch(event.target.value)} /></label>
          <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as LeadStatus | "all")}>
            <option value="all">All statuses</option>
            {(Object.keys(statusLabels) as LeadStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
          </select>
          <span className={styles.resultCount}>{leads.length} results</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Lead</th><th>Status</th><th>Budget</th><th>Source</th><th>Submitted</th><th /></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} onClick={() => onOpenLead(lead)}>
                  <td><div className={styles.leadCell}><div className={styles.avatar}>{lead.full_name.slice(0, 2).toUpperCase()}</div><div><strong>{lead.full_name}</strong><span>{lead.email}</span></div></div></td>
                  <td><span className={`${styles.status} ${styles[lead.lead_status]}`}>{statusLabels[lead.lead_status]}</span></td>
                  <td>{lead.budget_range}</td>
                  <td>{lead.referral_code || lead.utm_source || "Direct"}</td>
                  <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td><ChevronRight size={17} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!leads.length ? <div className={styles.emptyState}><Users size={26} /><h3>No matching leads</h3><p>Adjust your filters or wait for the next application.</p></div> : null}
        </div>
      </section>
    </div>
  );
}

function ReferralLinksTab({
  links,
  leads,
  events,
  draft,
  saving,
  deletingId,
  onDraftChange,
  onSave,
  onDelete,
  onEdit
}: {
  links: ReferralLink[];
  leads: DashboardLead[];
  events: DashboardEvent[];
  draft: ReferralDraft;
  saving: boolean;
  deletingId: string | null;
  onDraftChange: (draft: ReferralDraft) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onEdit: (link: ReferralLink) => void;
}) {
  const [copiedCode, setCopiedCode] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const [shareLinkInput, setShareLinkInput] = useState(() => referralUrl(draft, origin));
  const presets = [
    ["Instagram", "Profile bio", "Instagram profile"],
    ["Instagram", "Story sticker", "Instagram story"],
    ["YouTube", "Video description", "YouTube description"],
    ["TikTok", "Profile bio", "TikTok bio"],
    ["Facebook", "Group post", "Facebook group"],
    ["Discord", "Community channel", "Discord community"]
  ] as const;

  function setDraft(nextDraft: ReferralDraft) {
    onDraftChange(nextDraft);
    setShareLinkInput(referralUrl(nextDraft, origin));
  }

  function updateDraft(changes: Partial<ReferralDraft>) {
    setDraft({ ...draft, ...changes });
  }

  function updateShareLink(value: string) {
    setShareLinkInput(value);
    onDraftChange(parseReferralUrlInput(value, origin, draft));
  }

  function applyPreset(platform: string, placement: string, label: string) {
    const code = slugify(`${platform}-${placement}`);
    setDraft({
      ...emptyReferralDraft(),
      label,
      platform,
      placement,
      code,
      utmSource: slugify(platform),
      utmContent: slugify(placement)
    });
  }

  async function copyLink(link: ReferralLink) {
    const url = referralUrl(link, origin);
    await navigator.clipboard.writeText(url);
    setCopiedCode(link.code);
    window.setTimeout(() => setCopiedCode(""), 1400);
  }

  return (
    <div className={styles.content}>
      <section className={styles.referralLayout}>
        <div className={styles.referralBuilder}>
          <div className={styles.panelHeader}>
            <div><p>Builder</p><h2>{draft.id ? "Edit referral link" : "Create referral link"}</h2></div>
            {draft.id ? (
              <button className={styles.secondaryButton} onClick={() => setDraft(emptyReferralDraft())}>
                <Plus size={16} /> New link
              </button>
            ) : null}
          </div>

          <div className={styles.presetGrid}>
            {presets.map(([platform, placement, label]) => (
              <button type="button" key={`${platform}-${placement}`} onClick={() => applyPreset(platform, placement, label)}>
                {label}
              </button>
            ))}
          </div>

          <div className={styles.settingsGrid}>
            <label>Label<input value={draft.label} onChange={(event) => updateDraft({ label: event.target.value })} /></label>
            <label>Platform<input value={draft.platform} onChange={(event) => updateDraft({ platform: event.target.value })} /></label>
            <label>Placement<input value={draft.placement} onChange={(event) => updateDraft({ placement: event.target.value })} /></label>
            <label className={styles.fullField}>Share link<input value={shareLinkInput} placeholder={`${origin}/waitlist?ref=tiktok-bio`} onChange={(event) => updateShareLink(event.target.value)} /></label>
            <label>Link slug<input value={draft.code} onChange={(event) => updateDraft({ code: slugify(event.target.value) })} /></label>
            <label>Page after click<input value={draft.destinationPath} onChange={(event) => updateDraft({ destinationPath: event.target.value })} /></label>
            <label>UTM source<input value={draft.utmSource} onChange={(event) => updateDraft({ utmSource: event.target.value })} /></label>
            <label>UTM medium<input value={draft.utmMedium} onChange={(event) => updateDraft({ utmMedium: event.target.value })} /></label>
            <label>UTM campaign<input value={draft.utmCampaign} onChange={(event) => updateDraft({ utmCampaign: event.target.value })} /></label>
            <label>UTM content<input value={draft.utmContent} onChange={(event) => updateDraft({ utmContent: event.target.value })} /></label>
            <label>UTM term<input value={draft.utmTerm} onChange={(event) => updateDraft({ utmTerm: event.target.value })} /></label>
            <label className={styles.fullField}>Notes<textarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} /></label>
          </div>

          <div className={styles.previewLink}>
            <span>{referralUrl(draft, origin)}</span>
          </div>

          <div className={styles.referralActions}>
            <SwitchRow
              title="Active link"
              description="Inactive links keep their code visible but stop attaching the saved link record to new leads."
              checked={draft.isActive}
              onChange={(value) => updateDraft({ isActive: value })}
            />
            <button className={styles.primaryButton} disabled={saving} onClick={onSave}>
              {saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />} Save referral link
            </button>
          </div>
        </div>

        <div className={styles.referralListPanel}>
          <div className={styles.panelHeader}>
            <div><p>Attribution</p><h2>Links and performance</h2></div>
            <span>{links.length} links</span>
          </div>

          <div className={styles.referralCards}>
            {links.map((link) => {
              const stats = referralStatsFor(link, leads, events);
              return (
                <article className={styles.referralCard} key={link.id}>
                  <div className={styles.referralCardHeader}>
                    <div>
                      <strong>{link.label}</strong>
                      <span>{link.platform} / {link.placement}</span>
                    </div>
                    <span className={link.is_active ? styles.connected : styles.disconnected}>{link.is_active ? "Active" : "Paused"}</span>
                  </div>

                  <div className={styles.referralUrlRow}>
                    <code>{referralUrl(link, origin)}</code>
                    <button aria-label={`Copy ${link.label} link`} onClick={() => copyLink(link)}>
                      <Clipboard size={15} />
                    </button>
                  </div>
                  {copiedCode === link.code ? <p className={styles.copiedText}>Copied</p> : null}

                  <div className={styles.referralStats}>
                    <span><strong>{stats.views}</strong> Views</span>
                    <span><strong>{stats.starts}</strong> Starts</span>
                    <span><strong>{stats.leads}</strong> Leads</span>
                    <span><strong>{stats.booked}</strong> Booked</span>
                    <span><strong>{stats.won}</strong> Won</span>
                    <span><strong>{stats.closed}</strong> Closed</span>
                  </div>

                  <div className={styles.referralCardActions}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setShareLinkInput(referralUrl(link, origin));
                        onEdit(link);
                      }}
                    >
                      <Settings2 size={15} /> Edit
                    </button>
                    <button
                      className={styles.dangerButton}
                      disabled={deletingId === link.id}
                      onClick={() => onDelete(link.id)}
                    >
                      {deletingId === link.id ? <LoaderCircle className={styles.spin} size={15} /> : <Trash2 size={15} />} Delete
                    </button>
                  </div>
                </article>
              );
            })}
            {!links.length ? (
              <div className={styles.emptyState}>
                <Link2 size={26} />
                <h3>No referral links yet</h3>
                <p>Create one for each profile, bio, description, story, post, or community placement.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function LeadDrawer({
  lead,
  saving,
  onChange,
  onClose,
  onSave
}: {
  lead: DashboardLead;
  saving: boolean;
  onChange: (lead: DashboardLead) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className={styles.drawerBackdrop} onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <aside className={styles.drawer} aria-label="Lead details">
        <div className={styles.drawerHeader}>
          <div className={styles.avatarLarge}>{lead.full_name.slice(0, 2).toUpperCase()}</div>
          <div><p>Lead profile</p><h2>{lead.full_name}</h2><span>Applied {new Date(lead.created_at).toLocaleString()}</span></div>
          <button aria-label="Close lead details" onClick={onClose}>&times;</button>
        </div>

        <div className={styles.contactActions}>
          <a href={`mailto:${lead.email}`}><Mail size={16} /> Email</a>
          <a href={`tel:${lead.phone_number}`}><Phone size={16} /> Call</a>
          {hasInstagramHandle(lead.instagram) ? (
            <a href={`https://instagram.com/${lead.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><AtSign size={16} /> Instagram</a>
          ) : (
            <span className={styles.disabledContact}><AtSign size={16} /> Instagram skipped</span>
          )}
        </div>

        <div className={styles.drawerForm}>
          <label>Status<select value={lead.lead_status} onChange={(event) => onChange({ ...lead, lead_status: event.target.value as LeadStatus })}>{(Object.keys(statusLabels) as LeadStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label>
          <label>Follow up<input type="datetime-local" value={localDateTime(lead.follow_up_at)} onChange={(event) => onChange({ ...lead, follow_up_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
          <label>Assigned to<input value={lead.assigned_to ?? ""} placeholder="Team member" onChange={(event) => onChange({ ...lead, assigned_to: event.target.value || null })} /></label>
          <label>Tags<input value={lead.tags.join(", ")} placeholder="hot, follow-up" onChange={(event) => onChange({ ...lead, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10) })} /></label>
          <label className={styles.fullField}>Notes<textarea value={lead.notes} placeholder="Add context from calls and DMs…" onChange={(event) => onChange({ ...lead, notes: event.target.value })} /></label>
        </div>

        <section className={styles.qualification}>
          <h3>Qualification</h3>
          <dl>
            <div><dt>Budget</dt><dd>{lead.budget_range}</dd></div>
            <div><dt>Experience</dt><dd>{lead.reselling_experience}</dd></div>
            <div><dt>Goal</dt><dd>{lead.long_term_goal}</dd></div>
            <div><dt>Age</dt><dd>{lead.age_range}</dd></div>
            <div><dt>Location</dt><dd>{[lead.city, lead.country].filter(Boolean).join(", ") || "Unknown"}</dd></div>
            <div><dt>Referral</dt><dd>{lead.referral_code || "None"}</dd></div>
            <div><dt>Source</dt><dd>{lead.utm_source || "Direct / unknown"}</dd></div>
            <div><dt>Referrer</dt><dd>{lead.referrer_domain || "Direct / unknown"}</dd></div>
            <div><dt>Visitor sessions</dt><dd>{lead.session_number}</dd></div>
            <div><dt>Timezone</dt><dd>{lead.timezone || "Unknown"}</dd></div>
            <div><dt>Ad click ID</dt><dd>{lead.gclid ? "Google" : lead.fbclid ? "Meta" : lead.ttclid ? "TikTok" : lead.msclkid ? "Microsoft" : "None"}</dd></div>
          </dl>
        </section>

        <div className={styles.drawerFooter}><button className={styles.secondaryButton} onClick={onClose}>Cancel</button><button className={styles.primaryButton} disabled={saving} onClick={onSave}>{saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />} Save lead</button></div>
      </aside>
    </div>
  );
}

function SettingsTab({
  settings,
  webhookConfigured,
  saving,
  onChange,
  onSave
}: {
  settings: FunnelSettings;
  webhookConfigured: boolean;
  saving: boolean;
  onChange: (settings: FunnelSettings) => void;
  onSave: () => void;
}) {
  const set = <K extends keyof FunnelSettings>(key: K, value: FunnelSettings[K]) => onChange({ ...settings, [key]: value });
  return (
    <div className={styles.content}>
      <div className={styles.settingsLayout}>
        <section className={styles.settingsSection}>
          <div className={styles.settingsHeading}><div className={styles.settingsIcon}><Settings2 size={18} /></div><div><h2>Campaign and copy</h2><p>These changes appear on the public waitlist immediately.</p></div></div>
          <div className={styles.settingsGrid}>
            <label>Campaign name<input value={settings.campaignName} onChange={(event) => set("campaignName", event.target.value)} /></label>
            <label>Accent color<div className={styles.colorInput}><input type="color" value={settings.accentColor} onChange={(event) => set("accentColor", event.target.value)} /><input value={settings.accentColor} onChange={(event) => set("accentColor", event.target.value)} /></div></label>
            <label className={styles.fullField}>Hero headline<input value={settings.heroHeadline} onChange={(event) => set("heroHeadline", event.target.value)} /></label>
            <label className={styles.fullField}>Hero supporting copy<textarea value={settings.heroBody} onChange={(event) => set("heroBody", event.target.value)} /></label>
            <label>Application heading<input value={settings.waitlistHeading} onChange={(event) => set("waitlistHeading", event.target.value)} /></label>
            <label>CTA label<input value={settings.ctaLabel} onChange={(event) => set("ctaLabel", event.target.value)} /></label>
          </div>
        </section>

        <section className={styles.settingsSection}>
          <div className={styles.settingsHeading}><div className={styles.settingsIcon}><MousePointerClick size={18} /></div><div><h2>Form behavior</h2><p>Control availability, pacing, and proof sections.</p></div></div>
          <div className={styles.switchList}>
            <SwitchRow title="Accept applications" description="Turn off to pause the form without taking the page down." checked={settings.formEnabled} onChange={(value) => set("formEnabled", value)} />
            <SwitchRow title="Show proof gallery" description="Display the Inner Circle wins masonry gallery." checked={settings.showWins} onChange={(value) => set("showWins", value)} />
          </div>
          <div className={styles.settingsGridCompact}><label>Auto-advance delay (ms)<input type="number" min={0} max={2000} value={settings.autoAdvanceDelayMs} onChange={(event) => set("autoAdvanceDelayMs", Number(event.target.value))} /></label></div>
        </section>

        <section className={styles.settingsSection}>
          <div className={styles.settingsHeading}><div className={styles.settingsIcon}><Link2 size={18} /></div><div><h2>VSL and booking</h2><p>Customize the post-application experience.</p></div></div>
          <div className={styles.settingsGrid}>
            <label className={styles.fullField}>Thank-you VSL stream URL<input type="url" value={settings.thankYouVideoUrl} onChange={(event) => set("thankYouVideoUrl", event.target.value)} /></label>
            <label>Booking URL<input type="url" value={settings.bookingUrl} placeholder="https://cal.com/…" onChange={(event) => set("bookingUrl", event.target.value)} /></label>
            <label>Booking CTA label<input value={settings.bookingCtaLabel} onChange={(event) => set("bookingCtaLabel", event.target.value)} /></label>
          </div>
        </section>

        <section className={styles.settingsSection}>
          <div className={styles.settingsHeading}><div className={styles.settingsIcon}><ShieldCheck size={18} /></div><div><h2>Integrations</h2><p>Public IDs are stored in settings; secret webhook URLs remain server-only.</p></div></div>
          <div className={styles.integrationStatus}><span className={webhookConfigured ? styles.connected : styles.disconnected}>{webhookConfigured ? "Webhook environment configured" : "Webhook environment not configured"}</span></div>
          <div className={styles.switchList}><SwitchRow title="Send new-lead webhook" description="Requires LEAD_WEBHOOK_URL in the server environment." checked={settings.webhookEnabled} disabled={!webhookConfigured} onChange={(value) => set("webhookEnabled", value)} /></div>
          <div className={styles.settingsGrid}>
            <label>Notification email<input type="email" value={settings.notificationEmail} placeholder="owner@example.com" onChange={(event) => set("notificationEmail", event.target.value)} /></label>
            <label>Meta Pixel ID<input value={settings.metaPixelId} onChange={(event) => set("metaPixelId", event.target.value)} /></label>
            <label>TikTok Pixel ID<input value={settings.tiktokPixelId} onChange={(event) => set("tiktokPixelId", event.target.value)} /></label>
            <label>Google Tag ID<input value={settings.googleTagId} placeholder="G-XXXXXXXX" onChange={(event) => set("googleTagId", event.target.value)} /></label>
          </div>
        </section>

        <div className={styles.settingsFooter}><p>Changes are validated server-side before publication.</p><button className={styles.primaryButton} disabled={saving} onClick={onSave}>{saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />} Save settings</button></div>
      </div>
    </div>
  );
}

function SwitchRow({ title, description, checked, disabled = false, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.switchRow}><div><strong>{title}</strong><span>{description}</span></div><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
