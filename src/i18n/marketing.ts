/**
 * Business landing page (`/`) copy for every supported language.
 *
 * Deliberately a separate catalogue from `apps/mobile/src/i18n/translations.ts`
 * and from `client.ts`: this one is marketing prose aimed at business owners,
 * those are the customer app's UI and the customer landing page. All three
 * share the language set and the fallback rule (`languages.ts`) but almost no
 * strings, and merging them would make each harder to review.
 *
 * English is the source of truth and the fallback — `translator()` returns the
 * English string for any key a catalogue is missing, so a gap reads as
 * untranslated rather than as a raw key or a blank.
 *
 * TRANSLATION STATUS — the ko/zh/ja strings have NOT been reviewed by a native
 * speaker, matching the mobile catalogues. The product vocabulary carries
 * meaning a translator should confirm before a public launch: "voucher" is a
 * promotional discount rather than a gift certificate, "Loyalty Points" is a
 * program unit and never money, and "hunt" is deliberately playful without
 * being gambling vocabulary. See docs/I18N.md.
 */

import { buildTranslator, type Language } from "./languages";

const en = {
  // -- Document metadata (the browser tab and link previews) --
  "meta.title": "Voucher Hunt — fill quiet hours and build loyalty",
  "meta.description":
    "Customers win a voucher, book a time you choose and earn Loyalty Points they can spend with participating partner shops.",

  // -- Navigation --
  "nav.sections": "Page sections",
  "nav.howItWorks": "How it works",
  "nav.loyalty": "Loyalty Points",
  "nav.dashboard": "Dashboard",
  "nav.capabilities": "What you get",
  "nav.demo": "Demo",
  "nav.forClients": "For Clients",
  "nav.businessLogin": "Business log in",
  "nav.talkToUs": "Talk to us",

  // -- Language selector --
  "language.label": "Language",

  // -- Hero --
  "hero.eyebrow": "For business owners",
  "hero.title": "Fill quiet hours. Bring customers back.",
  "hero.lead":
    "Customers win a voucher, book a time you choose and earn Loyalty Points when they spend — turning one promotion into the next visit.",
  "hero.note":
    "No card, no contract to read. Tell us what you sell and we will set up the first campaign with you.",

  // -- The problem with a coupon --
  "problem.eyebrow": "The problem with a coupon",
  "problem.title": "Three things a discount code cannot tell you.",
  "problem.when.lead": "When they will come.",
  "problem.when.body":
    "A code is valid for a month, so it gets used on your busiest evening — the one that did not need help.",
  "problem.many.lead": "How many will come.",
  "problem.many.body":
    "There is no cap on a shared code, and no way to stop it spreading past the audience you meant it for.",
  "problem.worked.lead": "Whether it worked.",
  "problem.worked.body":
    "Redemptions live in your POS, the promotion lives somewhere else, and nobody joins them up afterwards.",

  // -- How it works --
  "how.eyebrow": "How it works",
  "how.title": "Set it up once, run it every week.",
  "how.lead":
    "We handle the business setup. You control the offer, timing and capacity.",
  "how.step1.title": "An admin sets up your business",
  "how.step1.body":
    "Voucher Hunt creates your business account and first campaign. Your team starts with the right venue already assigned.",
  "how.step2.title": "You choose the prizes and times",
  "how.step2.body":
    "Set what customers can win, when each prize can be booked and how many guests you can serve.",
  "how.step3.title": "Staff scan at the counter",
  "how.step3.body":
    "Your team scans the customer's QR, confirms the purchase and completes the visit from any phone.",
  "how.journeyLabel": "What your customer does",
  "how.journey1": "Open a campaign",
  "how.journey2": "Spin for a voucher",
  "how.journey3": "Book an available time",
  "how.journey4": "Show the QR in store",

  // -- Loyalty Points --
  "loyalty.eyebrow": "Loyalty Points",
  "loyalty.title": "The next visit starts at checkout.",
  "loyalty.lead":
    "Voucher Hunt turns eligible spend into LP customers can use for real items across participating partner shops.",
  "loyalty.earn.title": "Earn",
  "loyalty.earn.body":
    "Staff record an eligible purchase and 5% comes back to the customer as LP.",
  "loyalty.shop.title": "Shop",
  "loyalty.shop.body":
    "Customers spend LP on real items from participating partner shops.",
  "loyalty.collect.title": "Collect",
  "loyalty.collect.body":
    "A collection QR tells staff exactly which item to hand over and records the redemption.",
  "loyalty.note":
    "Opening the app and successful referrals can add bonus LP too. For partners, LP issued and redeemed is reconciled in one monthly record.",

  // -- What you get --
  "capabilities.eyebrow": "What you get",
  "capabilities.title": "The essentials, handled.",
  "capabilities.lead":
    "Simple controls for every campaign, booking and redemption.",
  "capabilities.capacity.title": "Real capacity",
  "capabilities.capacity.body": "Each booking window closes when it fills.",
  "capabilities.prizes.title": "Weighted prizes",
  "capabilities.prizes.body": "Control how often every prize is won.",
  "capabilities.redemption.title": "Verified redemption",
  "capabilities.redemption.body": "Scan, reschedule or mark a no-show.",
  "capabilities.numbers.title": "Verified numbers",
  "capabilities.numbers.body":
    "SMS sign-in keeps entries tied to real phones.",
  "capabilities.referrals.title": "Referrals",
  "capabilities.referrals.body":
    "Sharing can unlock another spin and bonus LP.",
  "capabilities.reporting.title": "Clear reporting",
  "capabilities.reporting.body":
    "See bookings, redemptions and LP activity in one place.",

  // -- Dashboard --
  "dashboard.eyebrow": "Your dashboard",
  "dashboard.title": "See the whole campaign at a glance.",
  "dashboard.body":
    "Manage campaigns and time slots, track bookings and redemptions, and follow Loyalty Points activity from one workspace.",
  "dashboard.item1": "Campaign and capacity controls",
  "dashboard.item2": "Booking and redemption metrics",
  "dashboard.item3": "Loyalty Points and billing",

  // -- Demo campaigns --
  "demo.eyebrow": "Demo campaigns",
  "demo.title": "See how a campaign can look.",
  "demo.lead": "Sample campaigns shown for demonstration only.",

  // -- Closing call to action --
  "closer.title": "Want to see it on your own menu?",
  "closer.body":
    "Send us what you sell and roughly when you are quiet. We will come back with a campaign shaped around it.",

  // -- Shopper strip --
  "shopper.eyebrow": "For clients",
  "shopper.copy":
    "Hunt for vouchers, book your visit and collect Loyalty Points in the customer app.",

  // -- Footer --
  "footer.legalLabel": "Legal and contact",
  "footer.privacy": "Privacy",
  "footer.deleteAccount": "Delete your account",
} as const;

