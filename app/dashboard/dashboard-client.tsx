"use client";

import {
  ArrowUpRight,
  AtSign,
  BarChart3,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  CircleDollarSign,
  Download,
  ExternalLink,
  History,
  Inbox,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquareText,
  MousePointerClick,
  Phone,
  Plus,
  PlayCircle,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trash2,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DashboardEvent, DashboardLead, DashboardPayload, LeadStatus, ReferralLink } from "@/lib/dashboard-data";
import type { FunnelSettings } from "@/lib/funnel-settings";
import styles from "./dashboard.module.css";

type Tab = "overview" | "leads" | "analytics" | "referrals" | "settings";
type AnalyticsRange = "7" | "14" | "30" | "90" | "all" | "custom";
type LeadInbox = "new" | "handled" | "all";
type LeadTimeRange = "all" | "today" | "7" | "30" | "custom";
type FollowUpFilter = "all" | "overdue" | "today" | "upcoming" | "none";
type LeadSort = "newest" | "oldest" | "follow_up";
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

function dateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function analyticsRangeBounds(range: AnalyticsRange, customStart: string, customEnd: string) {
  const end = range === "custom" && customEnd ? new Date(`${customEnd}T00:00:00`) : new Date();
  end.setHours(0, 0, 0, 0);
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);

  if (range === "all") return { startMs: 0, endMs: endExclusive.getTime() };

  const start = range === "custom" && customStart ? new Date(`${customStart}T00:00:00`) : new Date(end);
  if (range !== "custom") start.setDate(start.getDate() - (Number(range) - 1));
  start.setHours(0, 0, 0, 0);

  return start <= end
    ? { startMs: start.getTime(), endMs: endExclusive.getTime() }
    : { startMs: end.getTime(), endMs: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime() };
}

function analyticsRangeLabel(range: AnalyticsRange, customStart: string, customEnd: string) {
  if (range === "all") return "All available data";
  if (range !== "custom") return `Last ${range} days`;
  if (!customStart || !customEnd) return "Custom date range";
  const format = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  return `${format(customStart)} – ${format(customEnd)}`;
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

function hasInstagramHandle(value: string | null): value is string {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== "not_provided");
}

