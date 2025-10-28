// =======================================
// 🚀 Minecraft Bedrock 24/7 Telegram Bot
// 🌐 يعمل على Replit (بدون Termux)
// =======================================

const TelegramBot = require('node-telegram-bot-api');
const bedrock = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

// 🪪 ضع التوكن هنا أو من Secrets في Replit
const TOKEN = process.env.BOT_TOKEN || '7638511217:AAG9jpRCOXO-VMuyNptqmFBOvUbV2oAWowA';

// 🛰️ القنوات المطلوبة للاشتراك الإجباري
const REQUIRED_CHANNELS = ['@vvujw', '@vcrtewFT'];

// 👑 معرف المطور (تقدر تجيبه من /start)
const OWNER_ID = 21301591; // غيّره إلى رقمك

// 📁 مجلد البيانات
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');

const load = (file, def = {}) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : def);
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

let users = load(USERS_FILE);
let servers = load(SERVERS_FILE);
let state = {};
let active = {};

const bot = new TelegramBot(TOKEN, { polling: true });

// 🎨 الرسالة الترحيبية
const WELCOME_PHOTO = "https://f.top4top.io/p_35873nogp0.jpg";
const WELCOME_TEXT = `
- ولك متكلي شكد منور {name} 😆،
- بوت بلاير يخلي سيرفرك مفتوح 24/7 🔥
- إذا عندك مشكلة بالبوت تراسلني @ZR_VB3 🕸
`;

// 🔘 الأزرار الرئيسية
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "➕ إضافة سيرفر", callback_data: "add_server" }],
      [{ text: "📜 قائمة سيرفراتي", callback_data: "my_servers" }],
      [
        { text: "❓ طريقة الاستخدام", callback_data: "how_to" },
        { text: "🧩 الدعم الفني", url: "https://t.me/ZR_VB3" }
      ]
    ]
  }
};

// 🔒 تحقق من الاشتراك الإجباري
async function checkSub(chatId) {
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const member = await bot.getChatMember(ch, chatId);
      if (!["member", "administrator", "creator"].includes(member.status)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// 🧹 تنظيف الاتصال
function cleanup(id) {
  if (active[id]) {
    try {
      active[id].client.disconnect();
    } catch {}
    clearTimeout(active[id].timer);
    delete active[id];
  }
}

// 🎮 الاتصال بالسيرفر
async function connectToServer(chatId, host, port) {
  const name = users[chatId]?.name || `AFK_${Math.floor(Math.random() * 999)}`;
  bot.sendMessage(chatId, `⏳ جاري الاتصال بـ \`${host}:${port}\`\nالاسم: *${name}*`, { parse_mode: "Markdown" });

  cleanup(chatId);
  const client = bedrock.createClient({ host, port, username: name, offline: true });

  const timer = setTimeout(() => {
    bot.sendMessage(chatId, `❌ انتهت مهلة الاتصال.`);
    cleanup(chatId);
  }, 20000);

  active[chatId] = { client, timer, host, port };

  client.on("spawn", () => {
    clearTimeout(timer);
    bot.sendMessage(chatId, `✅ تم الاتصال بنجاح! السيرفر شغال الآن 24/7 🟢`);
  });

  client.on("disconnect", () => {
    bot.sendMessage(chatId, `⚠️ تم قطع الاتصال من السيرفر.`);
    cleanup(chatId);
  });

  client.on("error", (err) => {
    bot.sendMessage(chatId, `❌ خطأ أثناء الاتصال:\n\`${err.message}\``, { parse_mode: "Markdown" });
    cleanup(chatId);
  });
}

// 📩 استقبال الرسائل
bot.on("message", async (msg) => {
  const id = msg.chat.id;
  const text = msg.text;

  if (!users[id]) users[id] = { id, name: msg.from.first_name };
  save(USERS_FILE, users);

  if (!(await checkSub(id))) {
    const chList = REQUIRED_CHANNELS.map(c => `📢 [${c}](https://t.me/${c.substring(1)})`).join("\n");
    return bot.sendMessage(id, `⚠️ يجب الاشتراك أولاً:\n${chList}`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "✅ تم الاشتراك", callback_data: "check_sub" }]] }
    });
  }

  if (text === "/start") {
    const welcome = WELCOME_TEXT.replace("{name}", msg.from.first_name || "صديقي");
    bot.sendPhoto(id, WELCOME_PHOTO, { caption: welcome, ...mainMenu });
  }

  if (state[id]?.step === "ip") {
    servers[id] = { host: text.trim() };
    state[id] = { step: "port" };
    return bot.sendMessage(id, "📡 أرسل البورت الآن (مثلاً 19132):");
  }

  if (state[id]?.step === "port") {
    const port = parseInt(text.trim());
    if (isNaN(port)) return bot.sendMessage(id, "❌ رقم البورت غير صالح!");
    servers[id].port = port;
    save(SERVERS_FILE, servers);
    state[id] = null;
    bot.sendMessage(id, `✅ تم حفظ السيرفر:\n\`${servers[id].host}:${port}\`\nجارٍ الاتصال...`, { parse_mode: "Markdown" });
    connectToServer(id, servers[id].host, port);
  }
});

// ⚙️ معالجة الأزرار
bot.on("callback_query", async (q) => {
  const id = q.message.chat.id;
  const data = q.data;

  if (data === "check_sub") {
    const ok = await checkSub(id);
    if (ok) return bot.sendPhoto(id, WELCOME_PHOTO, { caption: "✅ تم التحقق من الاشتراك بنجاح!", ...mainMenu });
    return bot.answerCallbackQuery(q.id, { text: "❌ لم تشترك بعد", show_alert: true });
  }

  if (data === "add_server") {
    state[id] = { step: "ip" };
    return bot.sendMessage(id, "🌍 أرسل IP السيرفر (مثلاً: example.aternos.me):");
  }

  if (data === "my_servers") {
    if (!servers[id]) return bot.sendMessage(id, "📭 لا يوجد سيرفرات محفوظة لديك بعد.");
    const { host, port } = servers[id];
    bot.sendMessage(id, `📡 سيرفرك الحالي:\n\`${host}:${port}\``, { parse_mode: "Markdown" });
  }

  if (data === "how_to") {
    bot.sendMessage(id, `📚 *طريقة إضافة سيرفر:*\n
1. اضغط على "➕ إضافة سيرفر"
2. أرسل IP السيرفر (مثال: example.aternos.me)
3. أرسل بورت السيرفر (مثال: 19132)
4. تأكد أن المكركة مفعلة في السيرفر

🔹 *ملاحظات:*
- يجب أن يكون السيرفر شغال عند إضافته
- الحد الأقصى سيرفر واحد لكل مستخدم

📌 *للمساعدة التقنية:* @Minecraft_VT`, { parse_mode: "Markdown" });
  }

  // 👑 لوحة المطور
  if (id === OWNER_ID) {
    if (data === "admin") {
      return bot.sendMessage(id, `👑 لوحة الإدارة:
- عدد المستخدمين: ${Object.keys(users).length}
- سيرفرات محفوظة: ${Object.keys(servers).length}`);
    }
  }
});

process.on("uncaughtException", (err) => console.log("❌", err));
bot.on("polling_error", (err) => console.log("⚠️ Polling Error:", err.message));
console.log("✨ بوت Minecraft Bedrock 24/7 يعمل الآن على Replit ✨");
