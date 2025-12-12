import { Telegraf, Markup } from 'telegraf';
import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const GROUP_CHAT_ID = Number(process.env.GROUP_CHAT_ID!);

if (!BOT_TOKEN) throw new Error('BOT_TOKEN required');
if (!GROUP_CHAT_ID) throw new Error('GROUP_CHAT_ID required');

const bot = new Telegraf(BOT_TOKEN);

type UserState = {
  route?: string;
  menuMessageId?: number;
  chatId?: number;
};

const userState = new Map<string, UserState>();

// ✅ Только закреплённая кнопка (Inline URL, НЕ reply keyboard)
async function sendPinnedButtonToGroup() {
  try {
    const msg = await bot.telegram.sendMessage(
      GROUP_CHAT_ID,
      '🆕 **Создать заявку** — нажмите кнопку ---------->> \n\n',
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url('🆕 Создать заявку', 'https://t.me/ZayavkiKzUzBot?start=apply')]
        ]).reply_markup
      }
    );
    
    // Закрепляем наверх группы
    await bot.telegram.pinChatMessage(GROUP_CHAT_ID, msg.message_id);
    console.log('✅ Кнопка закреплена наверх');
  } catch (err: unknown) {
    console.error('Ошибка закрепления:', err);
  }
}

// /start=apply показывает меню
bot.start(async (ctx: Context) => {
  if (!('startPayload' in ctx) || ctx.startPayload !== 'apply') return;
  if (!ctx.from || !ctx.chat) return;

  const fromId = String(ctx.from.id);
  const menuMsg = await ctx.reply(
    'Выберите направление:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🇰🇿→🇺🇿 Казахстан → Узбекистан', 'KZ_UZ')],
      [Markup.button.callback('🇺🇿→🇰🇿 Узбекистан → Казахстан', 'UZ_KZ')],
    ])
  );
  userState.set(fromId, { menuMessageId: menuMsg.message_id, chatId: ctx.chat.id });
});

// Выбор направления
bot.action(['KZ_UZ', 'UZ_KZ'], async (ctx: Context) => {
  await ctx.answerCbQuery().catch(() => {});
  if (!ctx.from || !ctx.callbackQuery) return;
  
  const cb = ctx.callbackQuery;
  if (!('data' in cb) || typeof cb.data !== 'string') return;

  const fromId = String(ctx.from.id);
  const state = userState.get(fromId) || {};
  state.route = cb.data === 'KZ_UZ' ? 'Казахстан → Узбекистан' : 'Узбекистан → Казахстан';
  userState.set(fromId, state);

  await ctx.editMessageText('Укажите:  Город погрузки, Город выгрузки, Вес , Куб').catch(() => {});
});

// Обработка сообщений
bot.on('message', async (ctx: Context) => {
  if (ctx.chat?.type !== 'private') return;
  if (!ctx.from || !ctx.message) return;

  const message = ctx.message;
  if (!('text' in message) || typeof message.text !== 'string') return;

  const text = message.text.trim();
  const fromId = String(ctx.from.id);
  const state = userState.get(fromId);

  if (state?.route && text) {
    const requestText = `🆕 Новая заявка:\n📍 Маршрут: ${state.route}\n📝 Примечание: ${text}\n👤 От: ${ctx.from.first_name || 'Без имени'} (@${ctx.from.username || 'нет'})`;

    try {
      await bot.telegram.sendMessage(GROUP_CHAT_ID, requestText);
      userState.delete(fromId);
      await ctx.reply('✅ Заявка отправлена!');
      await ctx.reply('Чтобы отправить новую заявку, просто напишите сообщение');
    } catch (err: unknown) {
      console.error('Ошибка:', err);
      await ctx.reply('❌ Ошибка отправки.');
    }
    return;
  }

  const menuMsg = await ctx.reply(
    'Выберите направление:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🇰🇿→🇺🇿 Казахстан → Узбекистан', 'KZ_UZ')],
      [Markup.button.callback('🇺🇿→🇰🇿 Узбекистан → Казахстан', 'UZ_KZ')],
    ])
  );
  userState.set(fromId, { menuMessageId: menuMsg.message_id, chatId: ctx.chat.id });
});

// Запуск
bot.launch().then(async () => {
  console.log('🚀 Бот запущен');
  await sendPinnedButtonToGroup();
}).catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