export type TranslationKey = keyof typeof en;

/**
 * Every catalogue must carry every key — a missing one fails the build, the
 * same rule the mobile catalogues use. The fallback in `translator()` is the
 * runtime backstop for a string that somehow slips through as empty, not a
 * licence to leave keys out.
 */
type Catalogue = Record<TranslationKey, string>;

const ko: Catalogue = {
  "meta.title": "Voucher Hunt — 한산한 시간을 채우고 단골을 만드세요",
  "meta.description":
    "고객이 바우처에 당첨되고, 사장님이 정한 시간에 예약하고, 제휴 매장에서 사용할 수 있는 로열티 포인트를 받습니다.",

  "nav.sections": "페이지 섹션",
  "nav.howItWorks": "이용 방법",
  "nav.loyalty": "로열티 포인트",
  "nav.dashboard": "대시보드",
  "nav.capabilities": "제공 기능",
  "nav.demo": "데모",
  "nav.forClients": "고객용",
  "nav.businessLogin": "비즈니스 로그인",
  "nav.talkToUs": "문의하기",

  "language.label": "언어",

  "hero.eyebrow": "사업주를 위한 서비스",
  "hero.title": "한산한 시간을 채우고, 고객을 다시 오게 하세요.",
  "hero.lead":
    "고객이 바우처에 당첨되고, 사장님이 정한 시간에 예약하고, 결제하면 로열티 포인트를 받습니다 — 한 번의 프로모션이 다음 방문으로 이어집니다.",
  "hero.note":
    "카드 등록도, 읽어야 할 계약서도 없습니다. 어떤 상품을 파는지 알려주시면 첫 캠페인을 함께 만들어 드립니다.",

  "problem.eyebrow": "할인 쿠폰의 한계",
  "problem.title": "할인 코드가 알려주지 못하는 세 가지.",
  "problem.when.lead": "언제 올지 모릅니다.",
  "problem.when.body":
    "코드는 한 달 내내 유효하기 때문에, 도움이 필요 없던 가장 바쁜 저녁에 사용됩니다.",
  "problem.many.lead": "몇 명이 올지 모릅니다.",
  "problem.many.body":
    "공유된 코드에는 인원 제한이 없고, 의도한 대상을 넘어 퍼지는 것을 막을 방법도 없습니다.",
  "problem.worked.lead": "효과가 있었는지 모릅니다.",
  "problem.worked.body":
    "사용 내역은 POS에, 프로모션은 다른 곳에 남고, 그 둘을 나중에 연결해 보는 사람은 없습니다.",

  "how.eyebrow": "이용 방법",
  "how.title": "한 번 설정하고, 매주 운영하세요.",
  "how.lead":
    "비즈니스 설정은 저희가 처리합니다. 혜택과 시간, 수용 인원은 사장님이 정합니다.",
  "how.step1.title": "관리자가 매장을 설정합니다",
  "how.step1.body":
    "Voucher Hunt가 비즈니스 계정과 첫 캠페인을 만들어 드립니다. 매장이 이미 배정된 상태로 시작합니다.",
  "how.step2.title": "혜택과 시간을 정합니다",
  "how.step2.body":
    "고객이 무엇에 당첨될 수 있는지, 각 혜택을 언제 예약할 수 있는지, 몇 명까지 받을 수 있는지 설정합니다.",
  "how.step3.title": "직원이 카운터에서 스캔합니다",
  "how.step3.body":
    "직원이 고객의 QR을 스캔하고 구매를 확인한 뒤, 어떤 휴대폰으로든 방문을 완료 처리합니다.",
  "how.journeyLabel": "고객이 하는 일",
  "how.journey1": "캠페인 열기",
  "how.journey2": "바우처 돌리기",
  "how.journey3": "가능한 시간 예약",
  "how.journey4": "매장에서 QR 제시",

  "loyalty.eyebrow": "로열티 포인트",
  "loyalty.title": "다음 방문은 결제 순간에 시작됩니다.",
  "loyalty.lead":
    "Voucher Hunt는 적립 대상 결제를 LP로 바꿔, 고객이 제휴 매장에서 실제 상품으로 사용할 수 있게 합니다.",
  "loyalty.earn.title": "적립",
  "loyalty.earn.body":
    "직원이 적립 대상 구매를 기록하면 5%가 LP로 고객에게 돌아갑니다.",
  "loyalty.shop.title": "사용",
  "loyalty.shop.body":
    "고객은 제휴 매장의 실제 상품에 LP를 사용합니다.",
  "loyalty.collect.title": "수령",
  "loyalty.collect.body":
    "수령용 QR이 어떤 상품을 건네야 하는지 직원에게 정확히 알려주고, 사용 내역을 기록합니다.",
  "loyalty.note":
    "앱 실행과 친구 초대 성공으로도 보너스 LP가 쌓입니다. 제휴사에는 발행·사용된 LP가 월 단위 정산 내역 하나로 정리됩니다.",

  "capabilities.eyebrow": "제공 기능",
  "capabilities.title": "필요한 것은 모두 준비되어 있습니다.",
  "capabilities.lead":
    "모든 캠페인, 예약, 사용을 위한 간단한 관리 기능.",
  "capabilities.capacity.title": "실제 수용 인원",
  "capabilities.capacity.body": "예약 시간대는 정원이 차면 마감됩니다.",
  "capabilities.prizes.title": "확률 조정",
  "capabilities.prizes.body": "각 혜택의 당첨 빈도를 직접 정합니다.",
  "capabilities.redemption.title": "검증된 사용 처리",
  "capabilities.redemption.body": "스캔, 일정 변경, 노쇼 처리까지.",
  "capabilities.numbers.title": "검증된 번호",
  "capabilities.numbers.body":
    "SMS 로그인으로 참여가 실제 휴대폰에 연결됩니다.",
  "capabilities.referrals.title": "친구 초대",
  "capabilities.referrals.body":
    "공유하면 한 번 더 돌릴 기회와 보너스 LP를 받을 수 있습니다.",
  "capabilities.reporting.title": "명확한 리포트",
  "capabilities.reporting.body":
    "예약, 사용, LP 활동을 한 곳에서 확인합니다.",

  "dashboard.eyebrow": "대시보드",
  "dashboard.title": "캠페인 전체를 한눈에.",
  "dashboard.body":
    "캠페인과 시간대를 관리하고, 예약과 사용을 추적하고, 로열티 포인트 활동을 하나의 작업 공간에서 확인하세요.",
  "dashboard.item1": "캠페인 및 수용 인원 관리",
  "dashboard.item2": "예약 및 사용 지표",
  "dashboard.item3": "로열티 포인트 및 정산",

  "demo.eyebrow": "데모 캠페인",
  "demo.title": "캠페인이 어떤 모습인지 확인하세요.",
  "demo.lead": "예시로 제공되는 샘플 캠페인입니다.",

  "closer.title": "우리 매장에 적용된 모습이 궁금하신가요?",
  "closer.body":
    "어떤 상품을 파는지, 대략 언제가 한산한지 알려주세요. 그에 맞춘 캠페인을 제안해 드립니다.",

  "shopper.eyebrow": "고객용",
  "shopper.copy":
    "고객용 앱에서 바우처를 찾고, 방문을 예약하고, 로열티 포인트를 모으세요.",

  "footer.legalLabel": "약관 및 문의",
  "footer.privacy": "개인정보처리방침",
  "footer.deleteAccount": "계정 삭제",
};

