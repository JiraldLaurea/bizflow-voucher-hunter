/**
 * Customer landing page (`/client`) copy for every supported language.
 *
 * Separate from `marketing.ts` for the same reason that one is separate from
 * the mobile catalogue: this page is written for the person who downloads the
 * app, not the owner who buys the product. The two pages share a header, a
 * footer and a vocabulary, but the prose is aimed at opposite readers and
 * merging them would put the wrong tone one line away from the right one.
 *
 * The vocabulary IS shared, deliberately — a customer who reads the business
 * page and then this one should meet the same words for the same things:
 * Loyalty Points / LP, voucher, campaign, partner shops. If a term is changed
 * here, change it in `marketing.ts` and the mobile catalogue too.
 *
 * TRANSLATION STATUS — the ko/zh/ja strings have NOT been reviewed by a native
 * speaker, matching `marketing.ts` and the mobile catalogues. See docs/I18N.md.
 */

import { buildTranslator, type Language } from "./languages";

const en = {
  // -- Document metadata (the browser tab and link previews) --
  "meta.title": "Voucher Hunt for Customers",
  "meta.description":
    "Win vouchers, book an eligible time and collect Loyalty Points with the Voucher Hunt customer app.",

  // -- Navigation --
  "nav.sections": "Customer page",
  "nav.howItWorks": "How it works",
  "nav.insideApp": "Inside the app",
  "nav.lpShop": "LP Shop",
  "nav.loyalty": "Loyalty Points",
  "nav.forBusinesses": "For Businesses",

  // -- Hero --
  "hero.eyebrow": "The customer app",
  "hero.title": "Win it. Book it. Enjoy it.",
  "hero.lead":
    "Discover voucher campaigns from participating businesses, reserve the right time and keep every reward in one place.",
  "hero.storeButton": "Download on Google Play",
  // The button is not a link yet, so its accessible name has to carry the part
  // the note below it says visually.
  "hero.storeButtonLabel": "Download on Google Play — coming soon",
  "hero.storeNote": "Coming soon — button is disabled for now.",

  // -- How it works --
  "steps.eyebrow": "How it works",
  "steps.title": "One simple journey.",
  "steps.hunt.title": "Hunt",
  "steps.hunt.body":
    "Open a campaign from a participating business and reveal your voucher.",
  "steps.book.title": "Book",
  "steps.book.body":
    "Choose an available time when your winning voucher can be used.",
  "steps.earn.title": "Earn",
  "steps.earn.body":
    "Show your QR in store and earn Loyalty Points on eligible purchases.",

  // -- Inside the app --
  "preview.eyebrow": "Inside the app",
  "preview.title": "See the full journey.",
  "preview.lead":
    "From finding a campaign to showing the final QR, every step stays in one customer app.",
  "preview.discover.title": "Discover",
  "preview.discover.body":
    "Find active campaigns from participating businesses.",
  "preview.discover.alt":
    "Voucher Hunt app showing active campaigns from nearby businesses",
  "preview.book.title": "Book",
  "preview.book.body":
    "Reserve one of the times made available for your reward.",
  "preview.book.alt":
    "Voucher Hunt app showing available dates and time slots for a voucher",
  "preview.redeem.title": "Redeem",
  "preview.redeem.body":
    "Keep the voucher and redemption QR ready in the app.",
  "preview.redeem.alt":
    "Voucher Hunt app showing a won voucher and its redemption QR code",
  "preview.note": "Screens show a demo campaign.",

  // -- LP Shop --
  "shop.eyebrow": "LP Shop",
  "shop.title": "Turn Loyalty Points into something real.",
  "shop.lead":
    "Customers spend earned LP on items from participating partners, then collect their purchase in person with a verified code.",
  "shop.choose.title": "Choose an item",
  "shop.choose.body": "Browse products and see the LP price before buying.",
  "shop.collect.title": "Collect from the partner",
  "shop.collect.body": "The app keeps the purchase ready for collection.",
  "shop.verify.title": "Verify at handover",
  "shop.verify.body": "Partner staff scan the code and complete the order.",
  "shop.screenAlt":
    "Voucher Hunt LP Shop showing a points balance and participating partner products",
  "shop.caption": "Actual app screen · Demo data",

  // -- Loyalty Points --
  "loyalty.eyebrow": "Loyalty Points",
  "loyalty.title": "Every visit can lead to the next reward.",
  "loyalty.body":
    "Earn LP on eligible purchases, then use it for real items from participating partner shops.",

  // -- Footer --
  "footer.linksLabel": "Customer page links",
  "footer.privacy": "Privacy",
} as const;

