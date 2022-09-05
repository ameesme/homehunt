import { Context, Telegraf } from "telegraf";
import { Update } from "typegram";

const bot: Telegraf<Context<Update>> = new Telegraf(
  process.env.BOT_TOKEN as string
);