const zh: Catalogue = {
  "meta.title": "Voucher Hunt — 填满冷清时段，积累回头客",
  "meta.description":
    "顾客抽中优惠券，在您指定的时段预约，并获得可在合作商铺使用的忠诚积分。",

  "nav.sections": "页面板块",
  "nav.howItWorks": "运作方式",
  "nav.loyalty": "忠诚积分",
  "nav.dashboard": "管理后台",
  "nav.capabilities": "功能一览",
  "nav.demo": "演示",
  "nav.forClients": "顾客入口",
  "nav.businessLogin": "商家登录",
  "nav.talkToUs": "联系我们",

  "language.label": "语言",

  "hero.eyebrow": "为商家打造",
  "hero.title": "填满冷清时段，让顾客再次光临。",
  "hero.lead":
    "顾客抽中优惠券，在您指定的时段预约，消费后获得忠诚积分——让一次促销带来下一次到店。",
  "hero.note":
    "无需绑卡，没有冗长合同。告诉我们您经营什么，我们和您一起搭建第一个活动。",

  "problem.eyebrow": "优惠码的局限",
  "problem.title": "折扣码无法告诉您的三件事。",
  "problem.when.lead": "顾客何时到店。",
  "problem.when.body":
    "优惠码一个月内都有效，结果往往用在本就最忙、根本不需要促销的那个晚上。",
  "problem.many.lead": "会来多少人。",
  "problem.many.body":
    "被转发的优惠码没有人数上限，也无法阻止它扩散到您预期之外的人群。",
  "problem.worked.lead": "效果究竟如何。",
  "problem.worked.body":
    "核销记录留在收银系统，促销活动记在别处，事后没有人把两者对上。",

  "how.eyebrow": "运作方式",
  "how.title": "设置一次，每周都能用。",
  "how.lead": "商家设置由我们完成。优惠、时段与接待量由您掌控。",
  "how.step1.title": "管理员为您完成开通",
  "how.step1.body":
    "Voucher Hunt 为您创建商家账户和第一个活动。您的团队一开始就已分配好对应门店。",
  "how.step2.title": "您来决定奖品与时段",
  "how.step2.body":
    "设置顾客可以抽中什么、每种奖品可预约的时间，以及您能接待多少客人。",
  "how.step3.title": "店员在前台扫码",
  "how.step3.body":
    "店员扫描顾客的二维码，确认消费，用任意一部手机完成本次到店核销。",
  "how.journeyLabel": "顾客的操作流程",
  "how.journey1": "打开活动页",
  "how.journey2": "抽取优惠券",
  "how.journey3": "预约可用时段",
  "how.journey4": "到店出示二维码",

  "loyalty.eyebrow": "忠诚积分",
  "loyalty.title": "下一次到店，从结账那一刻开始。",
  "loyalty.lead":
    "Voucher Hunt 将符合条件的消费转化为 LP，顾客可在参与合作的商铺兑换实物商品。",
  "loyalty.earn.title": "累积",
  "loyalty.earn.body":
    "店员记录一笔符合条件的消费，其中 5% 以 LP 形式返还给顾客。",
  "loyalty.shop.title": "使用",
  "loyalty.shop.body": "顾客用 LP 在合作商铺兑换实物商品。",
  "loyalty.collect.title": "领取",
  "loyalty.collect.body":
    "领取二维码告诉店员应当交付哪件商品，并同时记录该次兑换。",
  "loyalty.note":
    "打开应用和成功邀请好友也能获得额外 LP。对合作方而言，已发放与已核销的 LP 会汇总在每月一份对账记录中。",

  "capabilities.eyebrow": "功能一览",
  "capabilities.title": "该有的，都替您想好了。",
  "capabilities.lead": "面向每个活动、预约与核销的简单管理工具。",
  "capabilities.capacity.title": "真实接待量",
  "capabilities.capacity.body": "每个预约时段约满即自动关闭。",
  "capabilities.prizes.title": "中奖概率可调",
  "capabilities.prizes.body": "自行控制每种奖品被抽中的频率。",
  "capabilities.redemption.title": "可验证的核销",
  "capabilities.redemption.body": "扫码核销、改期，或标记未到店。",
  "capabilities.numbers.title": "真实号码验证",
  "capabilities.numbers.body": "短信登录确保每次参与都绑定真实手机号。",
  "capabilities.referrals.title": "好友邀请",
  "capabilities.referrals.body": "分享可解锁再抽一次的机会和额外 LP。",
  "capabilities.reporting.title": "清晰的报表",
  "capabilities.reporting.body": "预约、核销与 LP 活动，一处尽览。",

  "dashboard.eyebrow": "管理后台",
  "dashboard.title": "整个活动，一目了然。",
  "dashboard.body":
    "在一个工作台中管理活动与时段、追踪预约与核销，并掌握忠诚积分动态。",
  "dashboard.item1": "活动与接待量管理",
  "dashboard.item2": "预约与核销数据",
  "dashboard.item3": "忠诚积分与结算",

  "demo.eyebrow": "演示活动",
  "demo.title": "看看一个活动可以是什么样子。",
  "demo.lead": "此处展示的活动仅供演示。",

  "closer.title": "想看看它用在您的门店上是什么样？",
  "closer.body":
    "告诉我们您经营什么、大致哪些时段较冷清，我们会带着为您量身设计的活动方案回来。",

  "shopper.eyebrow": "顾客入口",
  "shopper.copy": "在顾客端应用中抽取优惠券、预约到店并累积忠诚积分。",

  "footer.legalLabel": "条款与联系方式",
  "footer.privacy": "隐私政策",
  "footer.deleteAccount": "删除您的账户",
};

