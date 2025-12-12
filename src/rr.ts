import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN!);

// Состояния пользователей
const userState = new Map<
  string,
  { route?: string; menuMessageId?: number }
>();

// Любое сообщение от участника → запускаем сценарий
bot.on('message', async (ctx) => {
    if ('new_chat_members' in ctx.message || 'left_chat_member' in ctx.message) {
    return;
  }

  // Игнорируем текстовые уведомления о добавлении/удалении участников
  if ('text' in ctx.message) {
    const txt = ctx.message.text.toLowerCase();
    if (txt.includes('added') || txt.includes('removed')) {
      return;
    }
  }
  const fromId = String(ctx.from.id);
  const state = userState.get(fromId);

  // Если маршрут выбран — ожидаем примечание
  if (state?.route && 'text' in ctx.message) {
    const note = ctx.message.text.trim();
    if (!note) return;

    const requestText =
      `Новая заявка:\n` +
      `Маршрут: ${state.route}\n` +
      `Примечание: ${note}\n` +
      `От: ${ctx.from.first_name} (@${ctx.from.username || 'нет'})`;

    // Отправляем заявку
    await ctx.telegram.sendMessage(ctx.chat!.id, requestText);

    // Удаляем сообщение с примечанием
    await ctx.deleteMessage(ctx.message.message_id);

    // Удаляем сообщение с кнопками, если оно было
    if (state.menuMessageId) {
      try {
        await ctx.deleteMessage(state.menuMessageId);
      } catch {}
    }

    userState.delete(fromId);
    return;
  }

  // Если пользователь пишет впервые → показываем варианты
  const menuMsg = await ctx.reply(
    'Выберите направление:',
    Markup.inlineKeyboard([
      [Markup.button.callback('Казахстан → Узбекистан', 'KZ_UZ')],
      [Markup.button.callback('Узбекистан → Казахстан', 'UZ_KZ')],
    ])
  );
try {
  await ctx.deleteMessage(ctx.message.message_id);
} catch {}
  userState.set(fromId, { menuMessageId: menuMsg.message_id });
});

// Обработчик нажатий кнопок
bot.action(['KZ_UZ', 'UZ_KZ'], async (ctx) => {
  await ctx.answerCbQuery();

  const fromId = String(ctx.from.id);
  const state = userState.get(fromId) || {};

  const q = ctx.callbackQuery;
  if (q && 'data' in q) {
    state.route = q.data === 'KZ_UZ'
      ? 'Казахстан → Узбекистан'
      : 'Узбекистан → Казахстан';
  }

  userState.set(fromId, state);

  await ctx.editMessageText('Теперь укажите примечание ');
  
});

// Запуск бота с логом
bot.launch().then(() => {
  console.log('Бот запущен');
});
