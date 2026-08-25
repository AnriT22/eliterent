/* ============================================================================
   Server-side localization renderer  —  /ru/* and /ka/*
   ----------------------------------------------------------------------------
   Serves crawlable localized HTML by applying the SAME translation files the
   client uses (lang/ru.json, lang/ka.json) to the existing English pages.

   For each localized request it:
     1. translates [data-i18n] (text) and [data-i18n-html] (markup) nodes,
        mirroring i18n.js (English fallback; untranslated keys are left as-is so
        the client i18n.js can still finish them — progressive enhancement);
     2. sets <html lang>, rewrites <title>/<meta description> (RU map below),
        rewrites canonical + og:url to the localized URL, and injects correct
        bidirectional hreflang (en / ru / ka / x-default);
     3. makes relative asset URLs root-absolute so CSS/JS/images still load
        from "/" when the page is served under "/ru/…" (page links stay relative
        so in-language navigation works);
     4. seeds localStorage so the client i18n doesn't translate the page back.

   SAFETY: everything runs inside try/catch; on ANY error it calls next(), so the
   English site is never affected. Only whitelisted marketing pages are localized.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const seoPrerender = require('./seo-prerender');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://eliteauto.rent';
const LANGS = ['ru', 'ka', 'he', 'tr'];
const RTL_LANGS = ['he'];

// Built from LANGS so a new language only has to be added in one place.
const LANG_PATH_RE = new RegExp('^\/(' + LANGS.join('|') + ')(?:\/(.*))?$');

// Pages served under /ru/ and /ka/. A page belongs here ONLY when its on-page
// BODY is genuinely translated (not just its <title>/<meta>) — otherwise we'd
// publish a localized URL with English content (a duplicate/doorway risk) and
// declare reciprocal hreflang to a page that isn't really localized.
//
// Gate scope (Wave 1): the funnel pages whose bodies are fully translated via
// data-i18n. City, category and blog pages are intentionally EXCLUDED until
// their bodies are translated (rolling rollout, tracked as S-03). When a page
// is translated, add it here AND add its ru/ka <xhtml:link> alternates back to
// sitemap.xml AND its hreflang to the English page — all three must stay in sync.
const LOCALIZABLE = {
    '': 1, 'index.html': 1, 'vehicles.html': 1, 'reviews.html': 1, 'about.html': 1,
    'contact.html': 1
};

// Static per-language pages (real translated files on disk, e.g. he/*.html —
// the Hebrew Wave-1 landing pages). Links to these are kept in-language; links
// to pages with NO version in the current language are pointed at the English
// page instead of 404-ing under /<lang>/.
var staticLangFiles = {};
LANGS.forEach(function (lang) {
    try {
        staticLangFiles[lang] = new Set(
            fs.readdirSync(path.join(ROOT, lang)).filter(function (f) { return f.endsWith('.html'); })
        );
    } catch (e) { staticLangFiles[lang] = new Set(); }
});
function hasLangVersion(lang, page) {
    return Object.prototype.hasOwnProperty.call(LOCALIZABLE, page) || staticLangFiles[lang].has(page);
}

// Localized <title> / meta description for the core money pages.
// RU is provided; KA bodies are localized from ka.json but KA <title>/<meta>
// should be filled by a native speaker (see SEO-CHANGES.md).
const SEO = {
    ru: {
        'index.html': { title: 'Аренда авто в Грузии — Тбилиси, Батуми и Кутаиси', desc: 'Аренда автомобиля в Грузии от $39/день. Выдача в аэропортах Тбилиси, Батуми и Кутаиси. Внедорожники, седаны и люкс от проверенных партнёров. Без депозита, страховка включена.' },
        'vehicles.html': { title: 'Аренда авто в Грузии — от $39/день | EliteAuto', desc: 'Выберите автомобиль для аренды в Грузии — внедорожники, седаны, эконом и люкс. Без депозита, выдача в аэропорту, страховка включена. От $39/день.' },
        'reviews.html': { title: 'Отзывы об аренде авто в Грузии | EliteAuto.rent', desc: 'Реальные отзывы и истории путешественников, арендовавших авто в Грузии через EliteAuto.rent — Тбилиси, Батуми и Кутаиси.' },
        'about.html': { title: 'О нас — EliteAuto.rent | Аренда авто в Грузии', desc: 'Узнайте об EliteAuto.rent — маркетплейс аренды авто в Грузии, объединяющий путешественников с проверенными местными партнёрами.' },
        'contact.html': { title: 'Контакты — EliteAuto.rent', desc: 'Свяжитесь с EliteAuto.rent — поддержка по аренде авто в Грузии. WhatsApp, email и телефон. Помощь в Тбилиси, Батуми и Кутаиси.' },
        'rent-car-tbilisi.html': { title: 'Аренда авто в Тбилиси — аэропорт 24/7 | EliteAuto', desc: 'Аренда автомобиля в Тбилиси от проверенных партнёров. Выдача в аэропорту Тбилиси (TBS) круглосуточно. Без депозита, страховка включена, от $39/день.' },
        'rent-car-batumi.html': { title: 'Аренда авто в Батуми — море и горы | EliteAuto', desc: 'Аренда автомобиля в Батуми от проверенных партнёров. Выдача в аэропорту, без депозита, страховка включена. Идеально для побережья и горных поездок.' },
        'rent-car-kutaisi.html': { title: 'Аренда авто в Кутаиси — выдача в аэропорту | EliteAuto', desc: 'Аренда автомобиля в Кутаиси с выдачей в аэропорту (KUT). Проверенные партнёры, без депозита, страховка включена, от $39/день.' },
        'tbilisi-airport-car-rental.html': { title: 'Аренда авто в аэропорту Тбилиси (TBS) | 24/7', desc: 'Аренда авто в аэропорту Тбилиси (TBS) с выдачей 24/7. Бесплатная встреча, без депозита, страховка включена. Бронируйте онлайн от $39/день.' },
        'no-deposit-car-rental-georgia.html': { title: 'Аренда авто в Грузии без депозита | Без карты', desc: 'Аренда авто в Грузии без депозита и с гибкой оплатой. Партнёры в Тбилиси, Батуми и Кутаиси с опцией без залога. Бронируйте онлайн от $39/день.' },
        'suv-rental-georgia.html': { title: 'Аренда внедорожников и 4x4 в Грузии | EliteAuto', desc: 'Аренда внедорожника или 4x4 в Грузии от $50/день. Идеально для Казбеги, Сванети и Тушети. Toyota Land Cruiser, Hyundai Tucson. Выдача в аэропорту.' },
        'economy-car-rental-georgia.html': { title: 'Аренда эконом-авто в Грузии | от $39/день', desc: 'Дешёвая аренда эконом-авто в Грузии от $39/день. Экономичные хэтчбеки в Тбилиси, Батуми и Кутаиси. Без депозита, выдача в аэропорту, страховка включена.' },
        'sedan-rental-georgia.html': { title: 'Аренда седана в Грузии | от $30/день', desc: 'Аренда комфортного седана в Грузии от $30/день. Toyota Camry, Hyundai Sonata в Тбилиси, Батуми и Кутаиси. Для бизнеса, трансферов и трасс.' },
        'luxury-car-rental-tbilisi.html': { title: 'Аренда люкс-авто в Тбилиси | Премиум-класс', desc: 'Аренда люксовых и представительских авто в Тбилиси. Mercedes S-Class, BMW 7 Series и Range Rover. Для свадеб, бизнеса и VIP. От $80/день.' },
        'minivan-7-seater-rental-georgia.html': { title: 'Аренда минивэна и 7-местных авто в Грузии', desc: 'Аренда 7-местного авто или минивэна в Грузии от $45/день. Toyota Alphard, Kia Carnival для семей и групп в Тбилиси, Батуми и Кутаиси.' }
    },
    ka: {
        'index.html': { title: 'მანქანის ქირაობა საქართველოში — თბილისი, ბათუმი, ქუთაისი', desc: 'იქირავეთ ავტომობილი საქართველოში დღეში $39-დან. აყვანა თბილისის, ბათუმისა და ქუთაისის აეროპორტებში. ჯიპები, სედანები და ლუქს კლასი ვერიფიცირებული პარტნიორებისგან. დეპოზიტის გარეშე, დაზღვევა შედის.' },
        'vehicles.html': { title: 'მანქანის ქირაობა საქართველოში — დღეში $39-დან | EliteAuto', desc: 'აირჩიეთ გასაქირავებელი ავტომობილი საქართველოში — ჯიპები, სედანები, ეკონომ და ლუქს კლასი. დეპოზიტის გარეშე, აყვანა აეროპორტში, დაზღვევა შედის. დღეში $39-დან.' },
        'reviews.html': { title: 'შეფასებები — მანქანის ქირაობა საქართველოში | EliteAuto', desc: 'ნამდვილი შეფასებები მოგზაურებისგან, რომლებმაც იქირავეს მანქანა საქართველოში EliteAuto.rent-ით — თბილისი, ბათუმი და ქუთაისი.' },
        'about.html': { title: 'ჩვენს შესახებ — EliteAuto.rent | მანქანის ქირაობა', desc: 'გაიგეთ EliteAuto.rent-ის შესახებ — მანქანის ქირაობის პლატფორმა საქართველოში, რომელიც მოგზაურებს უკავშირებს ვერიფიცირებულ ადგილობრივ პარტნიორებს.' },
        'contact.html': { title: 'კონტაქტი — EliteAuto.rent', desc: 'დაგვიკავშირდით EliteAuto.rent-ს — მხარდაჭერა მანქანის ქირაობაში საქართველოში. WhatsApp, ელფოსტა და ტელეფონი. დახმარება თბილისში, ბათუმსა და ქუთაისში.' },
        'rent-car-tbilisi.html': { title: 'მანქანის ქირაობა თბილისში — აეროპორტი 24/7 | EliteAuto', desc: 'იქირავეთ ავტომობილი თბილისში ვერიფიცირებული პარტნიორებისგან. აყვანა თბილისის აეროპორტში (TBS) 24/7. დეპოზიტის გარეშე, დაზღვევა შედის, დღეში $39-დან.' },
        'rent-car-batumi.html': { title: 'მანქანის ქირაობა ბათუმში — ზღვა და მთა | EliteAuto', desc: 'იქირავეთ ავტომობილი ბათუმში ვერიფიცირებული პარტნიორებისგან. აყვანა აეროპორტში, დეპოზიტის გარეშე, დაზღვევა შედის. იდეალურია სანაპიროსა და მთის მოგზაურობისთვის.' },
        'rent-car-kutaisi.html': { title: 'მანქანის ქირაობა ქუთაისში — აეროპორტში აყვანა | EliteAuto', desc: 'იქირავეთ ავტომობილი ქუთაისში აეროპორტში აყვანით (KUT). ვერიფიცირებული პარტნიორები, დეპოზიტის გარეშე, დაზღვევა შედის, დღეში $39-დან.' },
        'tbilisi-airport-car-rental.html': { title: 'მანქანის ქირაობა თბილისის აეროპორტში (TBS) | 24/7', desc: 'მანქანის ქირაობა თბილისის აეროპორტში (TBS) აყვანით 24/7. უფასო შეხვედრა, დეპოზიტის გარეშე, დაზღვევა შედის. დაჯავშნეთ ონლაინ დღეში $39-დან.' },
        'no-deposit-car-rental-georgia.html': { title: 'მანქანის ქირაობა დეპოზიტის გარეშე საქართველოში', desc: 'იქირავეთ მანქანა საქართველოში დეპოზიტის გარეშე და მოქნილი გადახდით. პარტნიორები თბილისში, ბათუმსა და ქუთაისში დეპოზიტის გარეშე ვარიანტებით. დაჯავშნეთ ონლაინ დღეში $39-დან.' },
        'suv-rental-georgia.html': { title: 'ჯიპებისა და 4x4-ის ქირაობა საქართველოში | EliteAuto', desc: 'იქირავეთ ჯიპი ან 4x4 საქართველოში დღეში $50-დან. იდეალურია ყაზბეგის, სვანეთისა და თუშეთის გზებისთვის. Toyota Land Cruiser, Hyundai Tucson. აყვანა აეროპორტში.' },
        'economy-car-rental-georgia.html': { title: 'ეკონომ კლასის მანქანის ქირაობა საქართველოში | $39/დღე', desc: 'იაფი ეკონომ კლასის მანქანის ქირაობა საქართველოში დღეში $39-დან. ეკონომიური ჰეტჩბექები თბილისში, ბათუმსა და ქუთაისში. დეპოზიტის გარეშე, აყვანა აეროპორტში, დაზღვევა შედის.' },
        'sedan-rental-georgia.html': { title: 'სედანის ქირაობა საქართველოში | $30/დღე', desc: 'იქირავეთ კომფორტული სედანი საქართველოში დღეში $30-დან. Toyota Camry, Hyundai Sonata თბილისში, ბათუმსა და ქუთაისში. ბიზნესის, ტრანსფერებისა და მაგისტრალებისთვის.' },
        'luxury-car-rental-tbilisi.html': { title: 'ლუქს კლასის მანქანის ქირაობა თბილისში | პრემიუმ', desc: 'ლუქს და წარმომადგენლობითი კლასის მანქანების ქირაობა თბილისში. Mercedes S-Class, BMW 7 Series და Range Rover. ქორწილების, ბიზნესისა და VIP-ისთვის. დღეში $80-დან.' },
        'minivan-7-seater-rental-georgia.html': { title: 'მინივენისა და 7-ადგილიანის ქირაობა საქართველოში', desc: 'იქირავეთ 7-ადგილიანი ავტომობილი ან მინივენი საქართველოში დღეში $45-დან. Toyota Alphard, Kia Carnival ოჯახებისა და ჯგუფებისთვის თბილისში, ბათუმსა და ქუთაისში.' }
    },
    he: {
        'index.html': { title: 'השכרת רכב בגאורגיה — טביליסי, בטומי וקוטאיסי', desc: 'השכרת רכב בגאורגיה מ-$39 ליום. איסוף משדות התעופה טביליסי, בטומי וקוטאיסי. רכבי שטח, סדאן ויוקרה משותפים מקומיים מאומתים. ללא פיקדון, ביטול חינם, ביטוח כלול.' },
        'vehicles.html': { title: 'השכרת רכב בגאורגיה — מ-$39 ליום | EliteAuto', desc: 'בחרו רכב להשכרה בגאורגיה — רכבי שטח, סדאן, אקונומי ויוקרה. ללא פיקדון, איסוף משדה התעופה, ביטוח כלול. מ-$39 ליום.' },
        'reviews.html': { title: 'ביקורות על השכרת רכב בגאורגיה | EliteAuto.rent', desc: 'ביקורות אמיתיות וסיפורים ממטיילים ששכרו רכב בגאורגיה דרך EliteAuto.rent — טביליסי, בטומי וקוטאיסי.' },
        'about.html': { title: 'אודות — EliteAuto.rent | השכרת רכב בגאורגיה', desc: 'הכירו את EliteAuto.rent — פלטפורמת השכרת רכב בגאורגיה המחברת מטיילים עם שותפים מקומיים מאומתים.' },
        'contact.html': { title: 'צור קשר — EliteAuto.rent', desc: 'צרו קשר עם EliteAuto.rent — תמיכה בהשכרת רכב בגאורגיה. וואטסאפ, אימייל וטלפון. סיוע בטביליסי, בטומי וקוטאיסי.' }
    }
};

var cache = {};
function loadLang(lang) {
    if (cache[lang]) return cache[lang];
    try {
        cache[lang] = JSON.parse(fs.readFileSync(path.join(ROOT, 'lang', lang + '.json'), 'utf8'));
    } catch (e) {
        console.error('[i18n-render] load ' + lang + ':', e.message);
        cache[lang] = {};
    }
    return cache[lang];
}

function resolveKey(obj, key) {
    if (!obj) return undefined;
    var parts = key.split('.');
    for (var i = 0; i < parts.length; i++) {
        if (obj === undefined || obj === null) return undefined;
        obj = obj[parts[i]];
    }
    return obj;
}

function makeT(lang) {
    var primary = loadLang(lang);
    var fallback = loadLang('en');
    return function (key) {
        var v = resolveKey(primary, key);
        if (v === undefined || v === null) v = resolveKey(fallback, key);
        return (typeof v === 'string') ? v : null;
    };
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function localize(html, lang, page, t) {
    // 1) Body: [data-i18n] → textContent (escaped); [data-i18n-html] → innerHTML (raw)
    html = html.replace(
        /(<([a-zA-Z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
        function (m, open, tag, key, inner, close) {
            var v = t(key);
            return (v == null) ? m : open + escapeHtml(v) + close;
        }
    );
    html = html.replace(
        /(<([a-zA-Z][\w-]*)\b[^>]*\bdata-i18n-html="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
        function (m, open, tag, key, inner, close) {
            var v = t(key);
            return (v == null) ? m : open + v + close;
        }
    );

    // 2) <html lang="en"> → localized, plus text direction (Hebrew = RTL).
    html = html.replace(/(<html\b[^>]*\blang=")[^"]*(")/i, '$1' + lang + '$2');
    var dir = (RTL_LANGS.indexOf(lang) !== -1) ? 'rtl' : 'ltr';
    html = html.replace(/(<html\b[^>]*?)\s+dir="[^"]*"/i, '$1');      // strip any existing dir
    html = html.replace(/<html\b([^>]*)>/i, '<html$1 dir="' + dir + '">');
    if (dir === 'rtl') {
        // RTL stylesheet for first paint (no-JS/crawlers). Same id i18n.js uses,
        // so the client never double-injects it.
        html = html.replace(/<\/head>/i, '    <link id="eliteauto-rtl-css" rel="stylesheet" href="/rtl.css">\n</head>');
    }

    // 3) Localized <title> / meta description (RU map; KA optional).
    // NOTE: replacement VALUES can contain "$" (e.g. "$39/день"), so we use
    // function replacements everywhere — string replacements would treat "$2" as
    // a backreference and corrupt the output.
    var seo = (SEO[lang] || {})[page || 'index.html'];
    if (seo) {
        if (seo.title) {
            html = html.replace(/<title>[\s\S]*?<\/title>/, function () { return '<title>' + escapeHtml(seo.title) + '</title>'; });
            html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, function (mm, a, b) { return a + escapeAttr(seo.title) + b; });
            html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i, function (mm, a, b) { return a + escapeAttr(seo.title) + b; });
        }
        if (seo.desc) {
            html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/i, function (mm, a, b) { return a + escapeAttr(seo.desc) + b; });
            html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/i, function (mm, a, b) { return a + escapeAttr(seo.desc) + b; });
        }
    }

    // 4) Canonical + og:url → localized URL; rebuild hreflang alternates
    var urlPage = (page === 'index.html') ? '' : page; // homepage canonical stays "/lang/"
    var enUrl = SITE + '/' + urlPage;
    var ruUrl = SITE + '/ru/' + urlPage;
    var kaUrl = SITE + '/ka/' + urlPage;
    var heUrl = SITE + '/he/' + urlPage;
    var trUrl = SITE + '/tr/' + urlPage;
    var selfUrl = SITE + '/' + lang + '/' + urlPage;
    html = html.replace(/(<link rel="canonical" href=")[^"]*(">)/i, function (mm, a, b) { return a + selfUrl + b; });
    html = html.replace(/(<meta property="og:url" content=")[^"]*(">)/i, function (mm, a, b) { return a + selfUrl + b; });
    // strip any existing alternates, then inject the correct set after canonical
    html = html.replace(/[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*">\s*/gi, '');
    var alts = [
        '<link rel="alternate" hreflang="en" href="' + enUrl + '">',
        '<link rel="alternate" hreflang="ru" href="' + ruUrl + '">',
        '<link rel="alternate" hreflang="ka" href="' + kaUrl + '">',
        '<link rel="alternate" hreflang="he" href="' + heUrl + '">',
        '<link rel="alternate" hreflang="tr" href="' + trUrl + '">',
        '<link rel="alternate" hreflang="x-default" href="' + enUrl + '">'
    ].join('\n    ');
    html = html.replace(/(<link rel="canonical" href="[^"]*">)/i, function (mm, a) { return a + '\n    ' + alts; });

    // 5) Make relative asset URLs root-absolute (CSS/JS/images/fonts) so they load
    //    from "/" under the /ru/ or /ka/ path. Page (.html) links stay relative,
    //    so in-language navigation correctly remains within /ru/ or /ka/.
    html = html.replace(
        /(\b(?:src|href)=")(?!https?:|\/\/|\/|#|mailto:|tel:|data:)([^"]+\.(?:js|css|png|jpe?g|webp|svg|gif|ico|woff2?|ttf)(?:\?[^"]*)?)(")/gi,
        '$1/$2$3'
    );

    // Prerendered SEO blocks use root-absolute links. Keep those in-language
    // when a real localized version exists (dynamic funnel page OR a static
    // translated file like he/tbilisi-airport-car-rental.html).
    html = html.replace(/href="\/([^"#?\/][^"#?]*\.html)([^"]*)"/g, function (m, p, suffix) {
        return hasLangVersion(lang, p)
            ? 'href="/' + lang + '/' + p + suffix + '"'
            : m;
    });
    // Relative page links resolve under /<lang>/ in the browser. That is right
    // when an in-language version exists, but 404s otherwise (e.g. /he/blog.html).
    // Normalize every relative link: in-language pages get an explicit
    // /<lang>/ URL; everything else goes root-absolute to the English page.
    html = html.replace(/href="(?!https?:|\/\/|\/|#|mailto:|tel:|data:|javascript:)([^":#?]+\.html)([^"]*)"/g, function (m, p, suffix) {
        return hasLangVersion(lang, p)
            ? 'href="/' + lang + '/' + p + suffix + '"'
            : 'href="/' + p + suffix + '"';
    });
    html = html.replace(/href="\/"/g, 'href="/' + lang + '/"');

    // 6) Seed the client language so i18n.js doesn't re-translate the page back.
    html = html.replace(/<head([^>]*)>/i,
        '<head$1>\n    <script>try{localStorage.setItem("EliteAuto_lang","' + lang + '");}catch(e){}</script>');

    return html;
}

