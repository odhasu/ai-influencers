"use client";

import {
  ArrowLeft,
  ArrowRight
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import {
  captureFunnelEvent,
  getPosthogDistinctId,
  getSubmissionAnalytics,
  identifyAnalyticsLead
} from "@/lib/analytics/client";
import type { FunnelSettings } from "@/lib/funnel-settings";

type AnswerKey =
  | "start_timeline"
  | "long_term_goal"
  | "full_name"
  | "phone_number"
  | "biggest_struggle"
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

const brandedHeroHeadline =
  "See How Regular People Are Building $5K-$30K/Month AI Digital Ecom Businesses";
const previousBrandedHeroHeadline =
  "See How Regular People Are Building $5K-$30K/Month High-Ticket Reselling Businesses";

const steps: ReadonlyArray<FunnelStep> = [
  {
    key: "full-name",
    title: "What is your full name?",
    fields: [
      {
        id: "full_name",
        type: "text",
        placeholder: "Full name",
        autocomplete: "name"
      }
    ]
  },
  {
    key: "start-timeline",
    title: "How soon are you looking to start?",
    fields: [
      {
        id: "start_timeline",
        type: "button-group",
        options: [
          ["A", "ASAP - ready now"],
          ["B", "Within 1-4 weeks"],
          ["C", "Just researching for now"]
        ]
      }
    ]
  },
  {
    key: "goal",
    title: "What is your long-term goal in becoming profitable with AI digital e-commerce?",
    fields: [
      {
        id: "long_term_goal",
        type: "button-group",
        options: [
          ["A", "Side hustle money - $1K-$2K/month"],
          ["B", "Part time money - $4K-$10K/month"],
          ["C", "Full time money - $15K+/month"]
        ]
      }
    ]
  },
  {
    key: "phone",
    title: "What is your phone number?",
    fields: [
      {
        id: "phone_number",
        type: "tel",
        placeholder: "Phone number",
        autocomplete: "tel"
      }
    ]
  },
  {
    key: "biggest-struggle",
    title: "What has been your biggest struggle so far in achieving your goals?",
    fields: [
      {
        id: "biggest_struggle",
        type: "button-group",
        options: [
          ["A", "Lack of Direction"],
          ["B", "Procrastination"],
          ["C", "Skepticism"]
        ]
      }
    ]
  },
  {
    key: "budget",
    title: "What budget range do you have for this?",
    subtitle: "My program involves an upfront investment to help you scale to $5K–$30K+ per month.",
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
  start_timeline: "",
  long_term_goal: "",
  full_name: "",
  phone_number: "",
  biggest_struggle: "",
  budget_range: ""
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
  ["img_VRuUWur-OD6ZxrBq6U1WF", 320, 351],
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
    if (field.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (field.type === "tel") return value.replace(/\D/g, "").length >= 7;
    return true;
  });
}

export function WaitlistFunnel({ settings }: { settings: FunnelSettings }) {
  const router = useRouter();
  const accentColor = settings.accentColor.toLowerCase() === "#39ff14" ? "#f2c268" : settings.accentColor;
  const isBrandedHero =
    settings.heroHeadline === brandedHeroHeadline || settings.heroHeadline === previousBrandedHeroHeadline;
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [validationVisible, setValidationVisible] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const choiceTimerRef = useRef<number | null>(null);
  const formStartedAtRef = useRef<number | null>(null);
  const formStartedTrackedRef = useRef(false);
  const completedStepsRef = useRef(new Set<number>());
  const viewedStepsRef = useRef(new Set<number>());
  const formViewedRef = useRef(false);
  const winsRef = useRef<HTMLElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [winsVisible, setWinsVisible] = useState(false);
  const [finalCtaVisible, setFinalCtaVisible] = useState(false);
  const fieldFocusRef = useRef(new Map<AnswerKey, number>());
  const stepViewedAtRef = useRef(0);
  const abandonmentTrackedRef = useRef(false);
  const submittedRef = useRef(false);
  const currentStepRef = useRef(0);

  const step = steps[currentStep];
  const isReady = useMemo(() => validStep(currentStep, answers), [answers, currentStep]);

  useEffect(() => {
    return () => {
      if (choiceTimerRef.current) window.clearTimeout(choiceTimerRef.current);
    };
  }, []);

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
    if (viewedStepsRef.current.has(currentStep)) return;

    viewedStepsRef.current.add(currentStep);
    stepViewedAtRef.current = Date.now();
    captureFunnelEvent("form_step_viewed", {
      step_number: currentStep + 1,
      step_key: step.key,
      total_steps: steps.length
    });
  }, [currentStep, step.key]);

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

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const observeReveal = (
      element: Element | null,
      reveal: () => void,
      threshold: number,
      rootMargin = "0px 0px -8%"
    ) => {
      if (!element) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          reveal();
          observer.disconnect();
        },
        { threshold, rootMargin }
      );
      observer.observe(element);
      observers.push(observer);
    };

    observeReveal(winsRef.current, () => setWinsVisible(true), 0.16);
    observeReveal(finalCtaRef.current, () => setFinalCtaVisible(true), 0.4, "0px");

    return () => observers.forEach((observer) => observer.disconnect());
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

    choiceTimerRef.current = window.setTimeout(
      () => advance(nextAnswers),
      settings.autoAdvanceDelayMs
    );
  }

  function updateAnswer(fieldId: AnswerKey, value: string) {
    markFormStarted();
    setValidationVisible(false);
    setStatus("idle");
    setAnswers((current) => ({ ...current, [fieldId]: value }));
  }

  function advance(nextAnswers: Answers = answers) {
    if (status === "submitting") return;
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
    captureFunnelEvent("form_back_clicked", {
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
    captureFunnelEvent("form_submit_started", {
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
            ...getSubmissionAnalytics(),
            posthog_distinct_id: getPosthogDistinctId(),
            form_duration_ms: duration
          }
        })
      });

      const result = (await response.json()) as {
        ok?: boolean;
        leadId?: string;
        qualification?: "qualified" | "not-qualified";
        message?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The application could not be saved.");
      }

      if (result.leadId) {
        identifyAnalyticsLead(result.leadId);
        captureFunnelEvent("form_success_shown", { lead_id: result.leadId });
      }
      submittedRef.current = true;
      router.push(result.qualification === "qualified" ? "/qualified" : "/not-qualified");
    } catch (error) {
      setStatus("error");
      captureFunnelEvent("form_submit_failed", {
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
    captureFunnelEvent("primary_cta_clicked", {
      cta_location: location,
      button_label: settings.ctaLabel
    });
    document.querySelector("#waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <CinematicCurtain />

      <main style={{ "--green": accentColor } as CSSProperties}>
        <section className="hero" aria-labelledby="hero-title">
          <h1
            id="hero-title"
            className={`main-title${isBrandedHero ? " branded-main-title" : ""}`}
          >
            {isBrandedHero ? (
              <>
                <span className="hero-title-line hero-title-lead">
                  See How Regular<span className="mobile-title-break"><br /></span> People Are
                </span>
                <span className="hero-title-line hero-title-accent">
                  Building<span className="mobile-title-break"><br /></span> $5K-$30K/Month
                </span>
                <span className="hero-title-line hero-title-close">
                  AI Digital<span className="mobile-title-break"><br /></span> Ecom Businesses
                </span>
              </>
            ) : (
              settings.heroHeadline
            )}
          </h1>
          <h2 className="gradient-title waitlist-title">{settings.waitlistHeading}</h2>
        </section>

        <section id="waitlist" className="form-section" aria-label="Apply now">
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
              {!settings.formEnabled ? (
                <div className="success-panel paused-panel">
                  <h3>Applications are temporarily paused.</h3>
                  <p>Check back soon for the next opening.</p>
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

                      if (field.id === "phone_number") {
                        return (
                          <PhoneInput
                            className="phone-field"
                            key={field.id}
                            defaultCountry="us"
                            forceDialCode
                            value={answers[field.id]}
                            disabled={status === "submitting"}
                            inputProps={{
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
                        );
                      }

                      return (
                        <div className="optional-field" key={field.id}>
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

            {settings.formEnabled ? (
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
                            : "OK"
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
          </form>
        </section>

        {settings.showWins ? (
          <section
            ref={winsRef}
            className={`wins reveal-target${winsVisible ? " is-visible" : ""}`}
            aria-labelledby="wins-title"
          >
            <h2 id="wins-title">Student Results</h2>
            <div className="wins-masonry">
              {localWinImages.map((win) => (
                <span
                  className="win-image win-image-local"
                  key={win.src}
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
              {winImages.map(([id, width, height], index) => (
                <span
                  className="win-image"
                  key={`${id}-${index}`}
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
                      alt={`Inner Circle result ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                    />
                  </picture>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <div
          ref={finalCtaRef}
          className={`button-wrap final-cta reveal-target${finalCtaVisible ? " is-visible" : ""}`}
        >
          <button className="cta-button" type="button" onClick={() => scrollToForm("page_end")}>
            {settings.ctaLabel}
          </button>
        </div>
      </main>

    </>
  );
}
