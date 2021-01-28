import 'reflect-metadata';
import { Telegraf, Markup, Context } from 'telegraf';

import { getUsers, saveUsers, findUser, findUserByUsername, findUserByIndex } from './helpers/file';

let inProgress = false;

(async () => {
    const bot = new Telegraf('TOKEN');

    bot.use((ctx, next) => {
        if(ctx.message) {
            return message(ctx, next);
        } else if(ctx.update) {
            return update(ctx, next);
        }

        return next();
    });

    bot.launch()
})();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const getUsername = (user: any) => `${user.first_name || ''} ${user.last_name || ''} ${user.username ? `{${user.username}}` : ''}`;
const unbanChatMember = async (ctx: any, chatId: any, user: any, message: boolean = true) => {
    const chatMember = await ctx.telegram.getChatMember(chatId, user.id);

    // TODO: убрать когда telegraf обновится и туда добавят only_if_banned опцию.
    if (chatMember.status === 'member') {
        if (message) ctx.reply(`Пользователь ${getUsername(user)} все еще состоит в группе! Не надо так. ¯\\_(ツ)_/¯`);

        return false;
    } 

    return await ctx.telegram.unbanChatMember(chatId, user.id, { only_if_banned: true })
        .then(() => {
            ctx.reply(`Пользователь ${getUsername(user)} убран из черного списка!`);
        })
        .catch(() => {
            if(message) {
                ctx.reply(`Я пытался убрать пользователя ${getUsername(user)} из черного списка, но что-то пошло не так. Я просто bot Валера и не могу знать как это исправить... Попробуйте связаться с моим разработчиком, спасибо.`);
            }
        });
} 

const unbanAllChatMember = (ctx: any, chatId: any) => {
    const users = getUsers().slice(1);
    inProgress = true;

    ctx.reply(`Начинаю очищать черный список. Это может занять какое-то время, пожалуйста подождите, я скажу, когда закончу.`);

    const intervalId = setInterval(async () => {
        const user = users.pop();
        if (user) {
            await unbanChatMember(ctx, chatId, user, false);
        } else {
            ctx.reply(`Список очищен.`);
            clearInterval(intervalId);
            inProgress = false;
        }
    }, 5001);
}

const showUserList = (ctx: any) => {
    const users = getUsers();
    const list = users.map((user: any, index: number) => `[${index}] ${getUsername(user)}`);
    const buttons = users.map((user: any, index: number) => Markup.callbackButton(
        `${index}`,
        `/remove @valera404_bot ${index}`
    ));

    list.push(`\n\nПросто нажмите на кнопку с соответсвующим номером и я уберу этого пользователя из черного списка!`)

    ctx.replyWithHTML(list.join("\n"), {
        reply_markup: Markup.inlineKeyboard(buttons, {
            columns: 8,
        })
    });
}

const registerUser = (ctx: any, user: any) => {
    if (!user) {
        return false;
    }

    const users = getUsers();

    if (findUser(user.id, users)) {
        ctx.reply(`Где-то я тебя уже видел ${getUsername(user)}... Так ведь мы уже знакомы!`);
        return false;
    }

    users.push(user);

    saveUsers(users);

    ctx.reply(`Пользователь ${getUsername(user)} добавлен ко мне в друзья! <3`);

    return true;
}

const message = (ctx: any, next: any) => {
    const [command, bot, ...values] = ctx.message && ctx.message.text && ctx.message.text.split(' ') || [];

    if (ctx && ctx.chat && ctx.chat.id > 0 || bot !== '@valera404_bot') {
        return next();
    }

    if (inProgress) {
        ctx.reply(`Я существо однозадачное и в данный момент уже занят.`);
        return next();
    }

    const chatId = ctx.chat && ctx.chat.id || 0;

    switch (command) {
        case '/help': {
            const message = [];

            message.push(`Всем привет! Меня зовут Валера и я ваш бот-помошник.`);
            message.push(``);
            message.push(`Сейчас я могу вам помочь убрать из черного списка ваших соседей. Из списка я удаляю только знакомых мне пользователей.`);
            message.push(``);
            message.push('!!!ВАЖНО!!! Если пользователь не находится в черном списке и уже есть в чате, а вы попробуете его убрать из него нажав на кнопку с его номером, Telegram его исключит из группы. Я не виноват! Пожалуйста, будьте акуратнее! Разработчики обещали это скоро исправить.')
            message.push(``);

            const buttons = [];

            buttons.push(Markup.callbackButton(
                `Познакомиться с Валерой`,
                `/register @valera404_bot`
            ));
            buttons.push(Markup.callbackButton(
                `Показать список знакомых`,
                `/list @valera404_bot`
            ));
            buttons.push(Markup.callbackButton(
                `Очистить черный список`,
                `/removeAll @valera404_bot`
            ));

            ctx.replyWithHTML(message.join("\n"), {
                reply_markup: Markup.inlineKeyboard(buttons, {
                    columns: 1,
                })
            });

            return next();
        };

        case '/register': {
            const user = ctx.message && ctx.message.from;

            if (!user) {
                return next();
            }

            registerUser(ctx, user);

            return next();
        };

        case '/remove': {
            const value = values.join("").trim();
            const user = value[0] === '@' ? findUserByUsername(value.slice(1)) : findUserByIndex(+value);

            if (!user) {
                return next();
            }

            unbanChatMember(ctx, chatId, user);

            return next();
        };

        case '/removeAll': {
            unbanAllChatMember(ctx, chatId);

            return next();
        }

        case '/list': {
            showUserList(ctx);

            return next();
        };
    }

    return next();
}
const update = (ctx: any, next: any) => {
    const query = ctx.update && ctx.update.callback_query;

    if (!query) return next();
    if (inProgress) {
        ctx.reply(`Я существо однозадачное и в данный момент уже занят.`);
        return next();
    }

    const data = query.data;
    const [command, bot, value] = data.split(' ') || [];

    if (command === '/remove') {
        const user = findUserByIndex(+value);

        unbanChatMember(ctx, query.message.chat.id, user);
    } else if (command === '/list') {
        showUserList(ctx);
    } else if (command === '/register') {
        const user = query.from;
        registerUser(ctx, user);
    } else if (command === '/removeAll') {
        unbanAllChatMember(ctx, query.message.chat.id);
    }

    return next();
}
