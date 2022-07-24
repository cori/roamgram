const TelegramBotApi = require("node-telegram-bot-api");
const RoamResearchPrivateApi = require("roam-research-private-api");

//  TODO: look for #ij node, if missing create it; aadd these messages therein
//  TODO: in roam-research-private-api, update daily note things with timezone

class RoamApi extends RoamResearchPrivateApi {
  async appendBlock(text, order = 0, uid) {
    const result = await this.page.evaluate(
      (text, order, uid) => {
        if (!window.roamAlphaAPI) {
          return Promise.reject("No Roam API detected");
        }
        window.roamAlphaAPI.createBlock({
          location: { "parent-uid": uid, order },
          block: { string: text },
        }).then((result) => {
          console.log(result);
          return Promise.resolve(result);
        }).catch((err) => {
          console.error(err);
          return Promise.reject(result);
        })
      },
      text,
      order,
      uid
    );
    // Let's give time to sync.
    // await this.page.waitForTimeout(1000); 
    return result;
  }
}

const main = async ({ token, adminIdList, roam: { graph, email, password } }) => {
  if (typeof adminIdList === "string") adminIds = await intList(adminIdList);

  const bot = new TelegramBotApi(token, { polling: true });
  const validator = (message) => {
    if (adminIds.includes(message.from.id)) return true;
    return false;
  };
  const roam = new RoamApi(graph, email, password, {
    headless: true,
  });

  await roam.logIn();
  console.log("Logged into Roam");

  bot.onText(/\/id*(.+)/, (message) => {
    bot.sendMessage(
      message.chat.id,
      `User id: ${message.from.id}\nChat id: ${message.chat.id}`
    );
  });

  bot.on('photo', (message) => {
    console.log(message.photo[0]);
    const chatId = message.chat.id;
    if (validator(message)) {
      const dailyNoteId = roam.dailyNoteUid();
      const dailyNoteTitle = roam.dailyNoteTitle();
      const timeStr = new Date().toLocaleTimeString( [], { timeZone: 'America/Chicago', hour12: false, minute: '2-digit', hour: '2-digit' } );
      roam
        .runQuery(
          `[ :find (pull ?e [*]) :where [?e :node/title "${dailyNoteTitle}"]]`
        )
        .then((result) => {
      	  //	find the number of children of the dailyNote and stick this on the end 
          try {
            return result[0][0].children.length;
          } catch {
            return result[0].length;
          }
        })
        .then((order) => {
          roam
            .appendBlock(
              message.photo[0],
              order ?? 0,
              dailyNoteId
            )
            .then((result) => {
              if (!result) {  //  https://roamresearch.com/#/app/developer-documentation/page/YxUqV1lKF these are always some version of nil
                bot.sendMessage(chatId, `Added text to Roam Daily Notes`);
              } else {
                bot.sendMessage(
                  chatId,
                  `Failed to add message to Roam Daily Notes? %{result}`
                );
              }
            })
            .catch((err) => {
              bot.sendMessage(
                chatId,
                `Failed to append message to Roam Daily Notes.\n${err.toString()}`
              );
            });
        })
        .catch((err) => {
          bot.sendMessage(
            chatId,
            `Failed to add message to Roam Daily Notes: failed to find order?.\n${err.toString()}`
          );
        });
    } else {
      console.log(message.from.id);
      bot.sendMessage(chatId, "Invalid user.");
    }
  })

  bot.onText(/& (.+)/, (message) => {
    console.log(message);
    const chatId = message.chat.id;
    if (validator(message)) {
      const dailyNoteId = roam.dailyNoteUid();
      const dailyNoteTitle = roam.dailyNoteTitle();
      const timeStr = new Date().toLocaleTimeString( [], { timeZone: 'America/Chicago', hour12: false, minute: '2-digit', hour: '2-digit' } );
      roam
        .runQuery(
          `[ :find (pull ?e [*]) :where [?e :node/title "${dailyNoteTitle}"]]`
        )
        .then((result) => {
      	  //	find the number of children of the dailyNote and stick this on the end 
          try {
            return result[0][0].children.length;
          } catch {
            return result[0].length;
          }
        })
        .then((order) => {
          roam
            .appendBlock(
              message.text.replace(/& /, `${timeStr}:: `).concat(' #', message.from.first_name),
              order ?? 0,
              dailyNoteId
            )
            .then((result) => {
              if (!result) {  //  https://roamresearch.com/#/app/developer-documentation/page/YxUqV1lKF these are always some version of nil
                bot.sendMessage(chatId, `Added text to Roam Daily Notes`);
              } else {
                bot.sendMessage(
                  chatId,
                  `Failed to add message to Roam Daily Notes? %{result}`
                );
              }
            })
            .catch((err) => {
              bot.sendMessage(
                chatId,
                `Failed to append message to Roam Daily Notes.\n${err.toString()}`
              );
            });
        })
        .catch((err) => {
          bot.sendMessage(
            chatId,
            `Failed to add message to Roam Daily Notes: failed to find order?.\n${err.toString()}`
          );
        });
    } else {
      console.log(message.from.id);
      bot.sendMessage(chatId, "Invalid user.");
    }
  });
};

const intList = (integerString) => {
  return integerString.split(',').map(el => {
    return parseInt(el, 10);
  })
}

module.exports = main;

require("dotenv").config();

(async () => {
  [
    "ROAM_GRAPH",
    "ROAM_EMAIL",
    "ROAM_PASSWORD",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_ADMIN_ID",
  ].forEach((key) => {
    if (!process.env[key]) {
      console.log(`${key} not found in env file.`);
      process.exit(1);
    }

    // if (key === "TELEGRAM_ADMIN_ID") {
    //   if (typeof process.env[key] === "string")
    //     process.env[key] = parseInt(process.env[key]);
    // }
  });

  await main({
    token: process.env.TELEGRAM_BOT_TOKEN,
    adminIdList: process.env.TELEGRAM_ADMIN_ID,
    roam: {
      graph: process.env.ROAM_GRAPH,
      email: process.env.ROAM_EMAIL,
      password: process.env.ROAM_PASSWORD,
    },
  });
})().catch((err) => console.log(err));