function phoneDigits(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function validPhone(value: string | null) {
  return phoneDigits(value).length >= 7;
}

function messagePrefill(fullName: string) {
  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName ? `Hi ${firstName}!` : "";
}

function smsLinkFor(lead: DashboardLead) {
  if (!validPhone(lead.phone_number)) return undefined;
  const body = encodeURIComponent(messagePrefill(lead.full_name));
  return `sms:${lead.phone_number}?&body=${body}`;
}

function whatsappLinkFor(lead: DashboardLead) {
  if (!validPhone(lead.phone_number)) return undefined;
  const text = encodeURIComponent(messagePrefill(lead.full_name));
  return `https://wa.me/${phoneDigits(lead.phone_number)}?text=${text}`;
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
  const [leadInbox, setLeadInbox] = useState<LeadInbox>("new");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [leadTimeRange, setLeadTimeRange] = useState<LeadTimeRange>("all");
  const [leadCustomStart, setLeadCustomStart] = useState("");
  const [leadCustomEnd, setLeadCustomEnd] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>("all");
  const [leadSort, setLeadSort] = useState<LeadSort>("newest");
  const [selectedLead, setSelectedLead] = useState<DashboardLead | null>(null);
  const [leadDraft, setLeadDraft] = useState<DashboardLead | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("30");
  const [customStart, setCustomStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return dateInputValue(date);
  });
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(new Date()));

  const analyticsRangeData = useMemo(
    () => analyticsRangeBounds(analyticsRange, customStart, customEnd),
    [analyticsRange, customEnd, customStart]
  );
  const analyticsLeads = useMemo(
    () => leads.filter((lead) => {
      const timestamp = new Date(lead.created_at).getTime();
      return timestamp >= analyticsRangeData.startMs && timestamp < analyticsRangeData.endMs;
    }),
    [analyticsRangeData, leads]
  );
  const analyticsEvents = useMemo(
    () => initialPayload.events.filter((event) => {
      const timestamp = new Date(event.created_at).getTime();
      return timestamp >= analyticsRangeData.startMs && timestamp < analyticsRangeData.endMs;
    }),
    [analyticsRangeData, initialPayload.events]
  );

  const analytics = useMemo(() => {
    const sessions = (eventName: string) =>
      new Set(analyticsEvents.filter((event) => event.event_name === eventName).map((event) => event.session_id))
        .size;
    const visits = sessions("landing_viewed");
    const starts = sessions("form_started");
    const submissions = new Set(
      analyticsEvents
        .filter((event) => event.event_name === "form_submit_succeeded")
        .map((event) => event.session_id)
    ).size;
    const today = dayKey(new Date());
    const todayLeads = analyticsLeads.filter((lead) => lead.created_at.slice(0, 10) === today).length;
    const highIntent = analyticsLeads.filter((lead) => lead.budget_range !== "Under $200 USD").length;
    const visitorEvents = analyticsEvents.filter((event) => event.event_name === "page_viewed");
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
    const engagementEvents = analyticsEvents.filter((event) => event.event_name === "page_engagement_recorded");
    const averageEngagedMs = engagementEvents.length
      ? engagementEvents.reduce((sum, event) => {
          const value = event.metadata.engaged_ms;
          return sum + (typeof value === "number" ? value : event.elapsed_ms ?? 0);
        }, 0) / engagementEvents.length
      : 0;

    const availableStart = analyticsLeads.length
      ? Math.min(...analyticsLeads.map((lead) => new Date(lead.created_at).getTime()))
      : analyticsRangeData.endMs - 7 * 86_400_000;
    const chartStartMs = analyticsRange === "all" ? availableStart : analyticsRangeData.startMs;
    const totalDays = Math.max(1, Math.ceil((analyticsRangeData.endMs - chartStartMs) / 86_400_000));
    const bucketDays = Math.max(1, Math.ceil(totalDays / 14));
    const bucketCount = Math.ceil(totalDays / bucketDays);
    const trend = Array.from({ length: bucketCount }, (_, offset) => {
      const bucketStart = chartStartMs + offset * bucketDays * 86_400_000;
      const bucketEnd = Math.min(analyticsRangeData.endMs, bucketStart + bucketDays * 86_400_000);
      const date = new Date(bucketStart);
      return {
        key: String(bucketStart),
        label: date.toLocaleDateString("en", bucketDays === 1 ? { weekday: "short" } : { month: "short", day: "numeric" }),
        count: analyticsLeads.filter((lead) => {
          const timestamp = new Date(lead.created_at).getTime();
          return timestamp >= bucketStart && timestamp < bucketEnd;
        }).length
      };
    });

    const byStatus = (Object.keys(statusLabels) as LeadStatus[]).map((status) => ({
      status,
      count: analyticsLeads.filter((lead) => lead.lead_status === status).length
    }));
    const sources = new Map<string, number>();
    analyticsLeads.forEach((lead) => {
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
      conversion: visits ? Math.min(100, (submissions / visits) * 100) : 0,
      startRate: visits ? (starts / visits) * 100 : 0,
      bookingRate: submissions ? (bookings / submissions) * 100 : 0,
      vslCompletionRate: vslStarts ? (vslCompletions / vslStarts) * 100 : 0,
      funnelStages: [
        ["Landing views", visits],
        ["Form starts", starts],
        ["Applications", submissions],
        ["Bookings", bookings],
        ["Won", analyticsLeads.filter((lead) => lead.lead_status === "won").length]
      ] as Array<[string, number]>,
      trend,
      byStatus,
      topSources: [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }, [analyticsEvents, analyticsLeads, analyticsRange, analyticsRangeData, referralLinks]);

  const leadCounts = useMemo(() => ({
    new: leads.filter((lead) => lead.lead_status === "new").length,
    handled: leads.filter((lead) => lead.lead_status !== "new").length
  }), [leads]);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    let receivedStart = 0;
    let receivedEnd = Number.POSITIVE_INFINITY;

    if (leadTimeRange === "today") receivedStart = todayStart;
    if (leadTimeRange === "7" || leadTimeRange === "30") {
      receivedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (Number(leadTimeRange) - 1)).getTime();
    }
    if (leadTimeRange === "custom") {
      if (leadCustomStart) receivedStart = new Date(`${leadCustomStart}T00:00:00`).getTime();
      if (leadCustomEnd) {
        const customEndExclusive = new Date(`${leadCustomEnd}T00:00:00`);
        customEndExclusive.setDate(customEndExclusive.getDate() + 1);
        receivedEnd = customEndExclusive.getTime();
      }
    }

    return leads.filter((lead) => {
      const matchesInbox = leadInbox === "all" || (leadInbox === "new" ? lead.lead_status === "new" : lead.lead_status !== "new");
      const matchesStatus = statusFilter === "all" || lead.lead_status === statusFilter;
      const receivedAt = new Date(lead.created_at).getTime();
      const matchesReceived = receivedAt >= receivedStart && receivedAt < receivedEnd;
      const followUpAt = lead.follow_up_at ? new Date(lead.follow_up_at).getTime() : null;
      const matchesFollowUp = followUpFilter === "all"
        || (followUpFilter === "none" && followUpAt === null)
        || (followUpFilter === "overdue" && followUpAt !== null && followUpAt < todayStart)
        || (followUpFilter === "today" && followUpAt !== null && followUpAt >= todayStart && followUpAt < tomorrowStart)
        || (followUpFilter === "upcoming" && followUpAt !== null && followUpAt >= tomorrowStart);
      const matchesSearch =
        !term ||
        [lead.full_name, lead.email, lead.phone_number, lead.instagram, lead.referral_code ?? "", lead.utm_source ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesInbox && matchesStatus && matchesReceived && matchesFollowUp && matchesSearch;
    }).sort((a, b) => {
      if (leadSort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (leadSort === "follow_up") {
        const aFollowUp = a.follow_up_at ? new Date(a.follow_up_at).getTime() : Number.POSITIVE_INFINITY;
        const bFollowUp = b.follow_up_at ? new Date(b.follow_up_at).getTime() : Number.POSITIVE_INFINITY;
        return aFollowUp - bFollowUp;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [followUpFilter, leadCustomEnd, leadCustomStart, leadInbox, leadSort, leadTimeRange, leads, search, statusFilter]);

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
            <LayoutDashboard size={18} /> Overview
          </button>
          <button className={activeTab === "leads" ? styles.active : ""} onClick={() => setActiveTab("leads")}>
            <Users size={18} /> Leads <span className={styles.navCount}>{leadCounts.new}</span>
          </button>
          <button className={activeTab === "analytics" ? styles.active : ""} onClick={() => setActiveTab("analytics")}>
            <BarChart3 size={18} /> Analytics
          </button>
          <button className={activeTab === "referrals" ? styles.active : ""} onClick={() => setActiveTab("referrals")}>
            <Link2 size={18} /> Referral links <span className={styles.navCount}>{referralLinks.length}</span>
          </button>
          <button className={activeTab === "settings" ? styles.active : ""} onClick={() => setActiveTab("settings")}>
            <Settings2 size={18} /> Settings
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
            <h1>{activeTab === "overview" ? "Overview" : activeTab === "leads" ? "Leads" : activeTab === "analytics" ? "Analytics" : activeTab === "referrals" ? "Referral links" : "Settings"}</h1>
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
          <HomeTab
            leads={leads}
            leadCounts={leadCounts}
            onOpenLead={openLead}
            onNavigate={setActiveTab}
          />
        ) : activeTab === "analytics" ? (
          <AnalyticsTab
            leads={analyticsLeads}
            analytics={analytics}
            range={analyticsRange}
            rangeLabel={analyticsRangeLabel(analyticsRange, customStart, customEnd)}
            customStart={customStart}
            customEnd={customEnd}
            onRangeChange={setAnalyticsRange}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
          />
        ) : activeTab === "leads" ? (
          <LeadsTab
            leads={filteredLeads}
            allLeadsCount={leads.length}
            counts={leadCounts}
            search={search}
            inbox={leadInbox}
            statusFilter={statusFilter}
            timeRange={leadTimeRange}
            customStart={leadCustomStart}
            customEnd={leadCustomEnd}
            followUpFilter={followUpFilter}
            sort={leadSort}
            onSearch={setSearch}
            onInbox={(value) => {
              setLeadInbox(value);
              setStatusFilter("all");
            }}
            onStatusFilter={(value) => {
              setStatusFilter(value);
              if (value !== "all") setLeadInbox("all");
            }}
            onTimeRange={setLeadTimeRange}
            onCustomStart={setLeadCustomStart}
            onCustomEnd={setLeadCustomEnd}
            onFollowUpFilter={setFollowUpFilter}
            onSort={setLeadSort}
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

function HomeTab({
  leads,
  leadCounts,
  onOpenLead,
  onNavigate
}: {
  leads: DashboardLead[];
  leadCounts: { new: number; handled: number };
  onOpenLead: (lead: DashboardLead) => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [now] = useState(() => Date.now());
  const dueFollowUps = leads.filter((lead) => lead.follow_up_at && new Date(lead.follow_up_at).getTime() <= now).length;
  const booked = leads.filter((lead) => lead.lead_status === "booked").length;

  return (
    <div className={styles.content}>
      <section className={styles.homeIntro}>
        <div>
          <p>Workspace</p>
          <h2>Stay on top of every application.</h2>
          <span>Review untouched leads first, then manage follow-ups and performance from their dedicated pages.</span>
        </div>
        <div className={styles.homeIntroActions}>
          <button className={styles.primaryButton} onClick={() => onNavigate("leads")}><Inbox size={17} /> Review new leads</button>
          <button className={styles.secondaryButton} onClick={() => onNavigate("analytics")}><BarChart3 size={17} /> View analytics</button>
        </div>
      </section>

      <section className={styles.metricsGrid}>
        <MetricCard icon={Inbox} label="New leads" value={String(leadCounts.new)} detail="Needs first review" />
        <MetricCard icon={History} label="Handled leads" value={String(leadCounts.handled)} detail="Already in progress" />
        <MetricCard icon={Clock3} label="Follow-ups due" value={String(dueFollowUps)} detail="Scheduled up to now" />
        <MetricCard icon={CalendarCheck} label="Booked" value={String(booked)} detail="Current pipeline" />
      </section>

      <section className={styles.overviewGrid}>
        <article className={styles.panelWide}>
          <div className={styles.panelHeader}>
            <div><p>Lead activity</p><h2>Latest applications</h2></div>
            <button className={styles.panelLink} onClick={() => onNavigate("leads")}>View all <ChevronRight size={15} /></button>
          </div>
          <div className={styles.recentList}>
            {leads.slice(0, 7).map((lead) => (
              <button type="button" key={lead.id} onClick={() => onOpenLead(lead)}>
                <div className={styles.avatar}>{lead.full_name.slice(0, 2).toUpperCase()}</div>
                <div><strong>{lead.full_name}</strong><span>{lead.email || lead.phone_number}</span></div>
                <span className={`${styles.status} ${styles[lead.lead_status]}`}>{statusLabels[lead.lead_status]}</span>
                <p>{new Date(lead.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
              </button>
            ))}
            {!leads.length ? <p className={styles.emptyText}>No applications yet. New submissions will appear here automatically.</p> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><p>Inbox guide</p><h2>New and handled</h2></div></div>
          <div className={styles.inboxGuide}>
            <div><Inbox size={18} /><span><strong>New</strong><small>Just arrived and still needs its first review.</small></span><b>{leadCounts.new}</b></div>
            <div><History size={18} /><span><strong>Handled</strong><small>Contacted, qualified, booked, won, or lost.</small></span><b>{leadCounts.handled}</b></div>
          </div>
          <button className={styles.secondaryButton} onClick={() => onNavigate("leads")}>Manage lead inbox <ChevronRight size={15} /></button>
        </article>
      </section>
    </div>
  );
}

function AnalyticsTab({
  leads,
  analytics,
  range,
  rangeLabel,
  customStart,
  customEnd,
  onRangeChange,
  onCustomStartChange,
  onCustomEndChange
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
  range: AnalyticsRange;
  rangeLabel: string;
  customStart: string;
  customEnd: string;
  onRangeChange: (range: AnalyticsRange) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  const maxTrend = Math.max(1, ...analytics.trend.map((day) => day.count));
  const maxStatus = Math.max(1, ...analytics.byStatus.map((item) => item.count));
  const maxFunnel = Math.max(1, ...analytics.funnelStages.map(([, count]) => count));

  return (
    <div className={styles.content}>
      <section className={styles.analyticsToolbar} aria-label="Analytics date range">
        <div className={styles.rangeSummary}>
          <CalendarRange size={18} />
          <div><span>Reporting period</span><strong>{rangeLabel}</strong></div>
        </div>
        <div className={styles.rangePresets}>
          {(["7", "14", "30", "90"] as AnalyticsRange[]).map((value) => (
            <button
              className={range === value ? styles.rangeActive : ""}
              key={value}
              onClick={() => onRangeChange(value)}
              type="button"
            >
              {value} days
            </button>
          ))}
          <button className={range === "all" ? styles.rangeActive : ""} onClick={() => onRangeChange("all")} type="button">All time</button>
          <button className={range === "custom" ? styles.rangeActive : ""} onClick={() => onRangeChange("custom")} type="button">Custom</button>
        </div>
        {range === "custom" ? (
          <div className={styles.customRange}>
            <label>From<input type="date" value={customStart} max={customEnd} onChange={(event) => onCustomStartChange(event.target.value)} /></label>
            <label>To<input type="date" value={customEnd} min={customStart} max={dateInputValue(new Date())} onChange={(event) => onCustomEndChange(event.target.value)} /></label>
          </div>
        ) : null}
      </section>

      <section className={styles.metricsGrid}>
        <MetricCard icon={Users} label="Leads" value={String(leads.length)} detail={`${analytics.todayLeads} today`} />
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
            <div><p>Performance</p><h2>Leads · {rangeLabel}</h2></div>
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
                <div><strong>{lead.full_name}</strong><span>{lead.email || lead.phone_number}</span></div>
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
  allLeadsCount,
  counts,
  search,
  inbox,
  statusFilter,
  timeRange,
  customStart,
  customEnd,
  followUpFilter,
  sort,
  onSearch,
  onInbox,
  onStatusFilter,
  onTimeRange,
  onCustomStart,
  onCustomEnd,
  onFollowUpFilter,
  onSort,
  onOpenLead
}: {
  leads: DashboardLead[];
  allLeadsCount: number;
  counts: { new: number; handled: number };
  search: string;
  inbox: LeadInbox;
  statusFilter: LeadStatus | "all";
  timeRange: LeadTimeRange;
  customStart: string;
  customEnd: string;
  followUpFilter: FollowUpFilter;
  sort: LeadSort;
  onSearch: (value: string) => void;
  onInbox: (value: LeadInbox) => void;
  onStatusFilter: (value: LeadStatus | "all") => void;
  onTimeRange: (value: LeadTimeRange) => void;
  onCustomStart: (value: string) => void;
  onCustomEnd: (value: string) => void;
  onFollowUpFilter: (value: FollowUpFilter) => void;
  onSort: (value: LeadSort) => void;
  onOpenLead: (lead: DashboardLead) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className={styles.content}>
      <section className={styles.leadsPanel}>
        <div className={styles.leadSegments} role="group" aria-label="Lead inbox">
          <button className={inbox === "new" ? styles.segmentActive : ""} onClick={() => onInbox("new")}>
            <Inbox size={17} /><span><strong>New</strong><small>Not reviewed yet</small></span><b>{counts.new}</b>
          </button>
          <button className={inbox === "handled" ? styles.segmentActive : ""} onClick={() => onInbox("handled")}>
            <History size={17} /><span><strong>Handled</strong><small>Already in progress</small></span><b>{counts.handled}</b>
          </button>
          <button className={inbox === "all" ? styles.segmentActive : ""} onClick={() => onInbox("all")}>
            <Users size={17} /><span><strong>All leads</strong><small>Entire pipeline</small></span><b>{allLeadsCount}</b>
          </button>
        </div>

        <div className={styles.filters}>
          <label className={styles.search}><Search size={17} /><input value={search} placeholder="Search name, phone or source" onChange={(event) => onSearch(event.target.value)} /></label>
          <select aria-label="Received date" value={timeRange} onChange={(event) => onTimeRange(event.target.value as LeadTimeRange)}>
            <option value="all">Received: any time</option>
            <option value="today">Received: today</option>
            <option value="7">Received: last 7 days</option>
            <option value="30">Received: last 30 days</option>
            <option value="custom">Received: custom dates</option>
          </select>
          <button className={`${styles.advancedButton} ${showAdvanced ? styles.advancedActive : ""}`} type="button" onClick={() => setShowAdvanced((current) => !current)}>
            <SlidersHorizontal size={16} /> Advanced
          </button>
          <span className={styles.resultCount}>{leads.length} results</span>
        </div>

        {timeRange === "custom" || showAdvanced ? (
          <div className={styles.advancedFilters}>
            {timeRange === "custom" ? (
              <div className={styles.advancedFieldGroup}>
                <label>Received from<input type="date" value={customStart} max={customEnd || undefined} onChange={(event) => onCustomStart(event.target.value)} /></label>
                <label>Received to<input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => onCustomEnd(event.target.value)} /></label>
              </div>
            ) : null}
            {showAdvanced ? (
              <>
                <label>Exact status<select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as LeadStatus | "all")}>
                  <option value="all">Any status</option>
                  {(Object.keys(statusLabels) as LeadStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
                </select></label>
                <label>Follow-up time<select value={followUpFilter} onChange={(event) => onFollowUpFilter(event.target.value as FollowUpFilter)}>
                  <option value="all">Any follow-up</option>
                  <option value="overdue">Overdue</option>
                  <option value="today">Due today</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="none">Not scheduled</option>
                </select></label>
                <label>Sort by<select value={sort} onChange={(event) => onSort(event.target.value as LeadSort)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="follow_up">Next follow-up</option>
                </select></label>
              </>
            ) : null}
          </div>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Lead</th><th>Status</th><th>Budget</th><th>Source</th><th>Received</th><th>Follow-up</th><th /></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} onClick={() => onOpenLead(lead)}>
                  <td><div className={styles.leadCell}><div className={styles.avatar}>{lead.full_name.slice(0, 2).toUpperCase()}</div><div><strong>{lead.full_name}</strong><span>{lead.email || lead.phone_number}</span></div></div></td>
                  <td><span className={`${styles.status} ${styles[lead.lead_status]}`}>{statusLabels[lead.lead_status]}</span></td>
                  <td>{lead.budget_range}</td>
                  <td>{lead.referral_code || lead.utm_source || "Direct"}</td>
                  <td><time dateTime={lead.created_at}>{new Date(lead.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time></td>
                  <td>{lead.follow_up_at ? <time dateTime={lead.follow_up_at}>{new Date(lead.follow_up_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time> : <span className={styles.mutedCell}>Not scheduled</span>}</td>
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
          {lead.email ? <a href={`mailto:${lead.email}`}><Mail size={16} /> Email</a> : null}
          <a href={`tel:${lead.phone_number}`}><Phone size={16} /> Call</a>
          {smsLinkFor(lead) ? (
            <a href={smsLinkFor(lead)}><MessageSquareText size={16} /> SMS</a>
          ) : (
            <span className={styles.disabledContact}><MessageSquareText size={16} /> No valid phone</span>
          )}
          {whatsappLinkFor(lead) ? (
            <a href={whatsappLinkFor(lead)} target="_blank" rel="noreferrer"><WhatsAppIcon size={16} /> WhatsApp</a>
          ) : (
            <span className={styles.disabledContact}><WhatsAppIcon size={16} /> No valid phone</span>
          )}
          {hasInstagramHandle(lead.instagram) ? (
            <a href={`https://instagram.com/${lead.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><AtSign size={16} /> Instagram</a>
          ) : (
            <span className={styles.disabledContact}><AtSign size={16} /> Instagram not collected</span>
          )}
        </div>

        <div className={styles.drawerForm}>
          <label>Pipeline status<select value={lead.lead_status} onChange={(event) => onChange({ ...lead, lead_status: event.target.value as LeadStatus })}>{(Object.keys(statusLabels) as LeadStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label>
          <label>Follow-up date and time<input type="datetime-local" value={localDateTime(lead.follow_up_at)} onChange={(event) => onChange({ ...lead, follow_up_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
          <label>Assigned to<input value={lead.assigned_to ?? ""} placeholder="Team member" onChange={(event) => onChange({ ...lead, assigned_to: event.target.value || null })} /></label>
          <label>Tags<input value={lead.tags.join(", ")} placeholder="hot, follow-up" onChange={(event) => onChange({ ...lead, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10) })} /></label>
          <label className={styles.fullField}>Notes<textarea value={lead.notes} placeholder="Add context from calls and DMs…" onChange={(event) => onChange({ ...lead, notes: event.target.value })} /></label>
        </div>

        <section className={styles.timelineSection}>
          <div><p>Timeline</p><h3>Lead timing</h3></div>
          <dl>
            <div><dt>Application received</dt><dd>{new Date(lead.created_at).toLocaleString()}</dd></div>
            <div><dt>Record last updated</dt><dd>{new Date(lead.updated_at).toLocaleString()}</dd></div>
            <div><dt>Last contacted</dt><dd>{lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleString() : "Not contacted yet"}</dd></div>
            <div><dt>Next follow-up</dt><dd>{lead.follow_up_at ? new Date(lead.follow_up_at).toLocaleString() : "Not scheduled"}</dd></div>
          </dl>
        </section>

        <section className={styles.qualification}>
          <h3>Qualification</h3>
          <dl>
            <div><dt>Budget</dt><dd>{lead.budget_range}</dd></div>
            <div><dt>Start timeline</dt><dd>{lead.start_timeline || "Not collected"}</dd></div>
            <div><dt>Goal</dt><dd>{lead.long_term_goal}</dd></div>
            <div><dt>Biggest struggle</dt><dd>{lead.biggest_struggle || "Not collected"}</dd></div>
            {lead.reselling_experience ? <div><dt>Legacy experience</dt><dd>{lead.reselling_experience}</dd></div> : null}
            {lead.age_range ? <div><dt>Legacy age</dt><dd>{lead.age_range}</dd></div> : null}
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
            <SwitchRow title="Show proof gallery" description="Display the scrolling student results gallery." checked={settings.showWins} onChange={(value) => set("showWins", value)} />
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
          <div className={styles.settingsHeading}><div className={styles.settingsIcon}><ShieldCheck size={18} /></div><div><h2>Integrations <span className={styles.advancedBadge}>Advanced</span></h2><p>Public IDs are stored in settings; secret webhook URLs remain server-only.</p></div></div>
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

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function SwitchRow({ title, description, checked, disabled = false, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.switchRow}><div><strong>{title}</strong><span>{description}</span></div><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
