"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  Check,
  Clock3,
  SearchCheck,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PhoneInput } from "react-international-phone";
import {
  CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { CinematicCurtain } from "@/components/cinematic-curtain";
import { TestimonialGrid } from "@/components/testimonial-grid";
import {
  captureFunnelEvent,
  getPosthogDistinctId,
  getSubmissionAnalytics,
  identifyAnalyticsLead
} from "@/lib/analytics/client";
import type { FunnelSettings } from "@/lib/funnel-settings";

type AnswerKey =
  | "reselling_experience"
  | "long_term_goal"
  | "age_range"
  | "instagram"
  | "email"
  | "full_name"
  | "phone_number"
  | "budget_range"
  | "call_commitment";

type Answers = Record<AnswerKey, string>;

type ChoiceField = {
  id: AnswerKey;
  type: "button-group";
  options: ReadonlyArray<readonly [string, string]>;
};

type TextField = {
  id: AnswerKey;
  type: "text" | "email" | "tel";
  placeholder: string;
  autocomplete: string;
};

type FunnelStep = {
  key: string;
  title: string;
  subtitle?: string;
  fields: ReadonlyArray<ChoiceField | TextField>;
};

type CalendlyApi = {
  initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
};

declare global {
  interface Window {
    Calendly?: CalendlyApi;
  }
}

const calendlyUrl =
  "https://calendly.com/ogvendorss/htr-call?hide_event_type_details=1&hide_gdpr_banner=1&background_color=ffffff&text_color=111111&primary_color=000000";

const legacyHeroHeadline =
  "See How Regular People Are Building $5K-$30K/Month High-Ticket Reselling Businesses";
const safeHeroHeadline = "Build a More Structured High-Ticket Reselling Business";

const fallbackHeroBody =
  "Apply to discuss your reselling experience, goals, and whether the Inner Circle is the right next step.";

const programPillars = [
  {
    icon: SearchCheck,
    number: "01",
    title: "Source with a process",
    copy: "Learn how to evaluate products, suppliers, and margins before you commit capital."
  },
  {
    icon: ShieldCheck,
    number: "02",
    title: "Operate with confidence",
    copy: "Use clearer listing, pricing, and fulfillment workflows instead of guessing your next move."
  },
  {
    icon: TrendingUp,
    number: "03",
    title: "Improve with coaching",
    copy: "Bring real questions to live coaching and leave with a focused plan for the week ahead."
  }
] as const;

const frequentlyAskedQuestions = [
  {
    question: "Is the Inner Circle suitable for beginners?",
    answer:
      "Yes. Your application helps us understand your current experience, goals, and starting point before the call."
  },
  {
    question: "What happens after I apply?",
    answer:
      "After submitting, you can choose a call time. The call is used to discuss your situation, answer questions, and decide whether the program is a good fit."
  },
  {
    question: "Are results or income guaranteed?",
    answer:
      "No. The examples on this page are individual member outcomes, not a promise of future earnings. Results depend on experience, effort, decisions, and market conditions."
  },
  {
    question: "What should I prepare for the call?",
    answer:
      "Come ready to discuss your current reselling experience, goals, available time, and the resources you can realistically commit."
  }
] as const;

const fieldLabels: Partial<Record<AnswerKey, string>> = {
  email: "Email address",
  full_name: "Full name",
  phone_number: "Phone number"
};

const steps: ReadonlyArray<FunnelStep> = [
  {
    key: "experience",
    title: "How long have you been reselling?",
    fields: [
      {
        id: "reselling_experience",
        type: "button-group",
        options: [
          ["A", "I'm just starting"],
          ["B", "Less than 6 months"],
          ["C", "6 months - 1 year"],
          ["D", "1 - 2 years"],
          ["E", "2+ years"]
        ]
      }
    ]
  },
  {
    key: "goal",
    title: "What's your long term goal with reselling?",
    fields: [
      {
        id: "long_term_goal",
        type: "button-group",
        options: [
          ["A", "Full time income"],
          ["B", "Side hustle / extra income"],
          ["C", "Build a brand on social media"],
          ["D", "Bulk supplying to stores"]
        ]
      }
    ]
  },
  {
    key: "age",
    title: "How old are you?",
    fields: [
      {
        id: "age_range",
        type: "button-group",
        options: [
          ["A", "18 - 23"],
          ["B", "24 - 35"],
          ["C", "35+"]
        ]
      }
    ]
  },
  {
    key: "email",
    title: "Got it, and what's the best email to reach you at?",
    fields: [
      {
        id: "email",
        type: "email",
        placeholder: "your@email.com",
        autocomplete: "email"
      }
    ]
  },
  {
    key: "contact",
    title: "And your name and phone number?",
    fields: [
      {
        id: "full_name",
        type: "text",
        placeholder: "Full Name",
        autocomplete: "name"
      },
      {
        id: "phone_number",
        type: "tel",
        placeholder: "Phone number",
        autocomplete: "tel"
      }
    ]
  },
  {
    key: "budget",
    title: "What budget range do you have for this?",
    subtitle: "The Inner Circle is a paid program. Choose the range you could realistically invest if it is a strong fit.",
    fields: [
      {
        id: "budget_range",
        type: "button-group",
        options: [
          ["A", "Under $200 USD"],
          ["B", "$200 - $500 USD"],
          ["C", "$500 - $1K USD"],
          ["D", "$1K - $3K USD"],
          ["E", "$3K+ USD"]
        ]
      }
    ]
  },
  {
    key: "call-commitment",
    title: "Cool, just before I get you on a call to see if I can help you hit your goals...",
    subtitle: "Can you make sure to choose a time slot that you can 100% commit to?",
    fields: [
      {
        id: "call_commitment",
        type: "button-group",
        options: [["A", "Yes"]]
      }
    ]
  }
];

const initialAnswers: Answers = {
  reselling_experience: "",
  long_term_goal: "",
  age_range: "",
  instagram: "",
  email: "",
  full_name: "",
  phone_number: "",
  budget_range: "",
  call_commitment: ""
};

const winImages = [
  ["img_QRRPzkCGFMuT9xArHuNWR", 320, 325],
  ["img_X-biZtVijL98kAR1jwMKy", 320, 224],
  ["img_yuCHlV6azfzk7a5jI1nIN", 320, 201],
  ["img_OaIs3mxhFiRjjSUmK-9qk", 320, 262],
  ["img_5enDm-0QLyhy8nEdfE3f4", 320, 218],
  ["img_C3GXvDC7rELhMzxetJ-qP", 320, 371],
  ["img_Id5zYTtOzzULo8KWdh7Ac", 320, 397],
  ["img_Ac82tcfNUGKOx-hFkREDP", 320, 183],
  ["img_VRuUWur-OD6ZxrBq6U1WF", 320, 351],
  ["img_3T5BBuogeEUaKZLA8kyZq", 320, 383],
  ["img_COn7aYJNXFO_jw7yR2ZOH", 320, 237],
  ["img_xAODOuS5DfygDAWSg4yHb", 320, 371],
  ["img_INT_Bz3HAueXt-9NT1S6U", 320, 377],
  ["img_Ercn3Zfo9XhABuQyV6jSc", 320, 316],
  ["img_Y-62LV4Qof02qf7fHRW7U", 320, 463],
  ["img_MFwHHWHBsnnM1Po9ggpgw", 320, 288],
  ["img_QEPj3oo8843YJA4xRLUKR", 320, 226],
  ["img_BJJDWD-vpL3s5ReJ7xVRf", 320, 344],
  ["img_X03lhN_oXgzh5wruDnHvK", 320, 304],
  ["img_nG7-m6JupiCweZYe-XPse", 320, 228],
  ["img_c8UoUK-ppzWBG01LCZUaZ", 320, 247],
  ["img_THYSiha0G-s0V9hIFcFRN", 320, 297],
  ["img_-VnkG34E9THKDzbJUaVAT", 320, 330]
] as const;

const localWinImages = [
  {
    src: "/wins/supreme-socks-win.png",
    width: 926,
    height: 850,
    alt: "Inner Circle member showing Supreme product inventory",
    timestampMask: { left: "29.35%", top: "2.7%", width: "23.2%", height: "6.35%", backgroundColor: "#08080a" }
  },
  {
    src: "/wins/selling-7846-win.png",
    width: 744,
    height: 868,
    alt: "Inner Circle member showing 7,846 dollars in 90-day sales",
    timestampMask: { left: "26.75%", top: "2.95%", width: "27.25%", height: "5.45%", backgroundColor: "#1b1b1d" }
  },
  {
    src: "/wins/cash-win.png",
    width: 768,
    height: 758,
    alt: "Inner Circle member showing cash from reselling",
    timestampMask: { left: "30.65%", top: "0%", width: "25.4%", height: "6.2%", backgroundColor: "#1a1b1f" }
  }
] as const;

function validStep(stepIndex: number, answers: Answers) {
  return steps[stepIndex].fields.every((field) => {
    const value = answers[field.id].trim();
    if (!value) return false;
    if (field.id === "call_commitment") return value === "Yes";
    if (field.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (field.type === "tel") return value.replace(/\D/g, "").length >= 7;
    return true;
  });
}

function validationMessage(stepIndex: number, answers: Answers) {
  const current = steps[stepIndex];
  if (current.key === "email") return "Enter a valid email address.";
  if (current.key === "contact") {
    if (!answers.full_name.trim()) return "Enter your full name.";
    if (answers.phone_number.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
  }
  if (current.key === "call-commitment") {
    return "Only continue if you can commit to the call time you choose.";
  }
  return "Choose an option before continuing.";
}

export function WaitlistFunnel({ settings }: { settings: FunnelSettings }) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [validationVisible, setValidationVisible] = useState(false);
  const [showAllWins, setShowAllWins] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const applicationTitleRef = useRef<HTMLHeadingElement>(null);
  const bookingHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const choiceTimerRef = useRef<number | null>(null);
  const formStartedAtRef = useRef<number | null>(null);
  const formStartedTrackedRef = useRef(false);
  const completedStepsRef = useRef(new Set<number>());
  const viewedStepsRef = useRef(new Set<number>());
  const formViewedRef = useRef(false);
  const calendlyRef = useRef<HTMLDivElement>(null);
  const fieldFocusRef = useRef(new Map<AnswerKey, number>());
  const stepViewedAtRef = useRef(0);
  const abandonmentTrackedRef = useRef(false);
  const submittedRef = useRef(false);
  const submissionInFlightRef = useRef(false);
  const bookingStartedRef = useRef(false);
  const leadIdRef = useRef("");
  const currentStepRef = useRef(0);

  const step = steps[currentStep];
  const isReady = useMemo(() => validStep(currentStep, answers), [answers, currentStep]);
  const visibleWinImages = showAllWins ? winImages : winImages.slice(0, 6);
  const bookingUrl = settings.bookingUrl.trim() || calendlyUrl;
  const structuredHeadline =
    settings.heroHeadline === legacyHeroHeadline || settings.heroHeadline === safeHeroHeadline;
  const proofTarget = settings.showWins ? "#results" : "#stories";
  const themeStyle = { "--green": settings.accentColor } as CSSProperties;
  const usesCalendly = useMemo(() => {
    try {
      const hostname = new URL(bookingUrl).hostname;
      return hostname === "calendly.com" || hostname.endsWith(".calendly.com");
    } catch {
      return false;
    }
  }, [bookingUrl]);

  useEffect(() => {
    return () => {
      if (choiceTimerRef.current) window.clearTimeout(choiceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "success" || !usesCalendly || !calendlyRef.current) return;

    const parentElement = calendlyRef.current;
    const initCalendly = () => {
      if (!window.Calendly || parentElement.dataset.calendlyMounted === "true") return;
      parentElement.dataset.calendlyMounted = "true";
      parentElement.innerHTML = "";
      if (!bookingStartedRef.current) {
        bookingStartedRef.current = true;
        captureFunnelEvent("booking_started", {
          provider: "calendly",
          lead_id: leadIdRef.current || undefined
        });
      }
      window.Calendly.initInlineWidget({
        url: bookingUrl,
        parentElement
      });
    };

    if (window.Calendly) {
      initCalendly();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("#calendly-widget-script");
    if (existingScript) {
      existingScript.addEventListener("load", initCalendly, { once: true });
      return () => existingScript.removeEventListener("load", initCalendly);
    }

    const script = document.createElement("script");
    script.id = "calendly-widget-script";
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.addEventListener("load", initCalendly, { once: true });
    document.body.appendChild(script);

    return () => script.removeEventListener("load", initCalendly);
  }, [bookingUrl, status, usesCalendly]);

  useEffect(() => {
    const onPageHide = () => {
      if (!formStartedTrackedRef.current || submittedRef.current || abandonmentTrackedRef.current) return;
      abandonmentTrackedRef.current = true;
      captureFunnelEvent("form_abandoned", {
        abandon_reason: "page_unloaded",
        step_number: currentStepRef.current + 1,
        step_key: steps[currentStepRef.current].key,
        completed_steps: completedStepsRef.current.size,
        elapsed_ms: formStartedAtRef.current ? Math.max(0, Date.now() - formStartedAtRef.current) : 0
      });
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, []);

  useEffect(() => {
    currentStepRef.current = currentStep;
    if (status === "success") return;
    if (viewedStepsRef.current.has(currentStep)) return;

    viewedStepsRef.current.add(currentStep);
    stepViewedAtRef.current = Date.now();
    captureFunnelEvent("form_step_viewed", {
      step_number: currentStep + 1,
      step_key: step.key,
      total_steps: steps.length
    });
  }, [currentStep, status, step.key]);

  useEffect(() => {
    if (!formStartedTrackedRef.current) return;
    stepTitleRef.current?.focus({ preventScroll: true });
  }, [currentStep]);

  useEffect(() => {
    if (status !== "success") return;
    bookingHeadingRef.current?.focus({ preventScroll: true });
  }, [status]);

  useEffect(() => {
    if (!formRef.current || formViewedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || formViewedRef.current) return;
        formViewedRef.current = true;
        captureFunnelEvent("form_viewed", { total_steps: steps.length });
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(formRef.current);
    return () => observer.disconnect();
  }, []);

  function markFormStarted() {
    // eslint-disable-next-line react-hooks/purity -- This function runs only from user event handlers.
    if (!formStartedAtRef.current) formStartedAtRef.current = Date.now();
    if (formStartedTrackedRef.current) return;

    formStartedTrackedRef.current = true;
    captureFunnelEvent("form_started", { total_steps: steps.length });
  }

  function trackStepCompleted(stepIndex: number) {
    if (completedStepsRef.current.has(stepIndex)) return;

    completedStepsRef.current.add(stepIndex);
    captureFunnelEvent("form_step_completed", {
      step_number: stepIndex + 1,
      step_key: steps[stepIndex].key,
      total_steps: steps.length,
      // eslint-disable-next-line react-hooks/purity -- This function runs only from user event handlers.
      step_elapsed_ms: stepViewedAtRef.current ? Math.max(0, Date.now() - stepViewedAtRef.current) : 0
    });
  }

  function trackFieldFocused(fieldId: AnswerKey, fieldType: "text" | "email" | "tel") {
    // eslint-disable-next-line react-hooks/purity -- This function runs only from input focus handlers.
    fieldFocusRef.current.set(fieldId, Date.now());
    captureFunnelEvent("form_field_focused", {
      field_key: fieldId,
      field_type: fieldType,
      step_number: currentStep + 1,
      step_key: step.key
    });
  }

  function trackFieldCompleted(
    fieldId: AnswerKey,
    fieldType: "text" | "email" | "tel",
    completed: boolean
  ) {
    const focusedAt = fieldFocusRef.current.get(fieldId);
    fieldFocusRef.current.delete(fieldId);
    captureFunnelEvent("form_field_completed", {
      field_key: fieldId,
      field_type: fieldType,
      field_completed: completed,
      // eslint-disable-next-line react-hooks/purity -- This function runs only from input blur handlers.
      focus_duration_ms: focusedAt ? Math.max(0, Date.now() - focusedAt) : 0,
      step_number: currentStep + 1,
      step_key: step.key
    });
  }

  function choose(fieldId: AnswerKey, value: string) {
    if (status === "submitting") return;
    markFormStarted();
    setValidationVisible(false);

    const nextAnswers = { ...answers, [fieldId]: value };
    setAnswers(nextAnswers);
    captureFunnelEvent("form_field_completed", {
      field_key: fieldId,
      field_type: "choice",
      field_completed: true,
      focus_duration_ms: 0,
      step_number: currentStep + 1,
      step_key: step.key
    });

    if (choiceTimerRef.current) window.clearTimeout(choiceTimerRef.current);
    if (currentStep === steps.length - 1) return;
    if (settings.autoAdvanceDelayMs === 0) return;

    choiceTimerRef.current = window.setTimeout(
      () => {
        choiceTimerRef.current = null;
        advance(nextAnswers);
      },
      Math.max(450, settings.autoAdvanceDelayMs)
    );
  }

  function updateAnswer(fieldId: AnswerKey, value: string) {
    markFormStarted();
    setValidationVisible(false);
    setStatus("idle");
    setAnswers((current) => ({ ...current, [fieldId]: value }));
  }

  function advance(nextAnswers: Answers = answers) {
    if (status === "submitting" || status === "success") return;
    if (choiceTimerRef.current) {
      window.clearTimeout(choiceTimerRef.current);
      choiceTimerRef.current = null;
    }
    markFormStarted();

    if (!validStep(currentStep, nextAnswers)) {
      setValidationVisible(true);
      captureFunnelEvent("form_validation_failed", {
        step_number: currentStep + 1,
        step_key: step.key
      });
      return;
    }

    trackStepCompleted(currentStep);
    if (currentStep < steps.length - 1) {
      setValidationVisible(false);
      setStatus("idle");
      setCurrentStep((index) => index + 1);
      return;
    }

    void submit(nextAnswers);
  }

  function goBack() {
    if (status === "submitting" || currentStep === 0) return;
    if (choiceTimerRef.current) {
      window.clearTimeout(choiceTimerRef.current);
      choiceTimerRef.current = null;
    }
    captureFunnelEvent("form_back_clicked", {
      from_step_number: currentStep + 1,
      from_step_key: step.key
    });
    setValidationVisible(false);
    setStatus("idle");
    setCurrentStep((index) => index - 1);
  }

  async function submit(nextAnswers: Answers) {
    if (submissionInFlightRef.current || submittedRef.current) return;
    submissionInFlightRef.current = true;
    // eslint-disable-next-line react-hooks/purity -- Submission is triggered by an event handler.
    const duration = formStartedAtRef.current ? Date.now() - formStartedAtRef.current : 0;
    setStatus("submitting");
    captureFunnelEvent("form_submit_started", {
      total_steps: steps.length,
      elapsed_ms: duration
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          answers: nextAnswers,
          website: honeypotRef.current?.value ?? "",
          metadata: {
            ...getSubmissionAnalytics(),
            posthog_distinct_id: getPosthogDistinctId(),
            form_duration_ms: duration
          }
        }),
        signal: controller.signal
      });

      const result = (await response.json()) as { ok?: boolean; leadId?: string; message?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The application could not be saved.");
      }

      if (result.leadId) {
        leadIdRef.current = result.leadId;
        submittedRef.current = true;
        identifyAnalyticsLead(result.leadId);
        captureFunnelEvent("form_success_shown", { lead_id: result.leadId });
      }

      setStatus("success");
    } catch (error) {
      setStatus("error");
      captureFunnelEvent("form_submit_failed", {
        total_steps: steps.length,
        failure_type: error instanceof TypeError ? "network" : "server"
      });
    } finally {
      window.clearTimeout(timeout);
      if (!submittedRef.current) submissionInFlightRef.current = false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    advance();
  }

  function scrollToForm(location: string) {
    captureFunnelEvent("primary_cta_clicked", {
      cta_location: location,
      button_label: settings.ctaLabel
    });
    document.querySelector("#waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    applicationTitleRef.current?.focus({ preventScroll: true });
  }

  function openAnalyticsSettings() {
    window.dispatchEvent(new Event("analytics-preferences-open"));
  }

  return (
    <>
      <CinematicCurtain />

      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="site-header" style={themeStyle}>
        <Link className="brand-link" href="/" aria-label="Authentic Resell home">
          <span className="brand-mark" aria-hidden="true">AR</span>
          <span className="brand-name">Authentic Resell</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#program">How it works</a>
          <a href={proofTarget}>Member stories</a>
          <button type="button" onClick={() => scrollToForm("header")}>Apply now</button>
        </nav>
      </header>

      <main id="main-content" style={themeStyle} tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <p className="hero-eyebrow"><span /> Private reselling mentorship</p>
          <h1
            id="hero-title"
            className={`main-title${structuredHeadline ? " branded-main-title" : ""}`}
          >
            {structuredHeadline ? (
              <>
                <span className="hero-title-line hero-title-lead">Build a More Structured</span>
                <span className="hero-title-line hero-title-accent">High-Ticket Reselling</span>
                <span className="hero-title-line hero-title-close">Business</span>
              </>
            ) : (
              settings.heroHeadline
            )}
          </h1>
          <p className="hero-copy">{settings.heroBody.trim() || fallbackHeroBody}</p>
          <div className="hero-actions">
            <button className="cta-button" type="button" onClick={() => scrollToForm("hero")}>
              {settings.ctaLabel}
              <ArrowRight size={19} aria-hidden="true" />
            </button>
            <a className="text-link" href="#stories">See member stories</a>
          </div>
          <div className="hero-trust" aria-label="Program highlights">
            <span><Check size={16} aria-hidden="true" /> 7-step application</span>
            <span><Check size={16} aria-hidden="true" /> Scheduling after submission</span>
            <span><Check size={16} aria-hidden="true" /> No income guarantees</span>
          </div>
        </section>

        <section id="program" className="program-section" aria-labelledby="program-title">
          <div className="section-heading">
            <p className="section-eyebrow">A practical operating system</p>
            <h2 id="program-title">A clearer path from first product to repeatable process.</h2>
            <p>Build the fundamentals, make better decisions, and use coaching to keep moving.</p>
          </div>
          <div className="program-grid">
            {programPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article className="program-card" key={pillar.number}>
                  <div className="program-card-top">
                    <span>{pillar.number}</span>
                    <Icon size={21} aria-hidden="true" />
                  </div>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.copy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="waitlist" className="form-section" aria-labelledby="application-title">
          <div className="form-intro">
            <p className="section-eyebrow">Your next step</p>
            <h2
              id="application-title"
              className="gradient-title waitlist-title"
              ref={applicationTitleRef}
              tabIndex={-1}
            >
              {settings.waitlistHeading}
            </h2>
            <p>Tell us where you are now and what you want to build. You can choose a call time after submitting.</p>
            <div className="form-meta" aria-label="Application details">
              <span><Clock3 size={16} aria-hidden="true" /> 7 short steps</span>
              <span><CalendarCheck2 size={16} aria-hidden="true" /> Scheduling comes next</span>
              <span><ShieldCheck size={16} aria-hidden="true" /> Optional analytics</span>
            </div>
          </div>

          <form
            className="waitlist-card"
            ref={formRef}
            onSubmit={handleSubmit}
            noValidate
            aria-busy={status === "submitting"}
          >
            <input
              ref={honeypotRef}
              className="honeypot"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="step-area" aria-live="polite" data-private>
              {!settings.formEnabled ? (
                <div className="success-panel paused-panel">
                  <h3>Applications are temporarily paused.</h3>
                  <p>Check back soon for the next opening.</p>
                </div>
              ) : status === "success" ? (
                <div className="booking-panel">
                  <div className="booking-copy">
                    <span className="step-number">8</span>
                    <h3 ref={bookingHeadingRef} tabIndex={-1}>
                      Application received. Choose your call time.
                    </h3>
                    <p>Pick a slot you can 100% commit to.</p>
                  </div>
                  {usesCalendly ? (
                    <>
                      <div className="calendly-card" ref={calendlyRef}>
                        <div className="calendly-loading">Loading calendar...</div>
                      </div>
                      <a className="booking-fallback" href={bookingUrl} target="_blank" rel="noreferrer">
                        Calendar not loading? Open the scheduler
                        <ArrowRight size={17} aria-hidden="true" />
                      </a>
                    </>
                  ) : (
                    <a className="direct-booking-link" href={bookingUrl} target="_blank" rel="noreferrer">
                      {settings.bookingCtaLabel}
                      <ArrowRight size={18} aria-hidden="true" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="step-content" key={step.key}>
                  <span className="step-number">{currentStep + 1}</span>
                  <h3 className="step-title" ref={stepTitleRef} tabIndex={-1}>{step.title}</h3>
                  {step.subtitle ? <p className="step-subtitle">{step.subtitle}</p> : null}

                  <div className="field-stack">
                    {step.fields.map((field) => {
                      if (field.type === "button-group") {
                        return (
                          <fieldset className="choice-list" key={field.id}>
                            <legend className="sr-only">{step.title}</legend>
                            {field.options.map(([letter, label]) => (
                              <label
                                className={`choice-button${answers[field.id] === label ? " selected" : ""}`}
                                key={label}
                              >
                                <input
                                  className="sr-only choice-input"
                                  type="radio"
                                  name={field.id}
                                  value={label}
                                  checked={answers[field.id] === label}
                                  disabled={status === "submitting"}
                                  onChange={() => choose(field.id, label)}
                                />
                                <span className="choice-key">{letter}</span>
                                <span className="choice-label">
                                  {field.id === "call_commitment" && label === "Yes"
                                    ? "Yes — I’ll choose a time I can attend"
                                    : label}
                                </span>
                              </label>
                            ))}
                          </fieldset>
                        );
                      }

                      if (field.id === "phone_number") {
                        return (
                          <div className="optional-field" key={field.id}>
                            <label className="field-label" htmlFor={field.id}>{fieldLabels[field.id]}</label>
                            <PhoneInput
                              className="phone-field"
                              defaultCountry="us"
                              forceDialCode
                              value={answers[field.id]}
                              disabled={status === "submitting"}
                              inputProps={{
                                id: field.id,
                                name: field.id,
                                "aria-label": "Phone number",
                                autoComplete: field.autocomplete,
                                onFocus: () => trackFieldFocused(field.id, "tel"),
                                onBlur: () =>
                                  trackFieldCompleted(
                                    field.id,
                                    "tel",
                                    answers[field.id].replace(/\D/g, "").length >= 7
                                  )
                              }}
                              onChange={(phone) => updateAnswer(field.id, phone)}
                            />
                          </div>
                        );
                      }

                      return (
                        <div className="optional-field" key={field.id}>
                          <label className="field-label" htmlFor={field.id}>{fieldLabels[field.id]}</label>
                          <input
                            className="text-field"
                            id={field.id}
                            name={field.id}
                            type={field.type}
                            value={answers[field.id]}
                            placeholder={field.placeholder}
                            autoComplete={field.autocomplete}
                            disabled={status === "submitting"}
                            required
                            onFocus={() => trackFieldFocused(field.id, field.type)}
                            onBlur={() =>
                              trackFieldCompleted(field.id, field.type, Boolean(answers[field.id].trim()))
                            }
                            onChange={(event) => updateAnswer(field.id, event.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {validationVisible ? (
                    <p className="form-message validation-message" role="alert">
                      {validationMessage(currentStep, answers)}
                    </p>
                  ) : null}

                  {status === "error" ? (
                    <p className="form-message submission-message" role="alert">
                      We couldn&apos;t save your application. Please try again.
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {settings.formEnabled && status !== "success" ? (
              <>
                <div className="form-nav">
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={status === "submitting" || currentStep === 0}
                    onClick={goBack}
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                    <span>Back</span>
                  </button>
                  <button
                    className={`next-button${isReady ? " ready" : ""}`}
                    type="submit"
                    disabled={status === "submitting"}
                  >
                    <span>
                      {status === "submitting"
                        ? "Submitting..."
                        : currentStep === steps.length - 1
                          ? status === "error"
                            ? "Try Again"
                            : "Submit application"
                          : "Continue"}
                    </span>
                    <ArrowRight size={19} aria-hidden="true" />
                  </button>
                </div>

                <div className="progress-dots" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>
                  <span className="sr-only">Step {currentStep + 1} of {steps.length}</span>
                  {steps.map((item, index) => (
                    <span aria-hidden="true" className={index === currentStep ? "active" : ""} key={item.key} />
                  ))}
                </div>
              </>
            ) : null}
          </form>
          <p className="form-disclosure">
            By submitting, you agree that Authentic Resell may use these details to review and follow up on your application. Usage analytics are optional and never include your contact details or answers. Read the <Link href="/privacy">privacy notice</Link>.
          </p>
        </section>

        {settings.showWins ? (
          <section
            id="results"
            className="wins"
            aria-labelledby="wins-title"
          >
            <div className="section-heading">
              <p className="section-eyebrow">Member proof</p>
              <h2 id="wins-title">Progress shared by Inner Circle members.</h2>
              <p>Real screenshots from individual members. Every result is different, and future earnings are never guaranteed.</p>
            </div>
            <div className="wins-masonry" id="member-wins-grid">
              {localWinImages.map((win, index) => (
                <span
                  className="win-image win-image-local"
                  key={win.src}
                  style={{ "--win-delay": `${index * 65}ms` } as CSSProperties}
                >
                  <Image
                    src={win.src}
                    width={win.width}
                    height={win.height}
                    alt={win.alt}
                    sizes="(max-width: 768px) 50vw, 25vw"
                    quality={90}
                  />
                  <span className="win-time-mask" style={win.timestampMask} aria-hidden="true" />
                </span>
              ))}
              {visibleWinImages.map(([id, width, height], index) => (
                <span
                  className="win-image"
                  key={`${id}-${index}`}
                  style={{ "--win-delay": `${(index + localWinImages.length) * 65}ms` } as CSSProperties}
                >
                  <picture>
                    <source
                      type="image/avif"
                      srcSet={[320, 640, 960, 1280, 1920]
                        .map((size) => `https://cdn.clyro.io/images/variants/${id}/${size}.avif ${size}w`)
                        .join(", ")}
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <source
                      type="image/webp"
                      srcSet={[320, 640, 960, 1280, 1920]
                        .map((size) => `https://cdn.clyro.io/images/variants/${id}/${size}.webp ${size}w`)
                        .join(", ")}
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <img
                      src={`https://cdn.clyro.io/images/variants/${id}/640.webp`}
                      width={width}
                      height={height}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                    />
                  </picture>
                </span>
              ))}
            </div>
            <div className="proof-actions">
              <button
                className="secondary-cta"
                type="button"
                aria-controls="member-wins-grid"
                aria-expanded={showAllWins}
                onClick={() => setShowAllWins((visible) => !visible)}
              >
                {showAllWins ? "Show fewer member wins" : "View more member wins"}
              </button>
            </div>
          </section>
        ) : null}

        <section id="stories" className="interviews" aria-labelledby="stories-title">
          <div className="section-heading">
            <p className="section-eyebrow">Long-form stories</p>
            <h2 id="stories-title">Hear how members built their operations.</h2>
            <p>Open a story to hear the process, decisions, and work behind the headline.</p>
          </div>
          <TestimonialGrid
            limit={3}
            onPlay={(videoId) => captureFunnelEvent("testimonial_video_opened", { video_id: videoId, source: "member_stories" })}
          />
        </section>

        <section className="faq-section" aria-labelledby="faq-title">
          <div className="section-heading">
            <p className="section-eyebrow">Before you apply</p>
            <h2 id="faq-title">Frequently asked questions.</h2>
          </div>
          <div className="faq-list">
            {frequentlyAskedQuestions.map((item) => (
              <details key={item.question}>
                <summary>{item.question}<span aria-hidden="true">+</span></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="button-wrap final-cta">
          <p className="section-eyebrow">Ready to take the next step?</p>
          <h2>Start with a focused conversation.</h2>
          <p>Complete the short application and choose a time that works for you.</p>
          <button className="cta-button" type="button" onClick={() => scrollToForm("page_end")}>
            {settings.ctaLabel}
            <ArrowRight size={19} aria-hidden="true" />
          </button>
        </section>
      </main>

      <footer className="site-footer" style={themeStyle}>
        <div>
          <Link className="brand-link" href="/" aria-label="Authentic Resell home">
            <span className="brand-mark" aria-hidden="true">AR</span>
            <span className="brand-name">Authentic Resell</span>
          </Link>
          <p>Private guidance for building a more structured reselling operation.</p>
        </div>
        <div className="footer-links">
          <a href="#program">How it works</a>
          <a href={proofTarget}>Member stories</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <button type="button" onClick={openAnalyticsSettings}>Privacy choices</button>
          <button type="button" onClick={() => scrollToForm("footer")}>Apply now</button>
        </div>
        <p className="earnings-disclaimer">
          Member examples are illustrative and do not guarantee income or business results. © {new Date().getFullYear()} Authentic Resell.
        </p>
      </footer>

    </>
  );
}