async function renderSourceHtml(fileName) {
    if (fileName === 'index.html') return seoPrerender.renderHomePage();
    if (fileName === 'vehicles.html') return seoPrerender.renderVehiclesPage();
    if (fileName === 'reviews.html') return seoPrerender.renderReviewsPage();
    return fs.readFileSync(path.join(ROOT, fileName), 'utf8');
}

async function middleware(req, res, next) {
    try {
        var m = LANG_PATH_RE.exec(req.path);
        if (!m) return next();
        var lang = m[1];
        var page = (m[2] || '').replace(/\/+$/, ''); // trim trailing slash
        if (page === '' || page === 'index') page = '';            // → index.html
        var fileName = page === '' ? 'index.html' : page;
        if (LANGS.indexOf(lang) === -1) return next();
        if (fileName.indexOf('..') !== -1 || !/^[a-zA-Z0-9._-]+\.html$/.test(fileName)) return next();

        if (!Object.prototype.hasOwnProperty.call(LOCALIZABLE, page)) {
            // A static translated file (e.g. he/suv-rental-georgia.html) — let
            // express.static serve it as-is.
            if (staticLangFiles[lang] && staticLangFiles[lang].has(fileName)) return next();
            // No version of this page exists in this language. Historically these
            // URLs 404'd (Google logged 36 of them), because localized pages linked
            // to /<lang>/<page> for every page. Send visitors and crawlers to the
            // real English page instead of a dead end.
            if (fs.existsSync(path.join(ROOT, fileName))) {
                var target = '/' + (fileName === 'index.html' ? '' : fileName);
                var qs = req.originalUrl.indexOf('?');
                if (qs !== -1) target += req.originalUrl.slice(qs);
                return res.redirect(301, target);
            }
            return next();
        }

        if (!fs.existsSync(path.join(ROOT, fileName))) return next();

        var html = await renderSourceHtml(fileName);
        html = localize(html, lang, page, makeT(lang));

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(html);
    } catch (err) {
        console.error('[i18n-render] error:', err.message);
        next();
    }
}

module.exports = { middleware, LOCALIZABLE, LANGS };
