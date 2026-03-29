import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "@/locales/en/common.json";
import siCommon from "@/locales/si/common.json";

// Initialize i18next once. This app uses the Next.js app router and
// the module may be evaluated multiple times; i18next's init is idempotent.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: enCommon },
      si: { translation: siCommon },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
