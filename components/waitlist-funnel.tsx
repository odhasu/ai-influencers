"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Play,
  ShieldCheck,
  X
} from "lucide-react";
import posthog from "posthog-js";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

type AnswerKey =
  | "reselling_experience"
  | "long_term_goal"
  | "age_range"
  | "instagram"
  | "email"
  | "full_name"
  | "phone_number"
  | "budget_range";

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

type AnalyticsConsent = "granted" | "denied" | "unknown";

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
          ["A", "13 - 17"],
          ["B", "18 - 23"],
          ["C", "24 - 35"],
          ["D", "35+"]
        ]
      }
    ]
  },
  {
    key: "instagram",
    title: "What's your Instagram @?",
    fields: [
      {
        id: "instagram",
        type: "text",
        placeholder: "@yourusername",
        autocomplete: "off"
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
        placeholder: "you@example.com",
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
        placeholder: "Full name",
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
    subtitle: "My program involves an upfront investment to help you scale to $5K-$30K+ per month.",
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
  budget_range: ""
};

const videos = [
  ["IE0_sR4QfRg", "He makes $25,000/m selling unbranded glasses"],
  ["-yUZ4U91dVQ", "He's Doing $20,000/Month With High Ticket Reselling"],
  ["7xr2eSPviGM", "$0 to $30,000/Month in 6 Months"],
  ["K4zdxmcqkcQ", "16 Year Old: $0 to $27K/Month"],
  ["evjICkbXsig", "15 Year Old Hitting $22K/Month"],
  ["uP7VTQFMmFY", "From Trampoline Park to $21K/Month"],
  ["fX0Jrb7-bkI", "He Bought a C8 Corvette From Reselling"],
  ["A8NgC6evgpA", "16 Year Old: $0 to $8K/Month"],
  ["I80B0-LlEUk", "16 Year Old Made $70,000 With High Ticket Reselling"],
  ["JsOt0YROtMk", "He's 15 and Makes $10,000/Month"]
] as const;

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
  ["img_VRuUWur-OD6ZxrBq6U1WF", 320, 351],
  ["img_c8UoUK-ppzWBG01LCZUaZ", 320, 247],
  ["img_THYSiha0G-s0V9hIFcFRN", 320, 297],
  ["img_-VnkG34E9THKDzbJUaVAT", 320, 330]
] as const;

function capture(event: string, properties: Record<string, string | number | boolean> = {}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never interrupt the funnel.
  }
}

