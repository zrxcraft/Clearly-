// =======================================
// 🚀 Minecraft Bedrock 24/7 Telegram Bot
// ✨ نسخة Termux (خفيفة وسريعة)
// =======================================

const TelegramBot = require('node-telegram-bot-api');
const bedrock = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

// 🔑 غيّر هذا التوكن بتوكن بوتك من @BotFather
const TOKEN = '7638511217:AAEe1OAZBSqC2MkSJc-9Dv7wr34kzfiFUaI';

// 🛰️ القنوات المطلوبة للاشتراك الإجباري (اختياري)
const REQUIRED_CHANNELS = ['@vvujw', '@mincraftt_313'];

// ⚙️ إنشاء ملفات البيانات
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');

// 🔹 تحميل / حفظ البيانات
const load = (file, def = {}) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : def);
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

let users = load(USERS_FILE);
let servers = load(SERVERS_FILE);
let active = {};
let state = {};
let fakeNames = {};

// 🤖 إنشاء البوت
const bot = new TelegramBot(TOKEN, { polling: true });

// 🎨 رموز
const ICON = {
  START: '🚀',
  STOP: '🔌',
  INFO: 'ℹ️',
  HELP: '❓',
  SUPPORT: '📞',
  EDIT: '✏️',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  WAIT: '⏳'
};

// 🔘 لوحة المفاتيح
const mainKeys = {
  reply_markup: {
    keyboard: [
      [`${ICON.START} تشغيل`, `${ICON.STOP} إيقاف`],
      [`${ICON.INFO} معلوماتي`, `${ICON.EDIT} تغيير الاسم`],
      [`${ICON.HELP} المساعدة`, `${ICON.SUPPORT} الدعم الفني`]
    ],
    resize_keyboard: true
  }
};

