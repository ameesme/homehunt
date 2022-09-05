import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { Telegram } from "telegraf";
import cron from "node-cron";
import { promises as fs } from "fs";
import { HomeResponseObject, House } from "./types";
// import { dummyHouses } from "./dummyData";

if (!process.env.BOT_TOKEN || !process.env.CHAT_ID) {
  throw new Error("Make sure Bot-token and chat-ID are set");
}

const telegram: Telegram = new Telegram(process.env.BOT_TOKEN as string);

cron.schedule(
  "0 9,11,13,15,17,19,22 * * *",
  () => {
    startScrape(true);
  },
  {
    scheduled: true,
    timezone: "Europe/Amsterdam",
  }
);

const urlPrefix = "https://vbtverhuurmakelaars.nl";
const path = "./house_history.txt";
const filter = {
  city: "Eindhoven",
  radius: 40,
  address: "",
  priceRental: { min: 0, max: 1300 },
  surface: 70,
  rooms: [3, 4, 5, 6, 7],
  typeCategory: "house",
};

const baseUrl =
  "https://vbtverhuurmakelaars.nl/api/properties/search?type=purchase";
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:104.0) Gecko/20100101 Firefox/104.0",
  Accept: "*/*",
  "Accept-Language": "nl,en-US;q=0.7,en;q=0.3",
  "content-type": "application/json",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Cache-Control": "max-age=0",
};

const checkFile = async () => {
  try {
    await fs.access(path);
  } catch (err) {
    console.log("Creating history file...");
    await fs.writeFile(path, "", "utf-8");
  }
};

const sendMessage = async (message: string) => {
  console.log("MESSAGE", message);
  telegram.sendMessage(process.env.CHAT_ID!, message);
};

const startScrape = async (retry: boolean) => {
  if (retry) {
    console.log("Starting initial fetch");
  } else {
    console.log("Starting redundant fetch");
  }
  // Fetch and parse first result
  let initialFetchResult;
  let combinedHouses: House[] = [];

  try {
    initialFetchResult = await axios.post<HomeResponseObject>(
      baseUrl,
      {
        limit: 12,
        page: 1,
        filter,
      },
      {
        headers,
        method: "POST",
      }
    );
  } catch (e) {
    console.log(e);
    if (retry) {
      sendMessage("I could not fetch homes just now. Will retry in a bit.");
      setTimeout(() => {
        startScrape(false);
      }, 1000 * 60 * 5);
    } else {
      telegram.sendMessage(
        process.env.CHAT_ID!,
        "I could not fetch homes after trying a second time. Giving up for now."
      );
    }
    return;
  }
  combinedHouses.push(...initialFetchResult.data.houses);

  console.log(
    `Fetching approximately ${
      initialFetchResult.data.houses.length * initialFetchResult.data.pageCount
    } houses...`
  );

  const additionalRequestPromises = new Array(initialFetchResult.data.pageCount)
    .fill(null)
    .map((value, index) => {
      return async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000 * index));
        console.log(`Fetching page ${index + 1}...`);
        const result = await axios.post<HomeResponseObject>(
          baseUrl,
          {
            limit: 12,
            page: index + 1,
            filter,
          },
          {
            headers,
            method: "POST",
          }
        );
        return result.data;
      };
    })
    .map((value) => {
      return value();
    })
    .slice(1);

  const additionalPageResults = await Promise.all(additionalRequestPromises);
  additionalPageResults.forEach((result) =>
    combinedHouses.push(...result.houses)
  );

  console.log(`Fetched ${combinedHouses.length} houses`);

  // Reading previously listed houses
  const previousHouseData = await fs.readFile(path, "utf-8");
  const previousHouses = previousHouseData.split("\n");

  const filteredHouses = combinedHouses
    .filter((house) => {
      return (
        (house.status.name === "available" || house.status.name === "option") &&
        !previousHouses.includes(house.id)
      );
    })
    .sort((a, b) => {
      return a.interestedParties - b.interestedParties;
    });

  if (filteredHouses.length > 0) {
    telegram.sendChatAction(process.env.CHAT_ID!, "typing");
    console.log(`Found ${filteredHouses.length} new houses!`);
    sendMessage(
      `Hello! I discovered ${filteredHouses.length} new listings just now. Listing them below, sorted by the amount of existing responses.`
    );

    setTimeout(() => {
      filteredHouses.forEach(async (house, index) => {
        await new Promise((resolve) => setTimeout(resolve, 2000 * index));
        const summary = `${house.address.house}${house.address.city} • €${
          house.prices.rental.price + (house.prices.rental.serviceCharges || 0)
        },- incl. per maand • ${house.surface}m²`;
        telegram.sendPhoto(process.env.CHAT_ID!, `${urlPrefix}${house.image}`, {
          caption: `${summary}\n\n${urlPrefix}${house.url}`,
        });
      });
    }, 2000);

    // Marking previously listed houses
    await fs.appendFile(
      path,
      `\n${filteredHouses.map((house) => house.id).join("\n")}`
    );
  } else {
    console.log("No new houses for now");
  }
};

checkFile();

console.log("Homehunt started");
sendMessage("Homehunt started!");