export type ClientTranslationKey = keyof typeof en;

/** Every catalogue must carry every key — a missing one fails the build. */
type Catalogue = Record<ClientTranslationKey, string>;

const ko: Catalogue = {
  "meta.title": "고객을 위한 Voucher Hunt",
  "meta.description":
    "Voucher Hunt 고객용 앱에서 바우처를 받고, 사용 가능한 시간에 예약하고, 로열티 포인트를 모으세요.",

  "nav.sections": "페이지 섹션",
  "nav.howItWorks": "이용 방법",
  "nav.insideApp": "앱 미리보기",
  "nav.lpShop": "LP 상점",
  "nav.loyalty": "로열티 포인트",
  "nav.forBusinesses": "사업자용",

  "hero.eyebrow": "고객용 앱",
  "hero.title": "받고. 예약하고. 누리세요.",
  "hero.lead":
    "참여 매장의 바우처 캠페인을 둘러보고, 원하는 시간에 예약하고, 받은 혜택을 한곳에서 관리하세요.",
  "hero.storeButton": "Google Play에서 다운로드",
  "hero.storeButtonLabel": "Google Play에서 다운로드 — 출시 예정",
  "hero.storeNote": "곧 출시됩니다 — 지금은 버튼이 비활성화되어 있습니다.",

  "steps.eyebrow": "이용 방법",
  "steps.title": "이어지는 간단한 과정 하나.",
  "steps.hunt.title": "찾기",
  "steps.hunt.body": "참여 매장의 캠페인을 열고 바우처를 확인하세요.",
  "steps.book.title": "예약",
  "steps.book.body": "당첨된 바우처를 사용할 수 있는 시간을 선택하세요.",
  "steps.earn.title": "적립",
  "steps.earn.body":
    "매장에서 QR을 보여주고 대상 결제에 대해 로열티 포인트를 받으세요.",

  "preview.eyebrow": "앱 미리보기",
  "preview.title": "전체 과정을 살펴보세요.",
  "preview.lead":
    "캠페인을 찾는 것부터 마지막 QR을 보여주는 것까지, 모든 단계가 고객용 앱 하나에서 이루어집니다.",
  "preview.discover.title": "둘러보기",
  "preview.discover.body": "참여 매장의 진행 중인 캠페인을 찾아보세요.",
  "preview.discover.alt":
    "주변 매장의 진행 중인 캠페인을 보여주는 Voucher Hunt 앱 화면",
  "preview.book.title": "예약",
  "preview.book.body": "받은 혜택에 제공되는 시간 중 하나를 예약하세요.",
  "preview.book.alt":
    "바우처의 예약 가능한 날짜와 시간대를 보여주는 Voucher Hunt 앱 화면",
  "preview.redeem.title": "사용",
  "preview.redeem.body": "바우처와 사용 QR을 앱에서 바로 확인하세요.",
  "preview.redeem.alt":
    "당첨된 바우처와 사용 QR 코드를 보여주는 Voucher Hunt 앱 화면",
  "preview.note": "화면은 데모 캠페인입니다.",

  "shop.eyebrow": "LP 상점",
  "shop.title": "로열티 포인트를 진짜 상품으로.",
  "shop.lead":
    "모은 LP로 제휴 매장의 상품을 구매하고, 인증 코드로 직접 수령하세요.",
  "shop.choose.title": "상품 선택",
  "shop.choose.body": "상품을 둘러보고 구매 전에 LP 가격을 확인하세요.",
  "shop.collect.title": "제휴 매장에서 수령",
  "shop.collect.body": "앱이 구매한 상품을 수령 준비 상태로 보관합니다.",
  "shop.verify.title": "수령 시 확인",
  "shop.verify.body": "제휴 매장 직원이 코드를 스캔하고 주문을 완료합니다.",
  "shop.screenAlt":
    "포인트 잔액과 제휴 매장 상품을 보여주는 Voucher Hunt LP 상점 화면",
  "shop.caption": "실제 앱 화면 · 데모 데이터",

  "loyalty.eyebrow": "로열티 포인트",
  "loyalty.title": "방문할 때마다 다음 혜택에 가까워집니다.",
  "loyalty.body":
    "대상 결제로 LP를 모으고, 제휴 매장의 실제 상품에 사용하세요.",

  "footer.linksLabel": "고객 페이지 링크",
  "footer.privacy": "개인정보처리방침",
};