// 🔒 تحقق من الاشتراك
async function checkSub(chatId) {
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const member = await bot.getChatMember(ch, chatId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// 🧹 تنظيف الاتصال
function cleanup(id) {
  if (active[id]) {
    const { client, timer } = active[id];
    clearTimeout(timer);
    client.removeAllListeners();
    try { client.disconnect(); } catch {}
    delete active[id];
  }
}

// 🧠 استقبال الرسائل
bot.on('message', async (msg) => {
  const id = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  const user = msg.from.username ? `@${msg.from.username}` : 'مجهول';
  if (!users[id]) users[id] = { id, name: user };
  save(USERS_FILE, users);

  // التحقق من الاشتراك
  if (!(await checkSub(id))) {
    const chList = REQUIRED_CHANNELS.map(c => `📢 [${c}](https://t.me/${c.substring(1)})`).join('\n');
    return bot.sendMessage(id, `${ICON.WARNING} يجب الاشتراك أولاً:\n${chList}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '✅ تم الاشتراك', callback_data: 'check' }]] }
    });
  }

  // في انتظار إدخال IP
  if (state[id] === 'await_ip') {
    const parts = text.split(':');
    if (parts.length !== 2 || isNaN(parts[1])) {
      return bot.sendMessage(id, `${ICON.ERROR} الصيغة غير صحيحة! استخدم: \`ip:port\``, { parse_mode: 'Markdown' });
    }
    const host = parts[0].trim();
    const port = parseInt(parts[1]);
    state[id] = null;
    connectToServer(id, host, port);
    return;
  }

  // في انتظار اسم اللاعب
  if (state[id] === 'await_name') {
    fakeNames[id] = text.trim();
    save(USERS_FILE, fakeNames);
    state[id] = null;
    return bot.sendMessage(id, `${ICON.SUCCESS} تم تغيير الاسم إلى: ${text}`, mainKeys);
  }

  // الأوامر
  switch (text) {
    case '/start':
      bot.sendMessage(id, `مرحبًا ${msg.from.first_name || 'صديقي'} 🌟\nأنا بوت Minecraft Bedrock 24/7!\nأقدر أخلي سيرفرك شغال طول الوقت 🔥`, mainKeys);
      break;

    case '🚀 تشغيل':
      state[id] = 'await_ip';
      bot.sendMessage(id, `🎮 أرسل IP والبورت بهذا الشكل:\n\`example.aternos.me:19132\``, { parse_mode: 'Markdown' });
      break;

    case '🔌 إيقاف':
      if (active[id]) {
        cleanup(id);
        bot.sendMessage(id, `${ICON.SUCCESS} تم إيقاف البوت.`);
      } else bot.sendMessage(id, `${ICON.INFO} لا يوجد بوت يعمل حاليًا.`);
      break;

    case 'ℹ️ معلوماتي':
      if (active[id]) {
        const { host, port } = active[id];
        bot.sendMessage(id, `🔹 متصل الآن:\n\`${host}:${port}\``, { parse_mode: 'Markdown' });
      } else bot.sendMessage(id, `🔸 لا يوجد اتصال حالي.`);
      break;

    case '✏️ تغيير الاسم':
      state[id] = 'await_name';
      bot.sendMessage(id, `📝 أرسل الاسم الجديد لللاعب الوهمي.`);
      break;

    case '❓ المساعدة':
      bot.sendMessage(id, `📘 *حل المشاكل*\n\n1️⃣ تأكد أن السيرفر شغال (Online)\n2️⃣ تحقق من IP والبورت\n3️⃣ أعد المحاولة بعد دقيقة`, { parse_mode: 'Markdown' });
      break;

    case '📞 الدعم الفني':
      bot.sendMessage(id, `للتواصل مع المطور:\n@YourSupportAccount`);
      break;

    default:
      bot.sendMessage(id, `اختر من الأزرار 👇`, mainKeys);
      break;
  }
});

// 🔄 التحقق من الاشتراك بعد الضغط على الزر
bot.on('callback_query', async (q) => {
  if (q.data === 'check') {
    const ok = await checkSub(q.message.chat.id);
    if (ok) {
      bot.answerCallbackQuery(q.id, { text: 'تم التحقق ✅', show_alert: true });
      bot.sendMessage(q.message.chat.id, `يمكنك الآن استخدام البوت 👇`, mainKeys);
    } else {
      bot.answerCallbackQuery(q.id, { text: '❌ لم تشترك بعد', show_alert: true });
    }
  }
});

// ⚡ وظيفة الاتصال بالسيرفر
async function connectToServer(id, host, port) {
  const name = fakeNames[id] || `AFK_Bot_${Math.floor(Math.random() * 999)}`;
  bot.sendMessage(id, `${ICON.WAIT} جاري الاتصال بـ \`${host}:${port}\`\nالاسم: *${name}*`, { parse_mode: 'Markdown' });

  cleanup(id);

  const client = bedrock.createClient({ host, port, username: name, offline: true });
  const timer = setTimeout(() => {
    bot.sendMessage(id, `${ICON.ERROR} انتهت مهلة الاتصال.`);
    cleanup(id);
  }, 25000);

  active[id] = { client, host, port, timer };

  client.on('spawn', () => {
    clearTimeout(timer);
    bot.sendMessage(id, `${ICON.SUCCESS} تم الاتصال بنجاح! 🟢`);
  });

  client.on('disconnect', () => {
    bot.sendMessage(id, `${ICON.WARNING} تم قطع الاتصال من السيرفر.`);
    cleanup(id);
  });

  client.on('error', (err) => {
    bot.sendMessage(id, `${ICON.ERROR} خطأ أثناء الاتصال:\n\`${err.message}\``, { parse_mode: 'Markdown' });
    cleanup(id);
  });
}

// 🧩 أخطاء عامة
process.on('uncaughtException', (err) => console.error('❌ خطأ:', err));
bot.on('polling_error', (err) => console.error('⚠️ Polling Error:', err.message));

console.log('✨ بوت Minecraft Bedrock 24/7 - يعمل الآن ✨');