const ja: Catalogue = {
  "meta.title": "Voucher Hunt — 空いている時間を埋め、常連を増やす",
  "meta.description":
    "お客様がバウチャーを当て、お店が決めた時間に予約し、提携店舗で使えるロイヤルティポイントを獲得します。",

  "nav.sections": "ページ内セクション",
  "nav.howItWorks": "ご利用の流れ",
  "nav.loyalty": "ロイヤルティポイント",
  "nav.dashboard": "ダッシュボード",
  "nav.capabilities": "できること",
  "nav.demo": "デモ",
  "nav.forClients": "お客様向け",
  "nav.businessLogin": "ビジネスログイン",
  "nav.talkToUs": "お問い合わせ",

  "language.label": "言語",

  "hero.eyebrow": "事業者の方へ",
  "hero.title": "空いている時間を埋め、お客様をもう一度呼び戻す。",
  "hero.lead":
    "お客様がバウチャーを当て、お店が決めた時間に予約し、お会計でロイヤルティポイントが貯まる — 一度の販促が次の来店につながります。",
  "hero.note":
    "カード登録も、読み込む契約書もありません。何を扱っているか教えていただければ、最初のキャンペーンを一緒に設計します。",

  "problem.eyebrow": "クーポンの限界",
  "problem.title": "割引コードでは分からない3つのこと。",
  "problem.when.lead": "いつ来るのか。",
  "problem.when.body":
    "コードは1か月間有効なので、結局いちばん混んでいる — 販促の必要がなかった — 夜に使われます。",
  "problem.many.lead": "何人来るのか。",
  "problem.many.body":
    "共有されたコードに人数の上限はなく、想定した相手を越えて広がるのを止める手段もありません。",
  "problem.worked.lead": "効果があったのか。",
  "problem.worked.body":
    "利用実績はPOSに、販促の記録は別の場所に残り、後から突き合わせる人はいません。",

  "how.eyebrow": "ご利用の流れ",
  "how.title": "一度設定すれば、毎週運用できます。",
  "how.lead":
    "初期設定は当社が行います。特典・時間帯・受け入れ人数はお店が決めます。",
  "how.step1.title": "管理者がお店を開設します",
  "how.step1.body":
    "Voucher Hunt がビジネスアカウントと最初のキャンペーンを作成します。担当店舗が割り当てられた状態で始められます。",
  "how.step2.title": "特典と時間帯を決めます",
  "how.step2.body":
    "お客様が当てられる内容、各特典を予約できる時間、受け入れ可能な人数を設定します。",
  "how.step3.title": "スタッフがレジで読み取ります",
  "how.step3.body":
    "スタッフがお客様のQRを読み取り、購入を確認し、どの端末からでも来店を完了処理できます。",
  "how.journeyLabel": "お客様の操作",
  "how.journey1": "キャンペーンを開く",
  "how.journey2": "バウチャーを回す",
  "how.journey3": "空いている時間を予約",
  "how.journey4": "店頭でQRを提示",

  "loyalty.eyebrow": "ロイヤルティポイント",
  "loyalty.title": "次の来店は、お会計から始まります。",
  "loyalty.lead":
    "Voucher Hunt は対象となる支払いを LP に変え、提携店舗で実際の商品と交換できるようにします。",
  "loyalty.earn.title": "貯める",
  "loyalty.earn.body":
    "スタッフが対象の購入を記録すると、5% が LP としてお客様に還元されます。",
  "loyalty.shop.title": "使う",
  "loyalty.shop.body": "お客様は提携店舗の実際の商品に LP を使えます。",
  "loyalty.collect.title": "受け取る",
  "loyalty.collect.body":
    "受け取り用QRが、どの商品を渡すべきかをスタッフに正確に伝え、交換を記録します。",
  "loyalty.note":
    "アプリの起動や友だち紹介の成立でもボーナス LP が貯まります。提携先には、発行・利用された LP が月次の記録一つにまとめられます。",

  "capabilities.eyebrow": "できること",
  "capabilities.title": "必要なものは、ひと通り揃っています。",
  "capabilities.lead":
    "すべてのキャンペーン・予約・利用をシンプルに管理できます。",
  "capabilities.capacity.title": "実際の受け入れ人数",
  "capabilities.capacity.body": "予約枠は満席になった時点で締め切られます。",
  "capabilities.prizes.title": "当選確率の調整",
  "capabilities.prizes.body": "それぞれの特典が当たる頻度を設定できます。",
  "capabilities.redemption.title": "確実な利用処理",
  "capabilities.redemption.body": "読み取り、日程変更、無断キャンセルの記録。",
  "capabilities.numbers.title": "本人確認済みの番号",
  "capabilities.numbers.body":
    "SMSログインにより、応募が実在の携帯番号に紐づきます。",
  "capabilities.referrals.title": "友だち紹介",
  "capabilities.referrals.body":
    "シェアすると、もう一度回す権利とボーナス LP が得られます。",
  "capabilities.reporting.title": "分かりやすいレポート",
  "capabilities.reporting.body":
    "予約・利用・LP の動きを一か所で確認できます。",

  "dashboard.eyebrow": "ダッシュボード",
  "dashboard.title": "キャンペーン全体を一目で。",
  "dashboard.body":
    "キャンペーンと時間枠を管理し、予約と利用を追跡し、ロイヤルティポイントの動きを一つの画面で把握できます。",
  "dashboard.item1": "キャンペーンと受け入れ人数の管理",
  "dashboard.item2": "予約・利用の指標",
  "dashboard.item3": "ロイヤルティポイントと精算",

  "demo.eyebrow": "デモキャンペーン",
  "demo.title": "キャンペーンの見え方をご覧ください。",
  "demo.lead": "掲載しているのはデモ用のサンプルキャンペーンです。",

  "closer.title": "ご自身のお店で試したらどうなるか、見てみませんか。",
  "closer.body":
    "扱っている商品と、だいたい空いている時間帯をお知らせください。それに合わせたキャンペーンをご提案します。",

  "shopper.eyebrow": "お客様向け",
  "shopper.copy":
    "お客様用アプリで、バウチャーを探し、来店を予約し、ロイヤルティポイントを貯められます。",

  "footer.legalLabel": "規約とお問い合わせ",
  "footer.privacy": "プライバシー",
  "footer.deleteAccount": "アカウントを削除",
};

const catalogues: Record<Language, Catalogue> = { en, ko, zh, ja };

export type Translate = (key: TranslationKey) => string;

/** The business landing page's lookup for one language. */
export function translator(language: Language): Translate {
  return buildTranslator(catalogues, language);
}
