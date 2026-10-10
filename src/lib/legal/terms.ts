import type { Locale } from "@/lib/i18n/types";

export interface TermsSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface TermsContent {
  title: string;
  lastUpdated: string;
  intro: string[];
  sections: TermsSection[];
  contactNote: string;
}

/**
 * Site terms & conditions, drafted against the laws of the Islamic Republic of Iran
 * (electronic transactions law, computer crimes law, copyright law, consumer rights).
 * Single source of truth — used by the signup modal and the /legal/terms page.
 */
export const TERMS: Record<Locale, TermsContent> = {
  fa: {
    title: "شرایط و مقررات",
    lastUpdated: "شهریور ۱۴۰۵",
    intro: [
      "با ثبت‌نام و استفاده از سایت آتلیه رزی، شما اعلام می‌کنید که این شرایط و مقررات را خوانده‌اید و آن را می‌پذیرید. این متن بر اساس قوانین جمهوری اسلامی ایران تدوین شده است.",
      "ما حق خود را برای به‌روزرسانی این شرایط در هر زمان محفوظ می‌داریم؛ آخرین تغییرات با انتشار روی همین صفحه لازم‌الاجرا خواهد بود.",
    ],
    sections: [
      {
        title: "۱. کلیات",
        paragraphs: [
          "آتلیه رزی یک پلتفرم الکترونیکی برای معرفی پترن‌ها، فروش محصولات دیجیتال و دکوری و ارائه خدمات آموزشی است. تمام فعالیت‌ها در چارچوب قوانین جمهوری اسلامی ایران و به‌ویژه قانون معاملات الکترونیکی (مصوب ۱۳۸۲) انجام می‌شود.",
          "اگر با هر بخشی از این شرایط مخالف هستید، لطفاً از ثبت‌نام و استفاده از سایت خودداری کنید.",
        ],
      },
      {
        title: "۲. ثبت‌نام و حساب کاربری",
        bullets: [
          "اطلاعات واردشده در فرم ثبت‌نام باید دقیق، واقعی و به‌روز باشد؛ مسئولیت صحت اطلاعات بر عهده کاربر است.",
          "حفظ محرمانگی ایمیل و رمز عبور بر عهده کاربر است و کاربر مسئول همه فعالیت‌هایی است که از حساب او انجام می‌شود.",
          "هر شخص فقط یک حساب کاربری مجاز است؛ ایجاد حساب جعلی یا جعل هویت ممنوع است.",
          "سایت در صورت تخلف، نقض این مقررات یا نقض قوانین، می‌تواند دسترسی حساب را محدود یا مسدود کند.",
        ],
      },
      {
        title: "۳. پترن‌های دیجیتال و لایسنس",
        paragraphs: [
          "پترن‌های دیجیتال، کالای ملموس نیستند و فقط تحت مجوز (لایسنس) مشخصی عرضه می‌شوند؛ یعنی مالکیت اثر به خریدار منتقل نمی‌شود.",
        ],
        bullets: [
          "لایسنس شخصی: استفاده در فضای شخصی، بدون انتشار و بدون فروش.",
          "لایسنس تجاری: چاپ و فروش تا ۵۰۰ واحد یا در یک پروژه مشخص.",
          "لایسنس گسترده: استفاده نامحدود، شامل کاربرد برندینگ.",
          "توزیع، بازفروش، انتشار در پلتفرم‌های دیگر یا تغییر و جعل امضای اثر ممنوع است و مطابق قانون حق مؤلف (قانون حق اثر) پیگیری قانونی خواهد شد.",
        ],
      },
      {
        title: "۴. خرید و پرداخت",
        bullets: [
          "پرداخت‌ها از مسیر امن درگاه پرداخت بانکی انجام می‌شود و اطلاعات کارت بانکی توسط این سایت ذخیره نمی‌شود.",
          "پس از تأیید پرداخت، لینک دریافت فایل بلافاصله فعال می‌شود.",
          "به‌دلیل ماهیت غیرملموس کالاهای دیجیتال، امکان بازگشت کالا و استرداد کامل وجه وجود ندارد؛ در صورت مشکل فنی در دریافت فایل، تیم پشتیبانی فایل را مجدداً ارسال می‌کند.",
        ],
      },
      {
        title: "۵. حریم خصوصی و داده‌های شخصی",
        bullets: [
          "فقط داده‌هایی جمع‌آوری می‌شود که برای ارائه خدمت لازم است (نام، ایمیل، سفارش‌ها و علاقه‌مندی‌ها).",
          "داده‌های کاربران هرگز به شخص ثالث فروخته یا اجاره داده نمی‌شود.",
          "کاربر می‌تواند از طریق بخش پشتیبانی، درخواست مشاهده یا حذف اطلاعات خود را ثبت کند.",
        ],
      },
      {
        title: "۶. موارد ممنوعه و جرایم رایانه‌ای",
        paragraphs: [
          "هرگونه تلاش برای دسترسی غیرمجاز به سیستم‌ها، عبور از محدودیت‌های امنیتی، انتشار بدافزار، اسکن یا هجوم به سرورها و استفاده نادرست از خدمات سایت، مغایر قانون جرایم رایانه‌ای (مصوب ۱۳۹۰ و اصلاحات بعدی) است و موجب پیگرد قانونی خواهد شد.",
        ],
      },
      {
        title: "۷. محدودیت مسئولیت",
        paragraphs: [
          "سایت تلاش می‌کند خدمات را به‌صورت مداوم و بدون نقص ارائه دهد، اما تضمینی برای در دسترس بودن دائمی سرویس وجود ندارد.",
          "آتلیه رزی مسئول خسارات غیرمستقیم و یا خسارات ناشی از استفاده نادرست کاربر از خدمات نیست.",
        ],
      },
      {
        title: "۸. قانون حاکم و حل اختلاف",
        paragraphs: [
          "این شرایط و مقررات تابع قوانین جمهوری اسلامی ایران است.",
          "در صورت اختلاف، ابتدا از طریق مذاکره و هماهنگی با پشتیبانی تلاش برای حل‌وفصل می‌شود و در صورت عدم توافق، موضوع به مراجع قضایی صالحهٔ جمهوری اسلامی ایران ارجاع داده می‌شود.",
        ],
      },
    ],
    contactNote:
      "در صورت هرگونه پرسش درباره این شرایط و مقررات، از طریق صفحهٔ «تماس با ما» یا ایمیل پشتیبانی با ما در ارتباط باشید.",
  },
  en: {
    title: "Terms & Conditions",
    lastUpdated: "September 2026",
    intro: [
      "By registering for or using Rosie Atelier, you confirm that you have read and accept these terms and conditions. This document is drafted in accordance with the laws of the Islamic Republic of Iran.",
      "We reserve the right to update these terms at any time; the latest version, once published on this page, will be binding.",
    ],
    sections: [
      {
        title: "1. General",
        paragraphs: [
          "Rosie Atelier is an electronic platform for discovering patterns, selling digital and décor products, and providing educational services. All operations are conducted under the laws of the Islamic Republic of Iran, notably the Electronic Transactions Law (2003).",
          "If you disagree with any part of these terms, please refrain from registering for or using the site.",
        ],
      },
      {
        title: "2. Registration & user accounts",
        bullets: [
          "Information provided in the registration form must be accurate, truthful and up to date; the user is responsible for its correctness.",
          "Keeping your email and password confidential is the user's responsibility; the user is accountable for all activity performed from their account.",
          "Each person is entitled to a single account; creating fake accounts or impersonating others is prohibited.",
          "The site may restrict or suspend account access in case of violation of these terms or of applicable laws.",
        ],
      },
      {
        title: "3. Digital patterns & licensing",
        paragraphs: [
          "Digital patterns are not tangible goods; they are offered strictly under a specific license — ownership of the work is not transferred to the buyer.",
        ],
        bullets: [
          "Personal license: use in your private space, no publishing, no resale.",
          "Commercial license: print and sell up to 500 units or within a single defined project.",
          "Extended license: unlimited use, including branding applications.",
          "Distribution, resale, publishing on other platforms, or modification and re-signing of a work is prohibited and will be pursued under the Copyright Law (Author's Rights Law).",
        ],
      },
      {
        title: "4. Purchase & payment",
        bullets: [
          "Payments are processed through a secure bank payment gateway; card details are never stored by this site.",
          "Once payment is confirmed, the file download link is activated immediately.",
          "Due to the intangible nature of digital goods, returns and full refunds are not available; in case of a technical problem with the download, support will re-send the file.",
        ],
      },
      {
        title: "5. Privacy & personal data",
        bullets: [
          "Only data necessary to provide the service is collected (name, email, orders and preferences).",
          "User data is never sold or rented to third parties.",
          "Users may request to view or delete their data through the support section.",
        ],
      },
      {
        title: "6. Prohibited acts & computer crimes",
        paragraphs: [
          "Any attempt to gain unauthorised access to the systems, circumventing security restrictions, spreading malware, scanning or attacking the servers, or abusing site services violates the Computer Crimes Law (2011 and its amendments) and is subject to legal prosecution.",
        ],
      },
      {
        title: "7. Limitation of liability",
        paragraphs: [
          "The site endeavours to provide its services continuously and without defects, but no guarantee is given for permanent availability of the service.",
          "Rosie Atelier is not liable for indirect damages or for damages arising from a user's improper use of the services.",
        ],
      },
      {
        title: "8. Governing law & dispute resolution",
        paragraphs: [
          "These terms and conditions are governed by the laws of the Islamic Republic of Iran.",
          "In case of a dispute, the parties will first attempt to resolve it through negotiation with support; failing that, the matter shall be referred to the competent judicial authorities of the Islamic Republic of Iran.",
        ],
      },
    ],
    contactNote:
      "If you have any questions about these terms and conditions, please contact us through the “Contact us” page or the support email.",
  },
};