const zh: Catalogue = {
  "meta.title": "Voucher Hunt 顾客端",
  "meta.description":
    "在 Voucher Hunt 顾客端应用抽取优惠券、预约可用时段，并累积忠诚积分。",

  "nav.sections": "页面板块",
  "nav.howItWorks": "运作方式",
  "nav.insideApp": "应用一览",
  "nav.lpShop": "LP 商城",
  "nav.loyalty": "忠诚积分",
  "nav.forBusinesses": "商家入口",

  "hero.eyebrow": "顾客端应用",
  "hero.title": "抽到它。约上它。享受它。",
  "hero.lead":
    "发现参与商家的优惠券活动，预约合适的时段，把每一份奖励都收在一处。",
  "hero.storeButton": "在 Google Play 下载",
  "hero.storeButtonLabel": "在 Google Play 下载 — 敬请期待",
  "hero.storeNote": "即将上线 — 按钮暂时不可点击。",

  "steps.eyebrow": "运作方式",
  "steps.title": "一条简单的流程。",
  "steps.hunt.title": "抽取",
  "steps.hunt.body": "打开参与商家的活动页，揭晓您的优惠券。",
  "steps.book.title": "预约",
  "steps.book.body": "选择一个可以使用中奖优惠券的时段。",
  "steps.earn.title": "累积",
  "steps.earn.body": "到店出示二维码，符合条件的消费即可累积忠诚积分。",

  "preview.eyebrow": "应用一览",
  "preview.title": "完整流程，一次看清。",
  "preview.lead":
    "从找到活动到出示最后的二维码，每一步都在同一个顾客端应用里完成。",
  "preview.discover.title": "发现",
  "preview.discover.body": "找到参与商家正在进行的活动。",
  "preview.discover.alt": "Voucher Hunt 应用展示附近商家正在进行的活动",
  "preview.book.title": "预约",
  "preview.book.body": "在为您的奖励开放的时段中预约一个。",
  "preview.book.alt": "Voucher Hunt 应用展示优惠券可预约的日期与时段",
  "preview.redeem.title": "核销",
  "preview.redeem.body": "优惠券和核销二维码随时在应用中备好。",
  "preview.redeem.alt": "Voucher Hunt 应用展示已中奖的优惠券及其核销二维码",
  "preview.note": "画面为演示活动。",

  "shop.eyebrow": "LP 商城",
  "shop.title": "把忠诚积分换成实实在在的东西。",
  "shop.lead":
    "顾客用累积的 LP 兑换合作商铺的商品，再凭验证码到店当面领取。",
  "shop.choose.title": "挑选商品",
  "shop.choose.body": "浏览商品，购买前先看清 LP 价格。",
  "shop.collect.title": "到合作商铺领取",
  "shop.collect.body": "应用会为您保留待领取的订单。",
  "shop.verify.title": "交付时验证",
  "shop.verify.body": "合作商铺店员扫描代码并完成订单。",
  "shop.screenAlt": "Voucher Hunt LP 商城展示积分余额与合作商铺商品",
  "shop.caption": "真实应用画面 · 演示数据",

  "loyalty.eyebrow": "忠诚积分",
  "loyalty.title": "每一次到店，都可能通向下一份奖励。",
  "loyalty.body":
    "符合条件的消费可累积 LP，再用它兑换合作商铺的实物商品。",

  "footer.linksLabel": "顾客页面链接",
  "footer.privacy": "隐私政策",
};

