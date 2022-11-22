import * as dotenv from "dotenv";
dotenv.config();
import http from "http";
import axios from "axios";
import { Telegram } from "telegraf";
import cron from "node-cron";
import { promises as fs } from "fs";
import { HomeResponseObject, House } from "./types";
// import { dummyHouses } from "./dummyData";
var agent = new http.Agent({ family: 4 });

if (!process.env.BOT_TOKEN || !process.env.CHAT_ID) {
  throw new Error("Make sure Bot-token and chat-ID are set");
}

const telegram: Telegram = new Telegram(process.env.BOT_TOKEN as string);
let CHECKED_AMOUNT = 0;
let CHECKED_HOUSES = 0;
let NEW_HOUSES = 0;

cron.schedule(
  "0 9,11,13,15,17,19,20 * * *",
  () => {
    startScrape(true);
  },
  {
    scheduled: true,
    timezone: "Europe/Amsterdam",
  }
);

cron.schedule(
  "0 22 * * *",
  () => {
    sendMessage(
      `Daily update: I successfully checked for new listings ${CHECKED_AMOUNT} times today. Out of ${CHECKED_HOUSES} houses available, ${NEW_HOUSES} were newly listed.`
    );
    CHECKED_AMOUNT = 0;
    CHECKED_HOUSES = 0;
    NEW_HOUSES = 0;
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
  console.log(`Check ${CHECKED_AMOUNT}, ${new Date()}`);
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
        httpAgent: agent,
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
            httpAgent: agent,
          }
        );
        return result.data;
      };
    })
    .map((value) => {
      return value();
    })
    .slice(1);

  let additionalPageResults;
  try {
    additionalPageResults = await Promise.all(additionalRequestPromises);
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
  additionalPageResults.forEach((result) =>
    combinedHouses.push(...result.houses)
  );

  console.log(`Fetched ${combinedHouses.length} houses`);
  CHECKED_AMOUNT = CHECKED_AMOUNT + 1;
  CHECKED_HOUSES = combinedHouses.length;

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
    NEW_HOUSES = NEW_HOUSES + filteredHouses.length;
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
setTimeout(() => {
  startScrape(true);
}, 1000);

console.log("Homehunt started");