function validStep(stepIndex: number, answers: Answers) {
  return steps[stepIndex].fields.every((field) => {
    const value = answers[field.id].trim();
    if (!value) return false;
    if (field.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (field.type === "tel") return value.replace(/\D/g, "").length >= 7;
    return true;
  });
}

function safeReferrer() {
  if (!document.referrer) return "";

  try {
    const url = new URL(document.referrer);
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return "";
  }
}

function getSessionId() {
  const key = "waitlist_session_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;

  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

export function WaitlistFunnel() {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [validationVisible, setValidationVisible] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [analyticsConsent, setAnalyticsConsent] = useState<AnalyticsConsent>("unknown");

  const formRef = useRef<HTMLFormElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const choiceTimerRef = useRef<number | null>(null);
  const formStartedAtRef = useRef<number | null>(null);
  const formStartedTrackedRef = useRef(false);
  const completedStepsRef = useRef(new Set<number>());
  const viewedStepsRef = useRef(new Set<number>());
  const formViewedRef = useRef(false);
  const attributionRef = useRef<Record<string, string>>({});
  const sessionIdRef = useRef("");

  const step = steps[currentStep];
  const isReady = useMemo(() => validStep(currentStep, answers), [answers, currentStep]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    attributionRef.current = {
      utm_source: parameters.get("utm_source")?.slice(0, 160) ?? "",
      utm_medium: parameters.get("utm_medium")?.slice(0, 160) ?? "",
      utm_campaign: parameters.get("utm_campaign")?.slice(0, 160) ?? "",
      utm_content: parameters.get("utm_content")?.slice(0, 160) ?? "",
      utm_term: parameters.get("utm_term")?.slice(0, 160) ?? "",
      referrer: safeReferrer(),
      landing_path: `${window.location.pathname}${window.location.hash}`.slice(0, 300)
    };
    sessionIdRef.current = getSessionId();

    return () => {
      if (choiceTimerRef.current) window.clearTimeout(choiceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (analyticsConsent !== "granted") return;

    capture("landing_viewed", {
      landing_path: window.location.pathname,
      has_utm_source: Boolean(attributionRef.current.utm_source)
    });

    const reached = new Set<number>();
    const milestones = [25, 50, 75, 90, 100];
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));

      for (const milestone of milestones) {
        if (percent >= milestone && !reached.has(milestone)) {
          reached.add(milestone);
          capture("scroll_depth_reached", { percent: milestone });
        }
      }
    };

    const timers = [15, 30, 60, 120].map((seconds) =>
      window.setTimeout(() => capture("time_on_page_reached", { seconds }), seconds * 1000)
    );

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [analyticsConsent]);

  useEffect(() => {
    if (analyticsConsent !== "granted" || status === "success") return;
    if (viewedStepsRef.current.has(currentStep)) return;

    viewedStepsRef.current.add(currentStep);
    capture("form_step_viewed", {
      step_number: currentStep + 1,
      step_key: step.key,
      total_steps: steps.length
    });
  }, [analyticsConsent, currentStep, status, step.key]);

  useEffect(() => {
    if (analyticsConsent !== "granted" || !formRef.current || formViewedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || formViewedRef.current) return;
        formViewedRef.current = true;
        capture("form_viewed", { total_steps: steps.length });
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(formRef.current);
    return () => observer.disconnect();
  }, [analyticsConsent]);

  useEffect(() => {
    if (!activeVideo) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveVideo(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeVideo]);

  function markFormStarted() {
    // eslint-disable-next-line react-hooks/purity -- This function runs only from user event handlers.
    if (!formStartedAtRef.current) formStartedAtRef.current = Date.now();
    if (formStartedTrackedRef.current) return;

    formStartedTrackedRef.current = true;
    capture("form_started", { total_steps: steps.length });
  }

  function trackStepCompleted(stepIndex: number) {
    if (completedStepsRef.current.has(stepIndex)) return;

    completedStepsRef.current.add(stepIndex);
    capture("form_step_completed", {
      step_number: stepIndex + 1,
      step_key: steps[stepIndex].key,
      total_steps: steps.length
    });
  }

  function choose(fieldId: AnswerKey, value: string) {
    if (status === "submitting") return;
    markFormStarted();
    setValidationVisible(false);

    const nextAnswers = { ...answers, [fieldId]: value };
    setAnswers(nextAnswers);

    if (choiceTimerRef.current) window.clearTimeout(choiceTimerRef.current);
    choiceTimerRef.current = window.setTimeout(() => advance(nextAnswers), 240);
  }

  function updateAnswer(fieldId: AnswerKey, value: string) {
    markFormStarted();
    setValidationVisible(false);
    setStatus("idle");
    setAnswers((current) => ({ ...current, [fieldId]: value }));
  }

  function advance(nextAnswers: Answers = answers) {
    if (status === "submitting" || status === "success") return;
    markFormStarted();

    if (!validStep(currentStep, nextAnswers)) {
      setValidationVisible(true);
      capture("form_validation_failed", {
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
    capture("form_back_clicked", {
      from_step_number: currentStep + 1,
      from_step_key: step.key
    });
    setValidationVisible(false);
    setStatus("idle");
    setCurrentStep((index) => index - 1);
  }

  async function submit(nextAnswers: Answers) {
    // eslint-disable-next-line react-hooks/purity -- Submission is triggered by an event handler.
    const duration = formStartedAtRef.current ? Date.now() - formStartedAtRef.current : 0;
    setStatus("submitting");
    capture("form_submit_started", {
      total_steps: steps.length,
      elapsed_ms: duration
    });

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
            session_id: sessionIdRef.current,
            posthog_distinct_id:
              analyticsConsent === "granted" && process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
                ? posthog.get_distinct_id()
                : "",
            form_duration_ms: duration,
            analytics_consent: analyticsConsent === "granted",
            attribution: attributionRef.current
          }
        })
      });

      const result = (await response.json()) as { ok?: boolean; leadId?: string; message?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The application could not be saved.");
      }

      if (analyticsConsent === "granted" && result.leadId && process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
        posthog.identify(result.leadId);
        capture("form_success_shown", { lead_id: result.leadId });
      }

      setStatus("success");
    } catch (error) {
      setStatus("error");
      capture("form_submit_failed", {
        total_steps: steps.length,
        failure_type: error instanceof TypeError ? "network" : "server"
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    advance();
  }

  function scrollToForm(location: string) {
    capture("primary_cta_clicked", { cta_location: location });
    document.querySelector("#waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openVideo(videoId: string, position: number) {
    capture("testimonial_video_opened", { video_id: videoId, video_position: position });
    setActiveVideo(videoId);
  }

  return (
    <>
      <div className="curtain" aria-hidden="true" />

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title" className="gradient-title main-title">
            The Inner Circle Is Currently Closed
          </h1>
          <p className="hero-copy">
            We&apos;re not accepting new applications right now, but join the waitlist below to be first in line when spots open up.
          </p>
          <h2 className="gradient-title waitlist-title">Join the Waitlist</h2>
        </section>

        <section id="waitlist" className="form-section" aria-label="Join the waitlist">
          <form className="waitlist-card" ref={formRef} onSubmit={handleSubmit} noValidate>
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
              {status === "success" ? (
                <div className="success-panel">
                  <span className="success-icon" aria-hidden="true">
                    <Check size={30} strokeWidth={2.4} />
                  </span>
                  <h3>Your spot has been secured!</h3>
                </div>
              ) : (
                <div className="step-content" key={step.key}>
                  <span className="step-number">{currentStep + 1}</span>
                  <h3 className="step-title">{step.title}</h3>
                  {step.subtitle ? <p className="step-subtitle">{step.subtitle}</p> : null}

                  <div className="field-stack">
                    {step.fields.map((field) => {
                      if (field.type === "button-group") {
                        return (
                          <div className="choice-list" key={field.id}>
                            {field.options.map(([letter, label]) => (
                              <button
                                className={`choice-button${answers[field.id] === label ? " selected" : ""}`}
                                key={label}
                                type="button"
                                disabled={status === "submitting"}
                                onClick={() => choose(field.id, label)}
                              >
                                <span className="choice-key">{letter}</span>
                                <span className="choice-label">{label}</span>
                              </button>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <input
                          className="text-field"
                          key={field.id}
                          id={field.id}
                          name={field.id}
                          type={field.type}
                          value={answers[field.id]}
                          placeholder={field.placeholder}
                          autoComplete={field.autocomplete}
                          disabled={status === "submitting"}
                          required
                          onChange={(event) => updateAnswer(field.id, event.target.value)}
                        />
                      );
                    })}
                  </div>

                  {validationVisible ? (
                    <p className="form-message validation-message" role="alert">
                      Complete this step before continuing.
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

            {status !== "success" ? (
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
                            : "Submit"
                          : "OK"}
                    </span>
                    <ArrowRight size={19} aria-hidden="true" />
                  </button>
                </div>

                <div className="progress-dots" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>
                  {steps.map((item, index) => (
                    <span className={index === currentStep ? "active" : ""} key={item.key} />
                  ))}
                </div>
              </>
            ) : null}

            <div className="form-security">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Secure application</span>
            </div>
          </form>
        </section>

        <section className="interviews" aria-labelledby="interviews-title">
          <h2 id="interviews-title">Interviews with the Inner Circle:</h2>
          <div className="video-grid">
            {videos.map(([id, title], index) => (
              <button
                className="video-card"
                type="button"
                key={id}
                aria-label={`Play testimonial: ${title}`}
                onClick={() => openVideo(id, index + 1)}
              >
                <span className="video-thumb">
                  {/* YouTube thumbnails are intentionally rendered directly to preserve the source framing. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" decoding="async" />
                  <span className="play-icon" aria-hidden="true">
                    <Play size={22} fill="currentColor" />
                  </span>
                </span>
                <span>
                  <span className="video-title">{title}</span>
                  <span className="video-source">Inner Circle Member</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="button-wrap">
          <button className="cta-button" type="button" onClick={() => scrollToForm("mid_page")}>
            Get Started Now
          </button>
        </div>

        <section className="wins" aria-labelledby="wins-title">
          <h2 id="wins-title">More Inner Circle Wins:</h2>
          <div className="wins-masonry">
            {winImages.map(([id, width, height], index) => (
              <span className="win-image" key={`${id}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://cdn.clyro.io/images/variants/${id}/640.avif`}
                  width={width}
                  height={height}
                  alt={`Inner Circle result ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                />
              </span>
            ))}
          </div>
        </section>

        <div className="button-wrap final-cta">
          <button className="cta-button" type="button" onClick={() => scrollToForm("page_end")}>
            Get Started Now
          </button>
        </div>
      </main>

      {activeVideo ? (
        <div className="video-modal open" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setActiveVideo(null);
        }}>
          <button className="modal-close" type="button" aria-label="Close video" onClick={() => setActiveVideo(null)}>
            <X size={28} aria-hidden="true" />
          </button>
          <div className="modal-frame" role="dialog" aria-modal="true" aria-label="Testimonial video">
            <iframe
              title="Testimonial video"
              src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}

      <ConsentBanner consent={analyticsConsent} onChange={setAnalyticsConsent} />
    </>
  );
}

function ConsentBanner({
  consent,
  onChange
}: {
  consent: AnalyticsConsent;
  onChange: (value: AnalyticsConsent) => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("analytics_consent");
    const resolved: AnalyticsConsent = stored === "granted" || stored === "denied" ? stored : "unknown";
    onChange(resolved);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This avoids a server/client localStorage mismatch.
    setReady(true);
  }, [onChange]);

  function choose(value: Exclude<AnalyticsConsent, "unknown">) {
    window.localStorage.setItem("analytics_consent", value);
    onChange(value);

    if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
      if (value === "granted") {
        posthog.opt_in_capturing();
        capture("analytics_consent_granted");
      } else {
        posthog.opt_out_capturing();
      }
    }
  }

  if (!ready || consent !== "unknown") return null;

  return (
    <aside className="consent-banner" aria-label="Analytics preferences">
      <div className="consent-copy">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>Allow privacy-safe analytics and masked session replay to help improve this funnel.</p>
      </div>
      <div className="consent-actions">
        <button className="consent-button secondary" type="button" onClick={() => choose("denied")}>
          Decline
        </button>
        <button className="consent-button primary" type="button" onClick={() => choose("granted")}>
          Allow analytics
          <Check size={15} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