const ja: Catalogue = {
  "meta.title": "Voucher Hunt お客様向け",
  "meta.description":
    "Voucher Hunt のお客様用アプリで、バウチャーを当て、利用できる時間を予約し、ロイヤルティポイントを貯めましょう。",

  "nav.sections": "ページ内セクション",
  "nav.howItWorks": "ご利用の流れ",
  "nav.insideApp": "アプリの中身",
  "nav.lpShop": "LP ショップ",
  "nav.loyalty": "ロイヤルティポイント",
  "nav.forBusinesses": "事業者の方へ",

  "hero.eyebrow": "お客様用アプリ",
  "hero.title": "当てる。予約する。楽しむ。",
  "hero.lead":
    "参加店舗のバウチャーキャンペーンを見つけ、ちょうどいい時間を予約し、特典をひとつの場所にまとめておけます。",
  "hero.storeButton": "Google Play で入手",
  "hero.storeButtonLabel": "Google Play で入手 — 近日公開",
  "hero.storeNote": "近日公開 — 現在ボタンは無効です。",

  "steps.eyebrow": "ご利用の流れ",
  "steps.title": "流れはひとつだけ。",
  "steps.hunt.title": "当てる",
  "steps.hunt.body":
    "参加店舗のキャンペーンを開いて、バウチャーを引き当てます。",
  "steps.book.title": "予約する",
  "steps.book.body": "当たったバウチャーを使える時間を選びます。",
  "steps.earn.title": "貯める",
  "steps.earn.body":
    "店頭でQRを見せると、対象のお会計でロイヤルティポイントが貯まります。",

  "preview.eyebrow": "アプリの中身",
  "preview.title": "流れをひと通りご覧ください。",
  "preview.lead":
    "キャンペーンを見つけてから最後のQRを見せるまで、すべてがお客様用アプリひとつで完結します。",
  "preview.discover.title": "さがす",
  "preview.discover.body": "参加店舗の開催中キャンペーンを見つけます。",
  "preview.discover.alt":
    "近くの店舗の開催中キャンペーンを表示している Voucher Hunt アプリの画面",
  "preview.book.title": "予約する",
  "preview.book.body": "特典に用意された時間のひとつを予約します。",
  "preview.book.alt":
    "バウチャーの予約可能な日付と時間枠を表示している Voucher Hunt アプリの画面",
  "preview.redeem.title": "使う",
  "preview.redeem.body":
    "バウチャーと利用用のQRは、アプリにいつでも用意されています。",
  "preview.redeem.alt":
    "当たったバウチャーと利用用のQRコードを表示している Voucher Hunt アプリの画面",
  "preview.note": "画面はデモ用キャンペーンです。",

  "shop.eyebrow": "LP ショップ",
  "shop.title": "ロイヤルティポイントを、実際の商品に。",
  "shop.lead":
    "貯めた LP で提携店舗の商品を購入し、確認コードを提示して店頭で受け取ります。",
  "shop.choose.title": "商品を選ぶ",
  "shop.choose.body": "商品を見て、購入前に LP の価格を確認できます。",
  "shop.collect.title": "提携店舗で受け取る",
  "shop.collect.body":
    "購入した商品は、受け取り待ちの状態でアプリに残ります。",
  "shop.verify.title": "受け渡し時に確認",
  "shop.verify.body":
    "提携店舗のスタッフがコードを読み取り、注文が完了します。",
  "shop.screenAlt":
    "ポイント残高と提携店舗の商品を表示している Voucher Hunt LP ショップの画面",
  "shop.caption": "実際のアプリ画面 · デモデータ",

  "loyalty.eyebrow": "ロイヤルティポイント",
  "loyalty.title": "一度の来店が、次の特典につながります。",
  "loyalty.body":
    "対象のお会計で LP が貯まり、提携店舗の実際の商品に使えます。",

  "footer.linksLabel": "お客様ページのリンク",
  "footer.privacy": "プライバシー",
};

const catalogues: Record<Language, Catalogue> = { en, ko, zh, ja };

export type ClientTranslate = (key: ClientTranslationKey) => string;

/** The customer landing page's lookup for one language. */
export function clientTranslator(language: Language): ClientTranslate {
  return buildTranslator(catalogues, language);
}
