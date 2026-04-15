"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  LifeBuoy,
  Shield,
  AlertTriangle,
  FileWarning,
  Building2,
  Users,
  Heart,
  ChevronDown,
  MessageCircle,
  BookOpen,
  Send,
  Radio,
  Waves,
  CloudRain,
  Bell,
  MapPin,
  Clock,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const emergencyContacts = [
  { label: "emergency", number: "119", icon: Phone, color: "text-red-500", bg: "bg-red-50" },
  { label: "police", number: "118", icon: Shield, color: "text-blue-500", bg: "bg-blue-50" },
  { label: "ambulance", number: "1990", icon: Heart, color: "text-green-500", bg: "bg-green-50" },
  { label: "fire", number: "110", icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50" },
  { label: "disaster", number: "011-2674140", icon: Building2, color: "text-amber-500", bg: "bg-amber-50" },
];

// New FAQ items focused on disaster management & early warning systems
const faqs = [
  {
    questionKey: "faq1Question",
    answerKey: "faq1Answer",
    icon: Radio,
  },
  {
    questionKey: "faq2Question",
    answerKey: "faq2Answer",
    icon: Bell,
  },
  {
    questionKey: "faq3Question",
    answerKey: "faq3Answer",
    icon: Waves,
  },
  {
    questionKey: "faq4Question",
    answerKey: "faq4Answer",
    icon: CloudRain,
  },
  {
    questionKey: "faq5Question",
    answerKey: "faq5Answer",
    icon: MapPin,
  },
  {
    questionKey: "faq6Question",
    answerKey: "faq6Answer",
    icon: Clock,
  },
];

const guides = [
  {
    titleKey: "guide1Title",
    descKey: "guide1Desc",
    icon: BookOpen,
    href: "/alerts",
  },
  {
    titleKey: "guide2Title",
    descKey: "guide2Desc",
    icon: FileWarning,
    href: "/incidents",
  },
  {
    titleKey: "guide3Title",
    descKey: "guide3Desc",
    icon: Building2,
    href: "/shelters",
  },
  {
    titleKey: "guide4Title",
    descKey: "guide4Desc",
    icon: Users,
    href: "/volunteer",
  },
];

function FAQItem({ question, answer, Icon }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-sky-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-100 transition-colors">
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-medium text-slate-800">{question}</span>
        </div>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function HelpSupportPage() {
  const { t } = useTranslation();

  // Translation keys for new FAQ content (to be added to your locale files)
  // For demo purposes, we'll provide fallback English text directly in component.
  // In real usage, use t() with proper keys.
  const getFaqQuestion = (key) => {
    const questions = {
      faq1Question: "How does the early warning system work?",
      faq2Question: "What should I do when I receive a disaster alert?",
      faq3Question: "How are tsunamis detected and warnings issued?",
      faq4Question: "What is the difference between a watch and a warning?",
      faq5Question: "How can I find the nearest evacuation center?",
      faq6Question: "How much time will I have to evacuate?",
    };
    return questions[key] || key;
  };

  const getFaqAnswer = (key) => {
    const answers = {
      faq1Answer: "Our system integrates with national meteorological departments, seismic sensors, and hydrological stations. When thresholds are exceeded, alerts are automatically pushed via SMS, mobile apps, sirens, and broadcast media. Warnings are tiered: advisory, watch, warning, and emergency.",
      faq2Answer: "Immediately follow official instructions. If evacuation is ordered, take your emergency kit, lock doors/windows, and proceed to the nearest shelter. Avoid using elevators. Tune into local radio or our app for updates. Never ignore a warning—act first, verify later.",
      faq3Answer: "Tsunamis are detected by a network of seabed pressure sensors and coastal tide gauges. Seismic data from earthquakes >6.5 magnitude triggers automated analysis. If a tsunami is confirmed, warnings are issued within minutes via all channels. Stay away from coastal areas until all-clear is given.",
      faq4Answer: "A 'watch' means conditions are favorable for a disaster (e.g., flooding or storm) within the next 24–48 hours—stay informed. A 'warning' means the event is imminent or occurring—take immediate protective action. A 'warning' requires urgent response.",
      faq5Answer: "Use the 'Shelters' section in this app or visit disasterwatch.lk/maps. You can also SMS your location to 1919 (free). Look for green evacuation route signs in your community. We recommend pre-identifying two routes from home and work.",
      faq6Answer: "It depends on the hazard: For flash floods, as little as 15–30 minutes. For tsunamis, 30 minutes to 3 hours depending on distance from epicenter. For cyclones, 12–24 hours. Always prepare a 'go-bag' and never delay evacuation when a warning is issued.",
    };
    return answers[key] || key;
  };

  const pageTitle = t("helpSupport.title", "Help & Support");
  const pageSubtitle = t("helpSupport.subtitle", "Resources, emergency contacts, and answers to your questions about disaster preparedness.");
  const emergencyTitle = t("helpSupport.emergencyTitle", "Emergency Hotlines");
  const emergencySubtitle = t("helpSupport.emergencySubtitle", "Available 24/7. Save these numbers.");
  const faqTitle = t("helpSupport.faqTitle", "Frequently Asked Questions");
  const faqSubtitle = t("helpSupport.faqSubtitle", "Everything you need to know about early warnings and disaster response.");
  const guidesTitle = t("helpSupport.guidesTitle", "Quick Guides");
  const guidesSubtitle = t("helpSupport.guidesSubtitle", "Step-by-step resources to stay safe.");
  const contactTitle = t("helpSupport.contactTitle", "Get in Touch");
  const contactSubtitle = t("helpSupport.contactSubtitle", "We're here to help. Send us a message.");
  const formName = t("helpSupport.formName", "Full name");
  const formEmail = t("helpSupport.formEmail", "Email address");
  const formMessage = t("helpSupport.formMessage", "Your message");
  const formSubmit = t("helpSupport.formSubmit", "Send message");
  const formSubmitting = t("helpSupport.formSubmitting", "Sending...");
  const formSuccess = t("helpSupport.formSuccess", "Message sent successfully! We'll reply soon.");
  const backToHome = t("helpSupport.backToHome", "Back to Home");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitted(true);
    setFormData({ name: "", email: "", message: "" });
    setIsSubmitting(false);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
      {/* Hero Section with modern gradient and pattern */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-sky-900 to-indigo-900 text-white">
        <div className="absolute inset-0 opacity-20">
          <svg className="h-full w-full" viewBox="0 0 1200 600" preserveAspectRatio="none">
            <path
              d="M0,200 C300,100 500,300 800,200 C1100,100 1200,250 1200,250 L1200,600 L0,600 Z"
              fill="url(#hero-wave)"
            />
            <defs>
              <linearGradient id="hero-wave" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl"></div>
        <div className="absolute left-0 bottom-0 -ml-32 -mb-32 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"></div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-sky-100 backdrop-blur-sm transition hover:bg-white/20 hover:text-white mb-8"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            {backToHome}
          </Link>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
              <LifeBuoy className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="font-oswald text-4xl font-bold tracking-tight sm:text-5xl">
                {pageTitle}
              </h1>
              <p className="mt-2 max-w-2xl text-lg text-sky-100/90">
                {pageSubtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 -mt-8">
        {/* Emergency Contacts - Modern cards with hover effect */}
        <div className="mb-12 rounded-3xl bg-white/80 backdrop-blur-sm shadow-xl border border-white/50 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
              <Phone className="h-6 w-6 text-red-500" />
              {emergencyTitle}
            </h2>
            <p className="mt-1 text-slate-500">{emergencySubtitle}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {emergencyContacts.map(({ label, number, icon: Icon, color, bg }) => (
              <a
                key={label}
                href={`tel:${number}`}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:shadow-lg hover:border-sky-200 hover:-translate-y-0.5"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bg} ${color} transition-all group-hover:scale-105`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t(`helpSupport.${label}`, label)}
                  </p>
                  <p className="text-lg font-bold text-slate-800">{number}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column: Guides + FAQs */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Guides */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-sm shadow-xl border border-white/50 p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                  <BookOpen className="h-6 w-6 text-sky-600" />
                  {guidesTitle}
                </h2>
                <p className="mt-1 text-slate-500">{guidesSubtitle}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {guides.map(({ titleKey, descKey, icon: Icon, href }) => (
                  <Link
                    key={titleKey}
                    href={href}
                    className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:shadow-md hover:border-sky-200 hover:-translate-y-0.5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-100 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {t(titleKey, titleKey.replace("Title", ""))}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {t(descKey, "Learn more →")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* FAQ Section - Recreated with disaster management content */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-sm shadow-xl border border-white/50 p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                  <MessageCircle className="h-6 w-6 text-sky-600" />
                  {faqTitle}
                </h2>
                <p className="mt-1 text-slate-500">{faqSubtitle}</p>
              </div>
              <div className="space-y-3">
                {faqs.map(({ questionKey, answerKey, icon: Icon }) => (
                  <FAQItem
                    key={questionKey}
                    question={getFaqQuestion(questionKey)}
                    answer={getFaqAnswer(answerKey)}
                    Icon={Icon}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Contact Form - Modern sticky card */}
          <div>
            <div className="sticky top-8 rounded-3xl bg-white/80 backdrop-blur-sm shadow-xl border border-white/50 p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                  <Mail className="h-6 w-6 text-sky-600" />
                  {contactTitle}
                </h2>
                <p className="mt-1 text-slate-500">{contactSubtitle}</p>
              </div>

              {submitted && (
                <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  {formSuccess}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {formName}
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20 transition"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {formEmail}
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20 transition"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {formMessage}
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20 transition resize-none"
                    placeholder="How can we assist you with disaster preparedness?"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-sky-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-sky-500/50 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {formSubmitting}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {formSubmit}
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 space-y-3 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                    <Mail className="h-4 w-4" />
                  </div>
                  <span>support@disasterwatch.lk</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                    <Phone className="h-4 w-4" />
                  </div>
                  <span>011-2674140 (Mon-Fri, 9AM-5PM)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <span>24/7 Emergency: 119</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}